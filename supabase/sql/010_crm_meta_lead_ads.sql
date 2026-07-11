-- CRM inmobiliario - integracion de Meta Lead Ads
-- Ejecutar despues de 009_crm_captura_leads_publicos.sql.
-- Requiere que el webhook use SUPABASE_SERVICE_ROLE_KEY solo en servidor.

alter table public.leads_publicos
  add column if not exists external_id text;

alter table public.leads_publicos
  add column if not exists page_id text;

alter table public.leads_publicos
  add column if not exists form_id text;

alter table public.leads_publicos
  add column if not exists ad_id text;

alter table public.leads_publicos
  add column if not exists adset_id text;

alter table public.leads_publicos
  add column if not exists campaign_id text;

alter table public.leads_publicos
  add column if not exists ad_name text;

alter table public.leads_publicos
  add column if not exists adset_name text;

alter table public.leads_publicos
  add column if not exists campaign_name text;

alter table public.leads_publicos
  add column if not exists respuestas jsonb not null default '{}'::jsonb;

alter table public.leads_publicos
  add column if not exists raw_payload jsonb;

alter table public.leads_publicos
  add column if not exists meta_created_at timestamptz;

create unique index if not exists leads_publicos_external_id_idx
  on public.leads_publicos (external_id)
  where external_id is not null;

create index if not exists leads_publicos_origen_created_idx
  on public.leads_publicos (origen, created_at desc);

create index if not exists leads_publicos_campaign_idx
  on public.leads_publicos (campaign_id, created_at desc)
  where campaign_id is not null;

create index if not exists clientes_celular_normalizado_idx
  on public.clientes (
    (right(regexp_replace(coalesce(celular, ''), '[^0-9]', '', 'g'), 9))
  );

create index if not exists clientes_correo_normalizado_idx
  on public.clientes ((lower(trim(coalesce(correo, '')))))
  where correo is not null and trim(correo) <> '';

create table if not exists public.meta_lead_events (
  id uuid primary key default gen_random_uuid(),
  meta_lead_id text not null unique,
  page_id text,
  form_id text,
  ad_id text,
  status text not null default 'PENDIENTE'
    check (status in ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR')),
  attempts integer not null default 0 check (attempts >= 0),
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  received_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_lead_events_status_idx
  on public.meta_lead_events (status, received_at desc);

drop trigger if exists meta_lead_events_set_updated_at
  on public.meta_lead_events;
create trigger meta_lead_events_set_updated_at
before update on public.meta_lead_events
for each row execute function public.set_updated_at();

alter table public.meta_lead_events enable row level security;

drop policy if exists "meta_lead_events_manager_select"
  on public.meta_lead_events;
create policy "meta_lead_events_manager_select"
on public.meta_lead_events
for select
to authenticated
using (public.is_crm_manager());

revoke all on table public.meta_lead_events from anon;
revoke all on table public.meta_lead_events from authenticated;
grant select on table public.meta_lead_events to authenticated;
grant all on table public.meta_lead_events to service_role;

create or replace function public.crm_registrar_lead_meta(
  p_meta_lead_id text,
  p_nombre_completo text,
  p_celular text,
  p_correo text default null,
  p_page_id text default null,
  p_form_id text default null,
  p_ad_id text default null,
  p_adset_id text default null,
  p_campaign_id text default null,
  p_ad_name text default null,
  p_adset_name text default null,
  p_campaign_name text default null,
  p_respuestas jsonb default '{}'::jsonb,
  p_raw_payload jsonb default '{}'::jsonb,
  p_acepta_comercial boolean default false,
  p_meta_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta_lead_id text;
  v_nombre text;
  v_celular text;
  v_correo text;
  v_cliente public.clientes%rowtype;
  v_lead public.leads_publicos%rowtype;
  v_asesor_id uuid;
  v_cliente_reutilizado boolean := false;
  v_mensaje text;
begin
  v_meta_lead_id := trim(coalesce(p_meta_lead_id, ''));
  v_nombre := trim(coalesce(p_nombre_completo, ''));
  v_celular := regexp_replace(coalesce(p_celular, ''), '[^0-9]', '', 'g');
  v_correo := lower(nullif(trim(coalesce(p_correo, '')), ''));

  if length(v_celular) = 11 and left(v_celular, 2) = '51' then
    v_celular := right(v_celular, 9);
  end if;

  if v_meta_lead_id = '' then
    raise exception 'Meta no envio un identificador de lead valido.';
  end if;

  if length(v_nombre) < 3 or length(v_nombre) > 120 then
    raise exception 'El formulario de Meta no contiene un nombre valido.';
  end if;

  if v_celular !~ '^9[0-9]{8}$' then
    raise exception 'El formulario de Meta no contiene un celular peruano valido.';
  end if;

  if v_correo is not null
     and v_correo !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    v_correo := null;
  end if;

  perform pg_advisory_xact_lock(hashtext('crm_leads_publicos_las_lomas'));

  select lp.*
  into v_lead
  from public.leads_publicos lp
  where lp.external_id = v_meta_lead_id
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'deduplicado', true,
      'lead_id', v_lead.id,
      'cliente_id', v_lead.cliente_id
    );
  end if;

  select c.*
  into v_cliente
  from public.clientes c
  where right(regexp_replace(coalesce(c.celular, ''), '[^0-9]', '', 'g'), 9)
          = v_celular
     or (
       v_correo is not null
       and lower(trim(coalesce(c.correo, ''))) = v_correo
     )
  order by
    case
      when right(regexp_replace(coalesce(c.celular, ''), '[^0-9]', '', 'g'), 9)
             = v_celular then 0
      else 1
    end,
    c.created_at asc
  limit 1
  for update;

  if found then
    v_cliente_reutilizado := true;

    select p.id
    into v_asesor_id
    from public.profiles p
    where p.id = v_cliente.asesor_id
      and p.role = 'asesor'
      and p.active = true;
  end if;

  if v_asesor_id is null then
    select p.id
    into v_asesor_id
    from public.profiles p
    where p.role = 'asesor'
      and p.active = true
    order by
      (
        select count(*)
        from public.leads_publicos lp
        where lp.asesor_id = p.id
          and lp.created_at >= date_trunc('month', now())
      ) asc,
      (
        select max(lp.created_at)
        from public.leads_publicos lp
        where lp.asesor_id = p.id
      ) asc nulls first,
      p.created_at asc,
      p.id asc
    limit 1;
  end if;

  v_mensaje := concat_ws(
    ' | ',
    'Lead recibido desde Meta Ads',
    nullif('Campana: ' || trim(coalesce(p_campaign_name, '')), 'Campana: '),
    nullif('Anuncio: ' || trim(coalesce(p_ad_name, '')), 'Anuncio: ')
  );

  if v_cliente_reutilizado then
    update public.clientes
    set nombres = case
          when trim(coalesce(nombres, '')) = '' then v_nombre
          else nombres
        end,
        celular = case
          when trim(coalesce(celular, '')) = '' then v_celular
          else celular
        end,
        correo = coalesce(nullif(trim(correo), ''), v_correo),
        fuente = coalesce(nullif(trim(fuente), ''), 'META_LEAD_ADS'),
        asesor_id = v_asesor_id,
        estado_lead = case
          when coalesce(estado_lead, '') in ('', 'PERDIDO', 'VENDIDO')
            then 'NUEVO'
          else estado_lead
        end,
        proxima_accion = 'CONTACTAR',
        fecha_proximo_seguimiento = current_date,
        updated_at = now()
    where id = v_cliente.id
    returning * into v_cliente;
  else
    insert into public.clientes (
      nombres,
      celular,
      correo,
      fuente,
      observaciones,
      asesor_id,
      created_by,
      lote_interes_id,
      situacion_inicial,
      capacidad_cuota,
      tiempo_decision,
      intencion_compra,
      canal_preferido,
      puntaje_lead,
      nivel_interes,
      estado_lead,
      proxima_accion,
      fecha_proximo_seguimiento,
      estado_cita
    )
    values (
      v_nombre,
      v_celular,
      v_correo,
      'META_LEAD_ADS',
      v_mensaje,
      v_asesor_id,
      null,
      null,
      'SIN_DEFINIR',
      'SIN_DEFINIR',
      'SIN_DEFINIR',
      'INFO_GENERAL',
      'SIN_DEFINIR',
      10,
      'FRIO',
      'NUEVO',
      'CONTACTAR',
      current_date,
      'SIN_CITA'
    )
    returning * into v_cliente;
  end if;

  insert into public.leads_publicos (
    cliente_id,
    lote_id,
    asesor_id,
    nombre_completo,
    celular_normalizado,
    correo_normalizado,
    mensaje,
    origen,
    estado,
    cliente_reutilizado,
    acepta_datos,
    acepta_comercial,
    version_politica,
    external_id,
    page_id,
    form_id,
    ad_id,
    adset_id,
    campaign_id,
    ad_name,
    adset_name,
    campaign_name,
    respuestas,
    raw_payload,
    meta_created_at,
    created_at
  )
  values (
    v_cliente.id,
    null,
    v_asesor_id,
    v_nombre,
    v_celular,
    v_correo,
    v_mensaje,
    'META_LEAD_ADS',
    'NUEVO',
    v_cliente_reutilizado,
    true,
    coalesce(p_acepta_comercial, false),
    concat('META_FORM:', coalesce(nullif(trim(p_form_id), ''), 'SIN_ID')),
    v_meta_lead_id,
    nullif(trim(coalesce(p_page_id, '')), ''),
    nullif(trim(coalesce(p_form_id, '')), ''),
    nullif(trim(coalesce(p_ad_id, '')), ''),
    nullif(trim(coalesce(p_adset_id, '')), ''),
    nullif(trim(coalesce(p_campaign_id, '')), ''),
    nullif(trim(coalesce(p_ad_name, '')), ''),
    nullif(trim(coalesce(p_adset_name, '')), ''),
    nullif(trim(coalesce(p_campaign_name, '')), ''),
    coalesce(p_respuestas, '{}'::jsonb),
    coalesce(p_raw_payload, '{}'::jsonb),
    p_meta_created_at,
    coalesce(p_meta_created_at, now())
  )
  returning * into v_lead;

  return jsonb_build_object(
    'ok', true,
    'deduplicado', false,
    'lead_id', v_lead.id,
    'cliente_id', v_cliente.id,
    'cliente_reutilizado', v_cliente_reutilizado,
    'asignado', v_asesor_id is not null
  );
end;
$$;

revoke all on function public.crm_registrar_lead_meta(
  text, text, text, text, text, text, text, text, text,
  text, text, text, jsonb, jsonb, boolean, timestamptz
) from public, anon, authenticated;

grant execute on function public.crm_registrar_lead_meta(
  text, text, text, text, text, text, text, text, text,
  text, text, text, jsonb, jsonb, boolean, timestamptz
) to service_role;

create or replace function public.crm_actualizar_estado_lead_entrante(
  p_lead_id uuid,
  p_estado text
)
returns public.leads_publicos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_estado text;
  v_lead public.leads_publicos%rowtype;
begin
  v_role := public.current_profile_role();
  v_estado := upper(trim(coalesce(p_estado, '')));

  if v_role not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para gestionar leads.';
  end if;

  if v_estado not in ('NUEVO', 'ATENDIDO', 'DESCARTADO') then
    raise exception 'Estado de lead no permitido.';
  end if;

  select *
  into v_lead
  from public.leads_publicos
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'El lead indicado no existe.';
  end if;

  if v_role = 'asesor' and v_lead.asesor_id is distinct from auth.uid() then
    raise exception 'Este lead pertenece a otro asesor.';
  end if;

  if v_role = 'asesor' and v_estado = 'NUEVO' then
    raise exception 'Solo gerencia puede reabrir un lead.';
  end if;

  update public.leads_publicos
  set estado = v_estado,
      atendido_at = case
        when v_estado = 'ATENDIDO' then coalesce(atendido_at, now())
        when v_estado = 'NUEVO' then null
        else atendido_at
      end,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  return v_lead;
end;
$$;

revoke all on function public.crm_actualizar_estado_lead_entrante(uuid, text)
  from public, anon;
grant execute on function public.crm_actualizar_estado_lead_entrante(uuid, text)
  to authenticated;

create or replace function public.crm_reasignar_lead_entrante(
  p_lead_id uuid,
  p_asesor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads_publicos%rowtype;
begin
  if not public.is_crm_manager() then
    raise exception 'Solo gerencia puede reasignar leads.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_asesor_id
      and p.role = 'asesor'
      and p.active = true
  ) then
    raise exception 'El asesor seleccionado no existe o no esta activo.';
  end if;

  select *
  into v_lead
  from public.leads_publicos
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'El lead indicado no existe.';
  end if;

  update public.leads_publicos
  set asesor_id = p_asesor_id,
      updated_at = now()
  where id = p_lead_id
     or (
       v_lead.cliente_id is not null
       and cliente_id = v_lead.cliente_id
       and estado = 'NUEVO'
     );

  if v_lead.cliente_id is not null then
    update public.clientes
    set asesor_id = p_asesor_id,
        updated_at = now()
    where id = v_lead.cliente_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lead_id', p_lead_id,
    'cliente_id', v_lead.cliente_id,
    'asesor_id', p_asesor_id
  );
end;
$$;

revoke all on function public.crm_reasignar_lead_entrante(uuid, uuid)
  from public, anon;
grant execute on function public.crm_reasignar_lead_entrante(uuid, uuid)
  to authenticated;

-- Las actualizaciones se realizan solo mediante funciones con validacion de rol.
revoke update on table public.leads_publicos from authenticated;
grant select on table public.leads_publicos to authenticated;

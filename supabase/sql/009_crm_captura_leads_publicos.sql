-- CRM inmobiliario - captura segura de leads desde el cotizador publico
-- Ejecutar despues de 008_crm_reglas_comerciales.sql.
-- No concede acceso anonimo directo a clientes, perfiles ni lotes.

create extension if not exists pgcrypto;

alter table public.clientes
  add column if not exists lote_interes_id bigint
    references public.las_lomas_lotes(id) on delete set null;

alter table public.clientes
  add column if not exists situacion_inicial text;

alter table public.clientes
  add column if not exists capacidad_cuota text;

alter table public.clientes
  add column if not exists tiempo_decision text;

alter table public.clientes
  add column if not exists intencion_compra text;

alter table public.clientes
  add column if not exists canal_preferido text;

alter table public.clientes
  add column if not exists puntaje_lead integer;

alter table public.clientes
  add column if not exists nivel_interes text;

alter table public.clientes
  add column if not exists estado_lead text;

alter table public.clientes
  add column if not exists proxima_accion text;

alter table public.clientes
  add column if not exists fecha_proximo_seguimiento date;

alter table public.clientes
  add column if not exists estado_cita text;

create table if not exists public.leads_publicos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  lote_id bigint references public.las_lomas_lotes(id) on delete set null,
  asesor_id uuid references public.profiles(id) on delete set null,
  nombre_completo text not null,
  celular_normalizado text not null,
  correo_normalizado text,
  mensaje text,
  origen text not null default 'COTIZADOR_WEB',
  estado text not null default 'NUEVO'
    check (estado in ('NUEVO', 'ATENDIDO', 'DESCARTADO')),
  cliente_reutilizado boolean not null default false,
  acepta_datos boolean not null,
  acepta_comercial boolean not null default false,
  version_politica text not null default '2026-07-10',
  atendido_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_publicos_asesor_estado_idx
  on public.leads_publicos (asesor_id, estado, created_at desc);

create index if not exists leads_publicos_cliente_idx
  on public.leads_publicos (cliente_id, created_at desc);

create index if not exists leads_publicos_celular_lote_idx
  on public.leads_publicos (celular_normalizado, lote_id, created_at desc);

alter table public.leads_publicos enable row level security;

drop policy if exists "leads_publicos_staff_select"
  on public.leads_publicos;
create policy "leads_publicos_staff_select"
on public.leads_publicos
for select
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
);

drop policy if exists "leads_publicos_staff_update"
  on public.leads_publicos;
create policy "leads_publicos_staff_update"
on public.leads_publicos
for update
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
)
with check (
  public.is_crm_manager()
  or asesor_id = auth.uid()
);

revoke all on table public.leads_publicos from anon;
grant select, update on table public.leads_publicos to authenticated;

create or replace function public.crm_registrar_lead_publico(
  p_nombre_completo text,
  p_celular text,
  p_correo text default null,
  p_lote_id bigint default null,
  p_mensaje text default null,
  p_acepta_datos boolean default false,
  p_acepta_comercial boolean default false,
  p_origen text default 'COTIZADOR_WEB'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_celular text;
  v_correo text;
  v_mensaje text;
  v_origen text;
  v_cliente public.clientes%rowtype;
  v_lead public.leads_publicos%rowtype;
  v_asesor_id uuid;
  v_cliente_reutilizado boolean := false;
begin
  v_nombre := trim(coalesce(p_nombre_completo, ''));
  v_celular := regexp_replace(coalesce(p_celular, ''), '[^0-9]', '', 'g');
  v_correo := lower(nullif(trim(coalesce(p_correo, '')), ''));
  v_mensaje := nullif(left(trim(coalesce(p_mensaje, '')), 1500), '');
  v_origen := upper(trim(coalesce(p_origen, 'COTIZADOR_WEB')));

  if length(v_celular) = 11 and left(v_celular, 2) = '51' then
    v_celular := right(v_celular, 9);
  end if;

  if not coalesce(p_acepta_datos, false) then
    raise exception 'Debes aceptar el tratamiento de datos personales.';
  end if;

  if length(v_nombre) < 3 or length(v_nombre) > 120 then
    raise exception 'Ingresa un nombre completo valido.';
  end if;

  if v_celular !~ '^9[0-9]{8}$' then
    raise exception 'Ingresa un celular peruano valido de 9 digitos.';
  end if;

  if v_correo is not null
     and v_correo !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Ingresa un correo valido.';
  end if;

  if p_lote_id is null
     or not exists (
       select 1
       from public.las_lomas_lotes l
       where l.id = p_lote_id
     ) then
    raise exception 'El lote consultado no existe.';
  end if;

  if v_origen <> 'COTIZADOR_WEB' then
    v_origen := 'COTIZADOR_WEB';
  end if;

  -- Serializa el reparto para que dos solicitudes simultaneas no caigan
  -- siempre en el mismo asesor por una carrera de concurrencia.
  perform pg_advisory_xact_lock(hashtext('crm_leads_publicos_las_lomas'));

  select lp.*
  into v_lead
  from public.leads_publicos lp
  where lp.celular_normalizado = v_celular
    and lp.lote_id is not distinct from p_lote_id
    and lp.created_at >= now() - interval '15 minutes'
  order by lp.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'deduplicado', true
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
        fuente = coalesce(nullif(trim(fuente), ''), v_origen),
        asesor_id = v_asesor_id,
        lote_interes_id = p_lote_id,
        estado_lead = case
          when coalesce(estado_lead, '') in ('', 'PERDIDO', 'VENDIDO')
            then 'NUEVO'
          else estado_lead
        end,
        proxima_accion = 'ENVIAR_WHATSAPP',
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
      v_origen,
      v_mensaje,
      v_asesor_id,
      null,
      p_lote_id,
      'SIN_DEFINIR',
      'SIN_DEFINIR',
      'SIN_DEFINIR',
      'INFO_GENERAL',
      'WHATSAPP_RAPIDO',
      5,
      'FRIO',
      'NUEVO',
      'ENVIAR_WHATSAPP',
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
    cliente_reutilizado,
    acepta_datos,
    acepta_comercial
  )
  values (
    v_cliente.id,
    p_lote_id,
    v_asesor_id,
    v_nombre,
    v_celular,
    v_correo,
    v_mensaje,
    v_origen,
    v_cliente_reutilizado,
    true,
    coalesce(p_acepta_comercial, false)
  );

  return jsonb_build_object(
    'ok', true,
    'deduplicado', false,
    'cliente_reutilizado', v_cliente_reutilizado,
    'asignado', v_asesor_id is not null
  );
end;
$$;

revoke all on function public.crm_registrar_lead_publico(
  text, text, text, bigint, text, boolean, boolean, text
) from public;
revoke all on function public.crm_registrar_lead_publico(
  text, text, text, bigint, text, boolean, boolean, text
) from anon;
revoke all on function public.crm_registrar_lead_publico(
  text, text, text, bigint, text, boolean, boolean, text
) from authenticated;

grant execute on function public.crm_registrar_lead_publico(
  text, text, text, bigint, text, boolean, boolean, text
) to anon, authenticated;

create or replace function public.crm_marcar_lead_publico_atendido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads_publicos
  set estado = 'ATENDIDO',
      atendido_at = coalesce(atendido_at, now()),
      updated_at = now()
  where cliente_id = new.cliente_id
    and estado = 'NUEVO';

  return new;
end;
$$;

revoke all on function public.crm_marcar_lead_publico_atendido()
  from public;

do $$
begin
  if to_regclass('public.seguimientos_clientes') is not null then
    execute 'drop trigger if exists seguimientos_marcar_lead_publico_atendido
      on public.seguimientos_clientes';
    execute 'create trigger seguimientos_marcar_lead_publico_atendido
      after insert on public.seguimientos_clientes
      for each row execute function public.crm_marcar_lead_publico_atendido()';
  end if;
end;
$$;

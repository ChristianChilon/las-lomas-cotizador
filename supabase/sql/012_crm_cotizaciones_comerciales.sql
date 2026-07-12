-- 012_crm_cotizaciones_comerciales.sql
-- Cotizaciones versionadas, limites comerciales y conversion segura a separacion.
-- Ejecutar despues de 011_crm_catalogo_publico_seguro.sql.

alter table public.configuracion_comercial
  add column if not exists descuento_asesor_max_porcentaje numeric(5,2)
    not null default 5
    check (descuento_asesor_max_porcentaje between 0 and 30);

alter table public.configuracion_comercial
  add column if not exists vigencia_cotizacion_dias integer
    not null default 7
    check (vigencia_cotizacion_dias between 1 and 30);

alter table public.configuracion_comercial
  add column if not exists monto_separacion_referencial numeric(12,2)
    not null default 500
    check (monto_separacion_referencial >= 0);

alter table public.configuracion_comercial
  add column if not exists inicial_minima numeric(12,2)
    not null default 6000
    check (inicial_minima >= 0);

create sequence if not exists public.cotizaciones_numero_seq;

create or replace function public.crm_siguiente_numero_cotizacion()
returns text
language sql
security definer
set search_path = public
as $$
  select format(
    'COT-%s-%s',
    to_char(current_date, 'YYYY'),
    lpad(nextval('public.cotizaciones_numero_seq')::text, 6, '0')
  );
$$;

revoke all on function public.crm_siguiente_numero_cotizacion() from public;

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default public.crm_siguiente_numero_cotizacion(),
  grupo_id uuid not null default gen_random_uuid(),
  version integer not null default 1 check (version >= 1),
  cotizacion_anterior_id uuid references public.cotizaciones(id) on delete set null,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  lote_id bigint not null references public.las_lomas_lotes(id) on delete restrict,
  asesor_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  estado text not null default 'BORRADOR'
    check (estado in (
      'PENDIENTE_APROBACION', 'BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA',
      'VENCIDA', 'ANULADA', 'REEMPLAZADA', 'CONVERTIDA'
    )),
  precio_lista numeric(12,2) not null check (precio_lista > 0),
  precio_ofertado numeric(12,2) not null check (precio_ofertado > 0),
  descuento_monto numeric(12,2) not null default 0 check (descuento_monto >= 0),
  descuento_porcentaje numeric(6,3) not null default 0
    check (descuento_porcentaje between 0 and 100),
  monto_separacion numeric(12,2) not null default 500
    check (monto_separacion >= 0),
  inicial numeric(12,2) not null check (inicial >= 0),
  meses integer not null check (meses between 1 and 60),
  saldo_financiar numeric(12,2) not null check (saldo_financiar >= 0),
  cuota_mensual numeric(12,2) not null check (cuota_mensual >= 0),
  valida_hasta date not null,
  observaciones text,
  aprobacion_solicitada_at timestamptz,
  aprobada_por uuid references public.profiles(id) on delete set null,
  aprobada_at timestamptz,
  enviada_at timestamptz,
  aceptada_at timestamptz,
  rechazada_at timestamptz,
  convertida_at timestamptz,
  separacion_id uuid unique references public.separaciones(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grupo_id, version),
  check (precio_ofertado <= precio_lista),
  check (inicial <= precio_ofertado),
  check (monto_separacion <= inicial)
);

create index if not exists cotizaciones_asesor_estado_idx
  on public.cotizaciones (asesor_id, estado, created_at desc);

create index if not exists cotizaciones_cliente_idx
  on public.cotizaciones (cliente_id, created_at desc);

create index if not exists cotizaciones_lote_idx
  on public.cotizaciones (lote_id, created_at desc);

create index if not exists cotizaciones_vigencia_idx
  on public.cotizaciones (valida_hasta, estado);

drop trigger if exists cotizaciones_set_updated_at on public.cotizaciones;
create trigger cotizaciones_set_updated_at
before update on public.cotizaciones
for each row execute function public.set_updated_at();

alter table public.cotizaciones enable row level security;

drop policy if exists "cotizaciones_staff_select" on public.cotizaciones;
create policy "cotizaciones_staff_select"
on public.cotizaciones
for select
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
);

revoke all on table public.cotizaciones from anon, authenticated;
grant select on table public.cotizaciones to authenticated;

create or replace function public.crm_crear_cotizacion(
  p_cliente_id uuid,
  p_lote_id bigint,
  p_precio_ofertado numeric,
  p_monto_separacion numeric,
  p_inicial numeric,
  p_meses integer,
  p_valida_hasta date default null,
  p_observaciones text default null,
  p_asesor_id uuid default null,
  p_cotizacion_anterior_id uuid default null
)
returns public.cotizaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_cliente public.clientes%rowtype;
  v_lote public.las_lomas_lotes%rowtype;
  v_config public.configuracion_comercial%rowtype;
  v_anterior public.cotizaciones%rowtype;
  v_cotizacion public.cotizaciones%rowtype;
  v_asesor_id uuid;
  v_precio_lista numeric(12,2);
  v_precio_ofertado numeric(12,2);
  v_descuento numeric(12,2);
  v_descuento_porcentaje numeric(6,3);
  v_saldo numeric(12,2);
  v_cuota numeric(12,2);
  v_valida_hasta date;
  v_grupo_id uuid := gen_random_uuid();
  v_version integer := 1;
  v_requiere_aprobacion boolean := false;
begin
  v_role := public.current_profile_role();

  if coalesce(v_role, '') not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para crear cotizaciones.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = p_cliente_id
  for update;

  if not found then
    raise exception 'El cliente indicado no existe.';
  end if;

  select * into v_lote
  from public.las_lomas_lotes
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'El lote indicado no existe.';
  end if;

  if v_lote.estado not in ('DISPONIBLE', 'EN_NEGOCIACION') then
    raise exception 'Solo se puede cotizar un lote disponible o en negociacion.';
  end if;

  if v_role = 'asesor' then
    v_asesor_id := auth.uid();

    if v_cliente.asesor_id is not null and v_cliente.asesor_id <> auth.uid() then
      raise exception 'Solo puedes cotizar para tus propios clientes.';
    end if;

    if v_lote.asesor_id is not null and v_lote.asesor_id <> auth.uid() then
      raise exception 'Este lote esta siendo gestionado por otro asesor.';
    end if;
  else
    v_asesor_id := coalesce(p_asesor_id, v_cliente.asesor_id);
  end if;

  if v_asesor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_asesor_id
      and p.role = 'asesor'
      and p.active = true
  ) then
    raise exception 'Selecciona un asesor activo para la cotizacion.';
  end if;

  select * into v_config
  from public.configuracion_comercial
  where project_key = 'las_lomas';

  if not found then
    raise exception 'Falta configurar las reglas comerciales del proyecto.';
  end if;

  v_precio_lista := round(v_lote.precio::numeric, 2);
  v_precio_ofertado := round(coalesce(p_precio_ofertado, 0), 2);

  if v_precio_ofertado <= 0 or v_precio_ofertado > v_precio_lista then
    raise exception 'El precio ofertado debe ser mayor a cero y no superar el precio de lista.';
  end if;

  v_descuento := round(v_precio_lista - v_precio_ofertado, 2);
  v_descuento_porcentaje := round((v_descuento / v_precio_lista) * 100, 3);

  if v_role = 'asesor'
     and v_descuento_porcentaje > v_config.descuento_asesor_max_porcentaje then
    v_requiere_aprobacion := true;
  end if;

  if v_descuento_porcentaje > 30 then
    raise exception 'El descuento no puede superar el 30 por ciento.';
  end if;

  if p_inicial is null
     or p_inicial < 0
     or p_inicial > v_precio_ofertado then
    raise exception 'La inicial no es valida para el precio ofertado.';
  end if;

  if v_role = 'asesor'
     and p_inicial < least(v_config.inicial_minima, v_precio_ofertado) then
    raise exception 'La inicial minima autorizada es S/ %.', v_config.inicial_minima;
  end if;

  if p_monto_separacion is null
     or p_monto_separacion < 0
     or p_monto_separacion > p_inicial then
    raise exception 'El monto de separacion debe estar entre cero y la inicial.';
  end if;

  if v_role = 'asesor'
     and p_monto_separacion < v_config.monto_separacion_referencial then
    raise exception 'El monto minimo de separacion es S/ %.',
      v_config.monto_separacion_referencial;
  end if;

  if coalesce(p_meses, 0) < 1 or p_meses > 60 then
    raise exception 'El plazo debe estar entre 1 y 60 meses.';
  end if;

  v_valida_hasta := coalesce(
    p_valida_hasta,
    current_date + v_config.vigencia_cotizacion_dias
  );

  if v_valida_hasta < current_date or v_valida_hasta > current_date + 30 then
    raise exception 'La vigencia debe estar entre hoy y los proximos 30 dias.';
  end if;

  if p_cotizacion_anterior_id is not null then
    select * into v_anterior
    from public.cotizaciones
    where id = p_cotizacion_anterior_id
    for update;

    if not found then
      raise exception 'La cotizacion anterior no existe.';
    end if;

    if v_anterior.cliente_id <> p_cliente_id or v_anterior.lote_id <> p_lote_id then
      raise exception 'La nueva version debe conservar cliente y lote.';
    end if;

    if v_role = 'asesor' and v_anterior.asesor_id <> auth.uid() then
      raise exception 'No puedes versionar una cotizacion de otro asesor.';
    end if;

    if v_anterior.estado in ('ACEPTADA', 'CONVERTIDA', 'ANULADA') then
      raise exception 'Esta cotizacion ya no admite nuevas versiones.';
    end if;

    v_grupo_id := v_anterior.grupo_id;
    select coalesce(max(c.version), 0) + 1 into v_version
    from public.cotizaciones c
    where c.grupo_id = v_grupo_id;
  end if;

  v_saldo := round(greatest(v_precio_ofertado - p_inicial, 0), 2);
  v_cuota := round(v_saldo / p_meses, 2);

  insert into public.cotizaciones (
    grupo_id, version, cotizacion_anterior_id,
    cliente_id, lote_id, asesor_id, created_by,
    precio_lista, precio_ofertado, descuento_monto,
    descuento_porcentaje, monto_separacion, inicial,
    meses, saldo_financiar, cuota_mensual,
    valida_hasta, observaciones, estado, aprobacion_solicitada_at
  ) values (
    v_grupo_id, v_version, p_cotizacion_anterior_id,
    p_cliente_id, p_lote_id, v_asesor_id, auth.uid(),
    v_precio_lista, v_precio_ofertado, v_descuento,
    v_descuento_porcentaje, round(p_monto_separacion, 2), round(p_inicial, 2),
    p_meses, v_saldo, v_cuota,
    v_valida_hasta, nullif(trim(coalesce(p_observaciones, '')), ''),
    case when v_requiere_aprobacion then 'PENDIENTE_APROBACION' else 'BORRADOR' end,
    case when v_requiere_aprobacion then now() else null end
  ) returning * into v_cotizacion;

  if p_cotizacion_anterior_id is not null then
    update public.cotizaciones
    set estado = 'REEMPLAZADA', updated_at = now()
    where id = p_cotizacion_anterior_id;
  end if;

  update public.clientes
  set asesor_id = v_asesor_id,
      lote_interes_id = p_lote_id,
      estado_lead = case
        when coalesce(estado_lead, '') in ('SEPARADO', 'VENDIDO') then estado_lead
        else 'NEGOCIANDO'
      end,
      proxima_accion = case
        when coalesce(estado_lead, '') in ('SEPARADO', 'VENDIDO') then proxima_accion
        when v_requiere_aprobacion then coalesce(proxima_accion, 'CONTACTAR')
        else 'ENVIAR_FICHA'
      end,
      fecha_proximo_seguimiento = current_date,
      updated_at = now()
  where id = p_cliente_id;

  return v_cotizacion;
end;
$$;

create or replace function public.crm_actualizar_estado_cotizacion(
  p_cotizacion_id uuid,
  p_estado text
)
returns public.cotizaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_actual public.cotizaciones%rowtype;
  v_nuevo text := upper(trim(coalesce(p_estado, '')));
begin
  v_role := public.current_profile_role();

  select * into v_actual
  from public.cotizaciones
  where id = p_cotizacion_id
  for update;

  if not found then
    raise exception 'La cotizacion no existe.';
  end if;

  if coalesce(v_role, '') not in ('admin', 'jefe_ventas', 'asesor')
     or (v_role = 'asesor' and v_actual.asesor_id <> auth.uid()) then
    raise exception 'No tienes permisos sobre esta cotizacion.';
  end if;

  if not (
    (v_actual.estado = 'PENDIENTE_APROBACION' and v_nuevo in ('BORRADOR', 'RECHAZADA'))
    or (v_actual.estado = 'BORRADOR' and v_nuevo in ('ENVIADA', 'ANULADA'))
    or (v_actual.estado = 'ENVIADA' and v_nuevo in ('ACEPTADA', 'RECHAZADA', 'VENCIDA', 'ANULADA'))
    or (v_actual.estado = 'VENCIDA' and v_nuevo = 'ANULADA')
    or (v_actual.estado = 'RECHAZADA' and v_nuevo = 'ANULADA')
  ) then
    raise exception 'Transicion de cotizacion no permitida: % a %.',
      v_actual.estado, v_nuevo;
  end if;

  if v_actual.estado = 'PENDIENTE_APROBACION'
     and v_role not in ('admin', 'jefe_ventas') then
    raise exception 'Solo gerencia puede resolver descuentos excepcionales.';
  end if;

  if v_nuevo = 'VENCIDA'
     and v_actual.valida_hasta >= current_date
     and v_role = 'asesor' then
    raise exception 'La cotizacion aun se encuentra vigente.';
  end if;

  update public.cotizaciones
  set estado = v_nuevo,
      enviada_at = case when v_nuevo = 'ENVIADA' then now() else enviada_at end,
      aceptada_at = case when v_nuevo = 'ACEPTADA' then now() else aceptada_at end,
      rechazada_at = case when v_nuevo = 'RECHAZADA' then now() else rechazada_at end,
      aprobada_por = case
        when v_actual.estado = 'PENDIENTE_APROBACION' and v_nuevo = 'BORRADOR'
          then auth.uid()
        else aprobada_por
      end,
      aprobada_at = case
        when v_actual.estado = 'PENDIENTE_APROBACION' and v_nuevo = 'BORRADOR'
          then now()
        else aprobada_at
      end,
      updated_at = now()
  where id = p_cotizacion_id
  returning * into v_actual;

  if v_nuevo = 'BORRADOR' and v_actual.aprobada_at is not null then
    update public.clientes
    set proxima_accion = case when estado_lead in ('SEPARADO', 'VENDIDO') then proxima_accion else 'ENVIAR_FICHA' end,
        fecha_proximo_seguimiento = current_date,
        updated_at = now()
    where id = v_actual.cliente_id;
  elsif v_nuevo = 'ENVIADA' then
    update public.clientes
    set estado_lead = case when estado_lead in ('SEPARADO', 'VENDIDO') then estado_lead else 'NEGOCIANDO' end,
        proxima_accion = case when estado_lead in ('SEPARADO', 'VENDIDO') then proxima_accion else 'VOLVER_A_CONTACTAR' end,
        fecha_proximo_seguimiento = current_date + 1,
        updated_at = now()
    where id = v_actual.cliente_id;
  elsif v_nuevo = 'ACEPTADA' then
    update public.clientes
    set estado_lead = case when estado_lead in ('SEPARADO', 'VENDIDO') then estado_lead else 'NEGOCIANDO' end,
        proxima_accion = case when estado_lead in ('SEPARADO', 'VENDIDO') then proxima_accion else 'ENVIAR_FICHA' end,
        fecha_proximo_seguimiento = current_date,
        updated_at = now()
    where id = v_actual.cliente_id;
  elsif v_nuevo = 'RECHAZADA' then
    update public.clientes
    set estado_lead = case when estado_lead in ('SEPARADO', 'VENDIDO') then estado_lead else 'SEGUIMIENTO' end,
        proxima_accion = case when estado_lead in ('SEPARADO', 'VENDIDO') then proxima_accion else 'VOLVER_A_CONTACTAR' end,
        updated_at = now()
    where id = v_actual.cliente_id;
  end if;

  return v_actual;
end;
$$;

create or replace function public.crm_convertir_cotizacion_en_separacion(
  p_cotizacion_id uuid,
  p_fecha_limite date default null,
  p_observaciones text default null
)
returns public.separaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_cotizacion public.cotizaciones%rowtype;
  v_lote public.las_lomas_lotes%rowtype;
  v_separacion public.separaciones%rowtype;
  v_estado_anterior text;
begin
  v_role := public.current_profile_role();

  select * into v_cotizacion
  from public.cotizaciones
  where id = p_cotizacion_id
  for update;

  if not found then
    raise exception 'La cotizacion no existe.';
  end if;

  if coalesce(v_role, '') not in ('admin', 'jefe_ventas', 'asesor')
     or (v_role = 'asesor' and v_cotizacion.asesor_id <> auth.uid()) then
    raise exception 'No tienes permisos para convertir esta cotizacion.';
  end if;

  if v_cotizacion.estado <> 'ACEPTADA' then
    raise exception 'La cotizacion debe estar aceptada antes de separar.';
  end if;

  if v_cotizacion.valida_hasta < current_date and v_role = 'asesor' then
    raise exception 'La cotizacion vencio. Crea una nueva version.';
  end if;

  select * into v_lote
  from public.las_lomas_lotes
  where id = v_cotizacion.lote_id
  for update;

  if not found then
    raise exception 'El lote de la cotizacion no existe.';
  end if;

  v_estado_anterior := v_lote.estado;

  if v_estado_anterior not in ('DISPONIBLE', 'EN_NEGOCIACION') then
    raise exception 'El lote ya no esta disponible para separacion.';
  end if;

  if v_role = 'asesor'
     and v_lote.asesor_id is not null
     and v_lote.asesor_id <> auth.uid() then
    raise exception 'Este lote esta asignado a otro asesor.';
  end if;

  if exists (
    select 1
    from public.separaciones s
    where s.lote_id = v_cotizacion.lote_id
      and s.estado = 'ACTIVA'
  ) then
    raise exception 'El lote ya tiene una separacion activa.';
  end if;

  insert into public.separaciones (
    lote_id, cliente_id, asesor_id, monto_separacion,
    fecha_limite, estado, observaciones
  ) values (
    v_cotizacion.lote_id,
    v_cotizacion.cliente_id,
    v_cotizacion.asesor_id,
    v_cotizacion.monto_separacion,
    coalesce(p_fecha_limite, current_date + 7),
    'ACTIVA',
    concat_ws(E'\n',
      'Origen: ' || v_cotizacion.numero || ' v' || v_cotizacion.version,
      nullif(trim(coalesce(p_observaciones, '')), '')
    )
  ) returning * into v_separacion;

  update public.las_lomas_lotes
  set estado = 'SEPARADO',
      cliente_id = v_cotizacion.cliente_id,
      asesor_id = v_cotizacion.asesor_id,
      updated_at = now()
  where id = v_cotizacion.lote_id;

  update public.clientes
  set lote_interes_id = null,
      asesor_id = v_cotizacion.asesor_id,
      estado_lead = 'SEPARADO',
      proxima_accion = 'ESPERAR_PAGO',
      updated_at = now()
  where id = v_cotizacion.cliente_id;

  update public.cotizaciones
  set estado = 'CONVERTIDA',
      separacion_id = v_separacion.id,
      convertida_at = now(),
      updated_at = now()
  where id = v_cotizacion.id;

  insert into public.historial_lotes (
    lote_id, estado_anterior, estado_nuevo, cambiado_por, motivo
  ) values (
    v_cotizacion.lote_id,
    v_estado_anterior,
    'SEPARADO',
    auth.uid(),
    'Cotizacion aceptada y convertida en separacion: ' || v_cotizacion.numero
  );

  return v_separacion;
end;
$$;

revoke all on function public.crm_crear_cotizacion(
  uuid, bigint, numeric, numeric, numeric, integer,
  date, text, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.crm_crear_cotizacion(
  uuid, bigint, numeric, numeric, numeric, integer,
  date, text, uuid, uuid
) to authenticated;

revoke all on function public.crm_actualizar_estado_cotizacion(uuid, text)
  from public, anon, authenticated;
grant execute on function public.crm_actualizar_estado_cotizacion(uuid, text)
  to authenticated;

revoke all on function public.crm_convertir_cotizacion_en_separacion(uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.crm_convertir_cotizacion_en_separacion(uuid, date, text)
  to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.cotizaciones;
exception
  when duplicate_object then null;
end $$;

comment on table public.cotizaciones is
  'Propuestas comerciales versionadas. No reservan inventario hasta convertirse en separacion.';

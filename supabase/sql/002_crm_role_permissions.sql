-- CRM inmobiliario - permisos reales por rol
-- Ejecutar despues de 001_crm_first_stage.sql.
-- No cambia la estructura principal de public.las_lomas_lotes.

create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin';
$$;

alter table public.profiles
  alter column active set default false;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_select_managers" on public.profiles;
create policy "profiles_select_managers"
on public.profiles
for select
to authenticated
using (public.is_crm_manager());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_crm_admin())
with check (public.is_crm_admin());

drop policy if exists "lotes_staff_update" on public.las_lomas_lotes;
drop policy if exists "lotes_manager_update" on public.las_lomas_lotes;
create policy "lotes_manager_update"
on public.las_lomas_lotes
for update
to authenticated
using (public.is_crm_manager())
with check (public.is_crm_manager());

drop policy if exists "clientes_staff_select" on public.clientes;
drop policy if exists "clientes_role_select" on public.clientes;
create policy "clientes_role_select"
on public.clientes
for select
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
);

drop policy if exists "clientes_staff_insert" on public.clientes;
drop policy if exists "clientes_role_insert" on public.clientes;
create policy "clientes_role_insert"
on public.clientes
for insert
to authenticated
with check (
  public.is_crm_manager()
  or (
    public.current_profile_role() = 'asesor'
    and asesor_id = auth.uid()
    and created_by = auth.uid()
  )
);

drop policy if exists "clientes_staff_update" on public.clientes;
drop policy if exists "clientes_role_update" on public.clientes;
create policy "clientes_role_update"
on public.clientes
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

drop policy if exists "separaciones_staff_select" on public.separaciones;
drop policy if exists "separaciones_role_select" on public.separaciones;
create policy "separaciones_role_select"
on public.separaciones
for select
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
);

drop policy if exists "separaciones_staff_insert" on public.separaciones;
drop policy if exists "separaciones_role_insert" on public.separaciones;
create policy "separaciones_role_insert"
on public.separaciones
for insert
to authenticated
with check (
  public.is_crm_manager()
  or (
    public.current_profile_role() = 'asesor'
    and asesor_id = auth.uid()
    and exists (
      select 1
      from public.clientes c
      where c.id = cliente_id
        and c.asesor_id = auth.uid()
    )
  )
);

drop policy if exists "separaciones_staff_update" on public.separaciones;
drop policy if exists "separaciones_admin_update" on public.separaciones;
create policy "separaciones_admin_update"
on public.separaciones
for update
to authenticated
using (public.is_crm_admin())
with check (public.is_crm_admin());

drop policy if exists "historial_staff_select" on public.historial_lotes;
drop policy if exists "historial_role_select" on public.historial_lotes;
create policy "historial_role_select"
on public.historial_lotes
for select
to authenticated
using (
  public.is_crm_manager()
  or cambiado_por = auth.uid()
);

drop policy if exists "historial_staff_insert" on public.historial_lotes;

create or replace function public.crm_cambiar_estado_lote(
  p_lote_id bigint,
  p_estado_nuevo text,
  p_motivo text default null,
  p_asesor_id uuid default null,
  p_cliente_id uuid default null
)
returns public.las_lomas_lotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_lote public.las_lomas_lotes%rowtype;
  v_lote_actualizado public.las_lomas_lotes%rowtype;
begin
  v_role := public.current_profile_role();
  p_estado_nuevo := upper(trim(p_estado_nuevo));

  if v_role not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para cambiar lotes.';
  end if;

  if p_estado_nuevo not in (
    'DISPONIBLE',
    'EN_NEGOCIACION',
    'SEPARADO',
    'VENDIDO',
    'BLOQUEADO'
  ) then
    raise exception 'Estado de lote no permitido.';
  end if;

  select *
  into v_lote
  from public.las_lomas_lotes
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'El lote indicado no existe.';
  end if;

  if v_lote.estado = p_estado_nuevo then
    return v_lote;
  end if;

  if v_role = 'asesor' then
    if p_estado_nuevo in ('VENDIDO', 'BLOQUEADO') then
      raise exception 'Un asesor no puede marcar lotes como vendido o bloqueado.';
    end if;

    if v_lote.asesor_id is not null
       and v_lote.asesor_id <> auth.uid() then
      raise exception 'Este lote esta asignado a otro asesor.';
    end if;

    if not (
      (v_lote.estado = 'DISPONIBLE'
        and p_estado_nuevo in ('EN_NEGOCIACION', 'SEPARADO'))
      or
      (v_lote.estado = 'EN_NEGOCIACION'
        and p_estado_nuevo in ('DISPONIBLE', 'SEPARADO'))
    ) then
      raise exception 'Flujo de estado no permitido para asesor.';
    end if;

    update public.las_lomas_lotes
    set estado = p_estado_nuevo,
        asesor_id = case
          when p_estado_nuevo = 'DISPONIBLE' then null
          else auth.uid()
        end,
        cliente_id = case
          when p_estado_nuevo = 'DISPONIBLE' then null
          else cliente_id
        end,
        updated_at = now()
    where id = p_lote_id
    returning * into v_lote_actualizado;
  else
    if p_asesor_id is not null
       and not exists (
        select 1
        from public.profiles p
        where p.id = p_asesor_id
          and p.role = 'asesor'
          and p.active = true
       ) then
      raise exception 'El asesor asignado no existe o no esta activo.';
    end if;

    update public.las_lomas_lotes
    set estado = p_estado_nuevo,
        asesor_id = case
          when p_estado_nuevo = 'DISPONIBLE'
               and p_asesor_id is null then null
          else coalesce(p_asesor_id, asesor_id)
        end,
        cliente_id = case
          when p_estado_nuevo = 'DISPONIBLE' then null
          else coalesce(p_cliente_id, cliente_id)
        end,
        updated_at = now()
    where id = p_lote_id
    returning * into v_lote_actualizado;
  end if;

  insert into public.historial_lotes (
    lote_id,
    estado_anterior,
    estado_nuevo,
    cambiado_por,
    motivo
  )
  values (
    p_lote_id,
    v_lote.estado,
    p_estado_nuevo,
    auth.uid(),
    coalesce(p_motivo, 'Cambio de estado desde CRM')
  );

  return v_lote_actualizado;
end;
$$;

create or replace function public.crm_asignar_lote(
  p_lote_id bigint,
  p_asesor_id uuid default null,
  p_motivo text default null
)
returns public.las_lomas_lotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.las_lomas_lotes%rowtype;
  v_lote_actualizado public.las_lomas_lotes%rowtype;
begin
  if not public.is_crm_manager() then
    raise exception 'Solo admin o jefe de ventas puede asignar lotes.';
  end if;

  if p_asesor_id is not null
     and not exists (
      select 1
      from public.profiles p
      where p.id = p_asesor_id
        and p.role = 'asesor'
        and p.active = true
     ) then
    raise exception 'El asesor asignado no existe o no esta activo.';
  end if;

  select *
  into v_lote
  from public.las_lomas_lotes
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'El lote indicado no existe.';
  end if;

  update public.las_lomas_lotes
  set asesor_id = p_asesor_id,
      updated_at = now()
  where id = p_lote_id
  returning * into v_lote_actualizado;

  insert into public.historial_lotes (
    lote_id,
    estado_anterior,
    estado_nuevo,
    cambiado_por,
    motivo
  )
  values (
    p_lote_id,
    v_lote.estado,
    v_lote.estado,
    auth.uid(),
    coalesce(p_motivo, 'Asignacion de asesor')
  );

  return v_lote_actualizado;
end;
$$;

drop function if exists public.crm_crear_separacion(
  bigint,
  uuid,
  numeric,
  date,
  text
);

drop function if exists public.crm_crear_separacion(
  bigint,
  uuid,
  numeric,
  date,
  text,
  uuid
);

create function public.crm_crear_separacion(
  p_lote_id bigint,
  p_cliente_id uuid,
  p_monto numeric default null,
  p_fecha_limite date default null,
  p_observaciones text default null,
  p_asesor_id uuid default null
)
returns public.separaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_estado_anterior text;
  v_lote public.las_lomas_lotes%rowtype;
  v_cliente public.clientes%rowtype;
  v_asesor_id uuid;
  v_separacion public.separaciones%rowtype;
begin
  v_role := public.current_profile_role();

  if v_role not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para crear separaciones.';
  end if;

  select *
  into v_cliente
  from public.clientes
  where id = p_cliente_id
  for update;

  if not found then
    raise exception 'El cliente indicado no existe.';
  end if;

  if v_role = 'asesor' then
    if v_cliente.asesor_id is distinct from auth.uid() then
      raise exception 'Solo puedes separar lotes para tus propios clientes.';
    end if;

    v_asesor_id := auth.uid();
  else
    v_asesor_id := coalesce(p_asesor_id, v_cliente.asesor_id);

    if v_asesor_id is null then
      raise exception 'Selecciona un asesor para la separacion.';
    end if;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_asesor_id
      and p.role = 'asesor'
      and p.active = true
  ) then
    raise exception 'El asesor asignado no existe o no esta activo.';
  end if;

  select *
  into v_lote
  from public.las_lomas_lotes
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'El lote indicado no existe.';
  end if;

  v_estado_anterior := v_lote.estado;

  if v_estado_anterior not in ('DISPONIBLE', 'EN_NEGOCIACION') then
    raise exception 'El lote no esta disponible para separacion.';
  end if;

  if v_role = 'asesor'
     and v_lote.asesor_id is not null
     and v_lote.asesor_id <> auth.uid() then
    raise exception 'Este lote esta asignado a otro asesor.';
  end if;

  update public.clientes
  set asesor_id = v_asesor_id,
      updated_at = now()
  where id = p_cliente_id;

  insert into public.separaciones (
    lote_id,
    cliente_id,
    asesor_id,
    monto_separacion,
    fecha_limite,
    estado,
    observaciones
  )
  values (
    p_lote_id,
    p_cliente_id,
    v_asesor_id,
    p_monto,
    p_fecha_limite,
    'ACTIVA',
    p_observaciones
  )
  returning * into v_separacion;

  update public.las_lomas_lotes
  set estado = 'SEPARADO',
      cliente_id = p_cliente_id,
      asesor_id = v_asesor_id,
      updated_at = now()
  where id = p_lote_id;

  insert into public.historial_lotes (
    lote_id,
    estado_anterior,
    estado_nuevo,
    cambiado_por,
    motivo
  )
  values (
    p_lote_id,
    v_estado_anterior,
    'SEPARADO',
    auth.uid(),
    'Separacion creada desde CRM'
  );

  return v_separacion;
end;
$$;

create or replace function public.crm_anular_separacion(
  p_separacion_id uuid,
  p_motivo text default null
)
returns public.separaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_separacion public.separaciones%rowtype;
  v_lote public.las_lomas_lotes%rowtype;
  v_actualizada public.separaciones%rowtype;
begin
  if not public.is_crm_admin() then
    raise exception 'Solo admin puede anular separaciones.';
  end if;

  select *
  into v_separacion
  from public.separaciones
  where id = p_separacion_id
  for update;

  if not found then
    raise exception 'La separacion indicada no existe.';
  end if;

  if v_separacion.estado <> 'ACTIVA' then
    raise exception 'Solo se pueden anular separaciones activas.';
  end if;

  update public.separaciones
  set estado = 'CANCELADA',
      updated_at = now(),
      observaciones = concat_ws(
        E'\n',
        observaciones,
        coalesce(p_motivo, 'Separacion anulada desde CRM')
      )
  where id = p_separacion_id
  returning * into v_actualizada;

  if v_separacion.lote_id is not null then
    select *
    into v_lote
    from public.las_lomas_lotes
    where id = v_separacion.lote_id
    for update;

    if found then
      update public.las_lomas_lotes
      set estado = 'DISPONIBLE',
          cliente_id = null,
          asesor_id = null,
          updated_at = now()
      where id = v_separacion.lote_id;

      insert into public.historial_lotes (
        lote_id,
        estado_anterior,
        estado_nuevo,
        cambiado_por,
        motivo
      )
      values (
        v_separacion.lote_id,
        v_lote.estado,
        'DISPONIBLE',
        auth.uid(),
        coalesce(p_motivo, 'Separacion anulada desde CRM')
      );
    end if;
  end if;

  return v_actualizada;
end;
$$;

revoke all on function public.crm_cambiar_estado_lote(
  bigint,
  text,
  text,
  uuid,
  uuid
) from public;

revoke all on function public.crm_asignar_lote(
  bigint,
  uuid,
  text
) from public;

revoke all on function public.crm_crear_separacion(
  bigint,
  uuid,
  numeric,
  date,
  text,
  uuid
) from public;

revoke all on function public.crm_anular_separacion(
  uuid,
  text
) from public;

grant execute on function public.crm_cambiar_estado_lote(
  bigint,
  text,
  text,
  uuid,
  uuid
) to authenticated;

grant execute on function public.crm_asignar_lote(
  bigint,
  uuid,
  text
) to authenticated;

grant execute on function public.crm_crear_separacion(
  bigint,
  uuid,
  numeric,
  date,
  text,
  uuid
) to authenticated;

grant execute on function public.crm_anular_separacion(
  uuid,
  text
) to authenticated;

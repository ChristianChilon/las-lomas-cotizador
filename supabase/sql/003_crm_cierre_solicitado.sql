-- 003_crm_cierre_solicitado.sql
-- Flujo profesional de cierre:
-- asesor solicita cierre, admin/jefe de ventas aprueba venta.

alter table public.las_lomas_lotes
  drop constraint if exists las_lomas_lotes_estado_crm_check;

alter table public.las_lomas_lotes
  add constraint las_lomas_lotes_estado_crm_check
  check (
    estado in (
      'DISPONIBLE',
      'EN_NEGOCIACION',
      'SEPARADO',
      'CIERRE_SOLICITADO',
      'VENDIDO',
      'BLOQUEADO',
      'RESERVADO'
    )
  );

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
    'CIERRE_SOLICITADO',
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
        and p_estado_nuevo in (
          'EN_NEGOCIACION',
          'SEPARADO',
          'CIERRE_SOLICITADO'
        ))
      or
      (v_lote.estado = 'EN_NEGOCIACION'
        and p_estado_nuevo in (
          'DISPONIBLE',
          'SEPARADO',
          'CIERRE_SOLICITADO'
        ))
      or
      (v_lote.estado = 'SEPARADO'
        and p_estado_nuevo = 'CIERRE_SOLICITADO')
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

    if p_estado_nuevo = 'VENDIDO' then
      update public.separaciones
      set estado = 'CONVERTIDA',
          updated_at = now()
      where lote_id = p_lote_id
        and estado = 'ACTIVA';
    end if;
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

create or replace function public.crm_aprobar_cierre_lote(
  p_lote_id bigint,
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
    raise exception 'Solo admin o jefe de ventas puede aprobar cierres.';
  end if;

  select *
  into v_lote
  from public.las_lomas_lotes
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'El lote indicado no existe.';
  end if;

  if v_lote.estado <> 'CIERRE_SOLICITADO' then
    raise exception 'Solo se pueden aprobar lotes con cierre solicitado.';
  end if;

  update public.las_lomas_lotes
  set estado = 'VENDIDO',
      updated_at = now()
  where id = p_lote_id
  returning * into v_lote_actualizado;

  update public.separaciones
  set estado = 'CONVERTIDA',
      updated_at = now()
  where lote_id = p_lote_id
    and estado = 'ACTIVA';

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
    'VENDIDO',
    auth.uid(),
    coalesce(p_motivo, 'Cierre aprobado desde CRM')
  );

  return v_lote_actualizado;
end;
$$;

revoke all on function public.crm_aprobar_cierre_lote(
  bigint,
  text
) from public;

grant execute on function public.crm_aprobar_cierre_lote(
  bigint,
  text
) to authenticated;


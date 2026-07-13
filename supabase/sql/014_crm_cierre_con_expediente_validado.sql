-- 014_crm_cierre_con_expediente_validado.sql
-- Protege el cierre de venta con reglas de base de datos:
-- 1) un cierre solo nace desde un lote separado con separacion activa;
-- 2) una venta solo se aprueba con expediente y documentos validados;
-- 3) gerencia puede devolver el cierre a separado sin perder la separacion.
-- Ejecutar despues de 013_crm_expedientes_separacion.sql.

create or replace function public.crm_validar_transicion_cierre_lote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_separacion_id uuid;
  v_cliente_id uuid;
  v_asesor_id uuid;
  v_tiene_separacion_activa boolean := false;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  select
    s.id,
    s.cliente_id,
    s.asesor_id
  into
    v_separacion_id,
    v_cliente_id,
    v_asesor_id
  from public.separaciones s
  where s.lote_id = old.id
    and s.estado = 'ACTIVA'
  order by s.created_at desc
  limit 1;

  v_tiene_separacion_activa := found;

  if old.estado = 'VENDIDO' then
    raise exception 'Un lote vendido no puede cambiarse desde el selector general.';
  end if;

  if new.estado = 'CIERRE_SOLICITADO' then
    if old.estado <> 'SEPARADO' then
      raise exception 'Primero registra el comprador y crea la separacion del lote.';
    end if;

    if not v_tiene_separacion_activa then
      raise exception 'No existe una separacion activa para solicitar el cierre.';
    end if;

    if new.cliente_id is distinct from v_cliente_id
       or new.asesor_id is distinct from v_asesor_id then
      raise exception 'El cliente y asesor del lote no coinciden con la separacion activa.';
    end if;

    return new;
  end if;

  if new.estado = 'VENDIDO' then
    if old.estado <> 'CIERRE_SOLICITADO' then
      raise exception 'La venta debe pasar primero por cierre solicitado.';
    end if;

    if not v_tiene_separacion_activa then
      raise exception 'No existe una separacion activa vinculada a esta venta.';
    end if;

    if not exists (
      select 1
      from public.separacion_expedientes e
      where e.separacion_id = v_separacion_id
        and e.estado = 'VALIDADO'
        and coalesce(e.pago_monto, 0) > 0
        and e.pago_fecha is not null
        and nullif(trim(coalesce(e.pago_banco, '')), '') is not null
        and nullif(trim(coalesce(e.pago_operacion, '')), '') is not null
    ) then
      raise exception 'El expediente de la separacion debe estar validado antes de aprobar la venta.';
    end if;

    if not exists (
      select 1
      from public.separacion_documentos d
      where d.separacion_id = v_separacion_id
        and d.tipo = 'DNI'
        and d.estado = 'VALIDADO'
    ) then
      raise exception 'El DNI validado es obligatorio para aprobar la venta.';
    end if;

    if not exists (
      select 1
      from public.separacion_documentos d
      where d.separacion_id = v_separacion_id
        and d.tipo in ('VOUCHER_SEPARACION', 'VOUCHER_INICIAL')
        and d.estado = 'VALIDADO'
    ) then
      raise exception 'El voucher validado es obligatorio para aprobar la venta.';
    end if;

    return new;
  end if;

  if old.estado = 'SEPARADO'
     and v_tiene_separacion_activa then
    raise exception 'La separacion activa debe cerrarse o anularse desde su flujo correspondiente.';
  end if;

  if old.estado = 'CIERRE_SOLICITADO'
     and v_tiene_separacion_activa
     and new.estado <> 'SEPARADO' then
    raise exception 'El cierre solo puede aprobarse o devolverse a separado.';
  end if;

  return new;
end;
$$;

drop trigger if exists las_lomas_lotes_validar_cierre
  on public.las_lomas_lotes;

create trigger las_lomas_lotes_validar_cierre
before update of estado on public.las_lomas_lotes
for each row
execute function public.crm_validar_transicion_cierre_lote();

revoke all on function public.crm_validar_transicion_cierre_lote()
  from public, anon, authenticated;

create or replace function public.crm_devolver_cierre_lote(
  p_lote_id bigint,
  p_motivo text
)
returns public.las_lomas_lotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.las_lomas_lotes%rowtype;
  v_lote_actualizado public.las_lomas_lotes%rowtype;
  v_estado_destino text;
  v_tiene_separacion_activa boolean;
begin
  if not public.is_crm_manager() then
    raise exception 'Solo admin o jefe de ventas puede devolver cierres.';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Indica el motivo para devolver el cierre.';
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
    raise exception 'Solo se pueden devolver lotes con cierre solicitado.';
  end if;

  select exists (
    select 1
    from public.separaciones s
    where s.lote_id = p_lote_id
      and s.estado = 'ACTIVA'
  ) into v_tiene_separacion_activa;

  -- Los cierres antiguos creados antes del expediente pueden no tener
  -- separacion. Se regularizan a disponible para no dejarlos bloqueados.
  v_estado_destino := case
    when v_tiene_separacion_activa then 'SEPARADO'
    else 'DISPONIBLE'
  end;

  update public.las_lomas_lotes
  set estado = v_estado_destino,
      cliente_id = case
        when v_tiene_separacion_activa then cliente_id
        else null
      end,
      asesor_id = case
        when v_tiene_separacion_activa then asesor_id
        else null
      end,
      updated_at = now()
  where id = p_lote_id
  returning * into v_lote_actualizado;

  insert into public.historial_lotes (
    lote_id,
    estado_anterior,
    estado_nuevo,
    cambiado_por,
    motivo
  ) values (
    p_lote_id,
    v_lote.estado,
    v_estado_destino,
    auth.uid(),
    trim(p_motivo)
  );

  return v_lote_actualizado;
end;
$$;

revoke all on function public.crm_devolver_cierre_lote(bigint, text)
  from public, anon, authenticated;
grant execute on function public.crm_devolver_cierre_lote(bigint, text)
  to authenticated;

comment on function public.crm_validar_transicion_cierre_lote() is
  'Impide cierres sin separacion y ventas sin expediente documental validado.';

comment on function public.crm_devolver_cierre_lote(bigint, text) is
  'Devuelve un cierre a separado; regulariza a disponible los cierres antiguos sin separacion.';

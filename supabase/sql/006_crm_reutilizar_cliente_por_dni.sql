-- 006_crm_reutilizar_cliente_por_dni.sql
-- Evita crear clientes duplicados cuando una misma persona separa varios lotes.
-- Regla: si existe un cliente con el mismo DNI normalizado, se reutiliza y se crea
-- una nueva separacion asociada a ese cliente.

create index if not exists clientes_dni_normalizado_idx
on public.clientes (
  (regexp_replace(coalesce(dni, ''), '\D', '', 'g'))
);

create or replace function public.crm_crear_cliente_y_separacion(
  p_lote_id bigint,
  p_nombres text,
  p_apellidos text default null,
  p_dni text default null,
  p_celular text default null,
  p_correo text default null,
  p_direccion text default null,
  p_fuente text default null,
  p_observaciones text default null,
  p_monto numeric default null,
  p_fecha_limite date default null,
  p_asesor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_lote public.las_lomas_lotes%rowtype;
  v_cliente public.clientes%rowtype;
  v_separacion public.separaciones%rowtype;
  v_asesor_id uuid;
  v_estado_anterior text;
  v_dni_normalizado text;
  v_cliente_reutilizado boolean := false;
begin
  v_role := public.current_profile_role();

  if v_role not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para crear separaciones.';
  end if;

  if nullif(trim(coalesce(p_nombres, '')), '') is null then
    raise exception 'Ingresa los nombres del cliente.';
  end if;

  if nullif(trim(coalesce(p_celular, '')), '') is null then
    raise exception 'Ingresa el celular del cliente.';
  end if;

  v_dni_normalizado := nullif(
    regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'),
    ''
  );

  if v_dni_normalizado is null then
    raise exception 'Ingresa el DNI del cliente.';
  end if;

  if v_role = 'asesor' then
    v_asesor_id := auth.uid();
  else
    v_asesor_id := p_asesor_id;

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

  select *
  into v_cliente
  from public.clientes c
  where regexp_replace(coalesce(c.dni, ''), '\D', '', 'g') = v_dni_normalizado
  order by c.created_at asc
  limit 1
  for update;

  if found then
    v_cliente_reutilizado := true;

    if v_role = 'asesor'
       and v_cliente.asesor_id is not null
       and v_cliente.asesor_id <> auth.uid() then
      raise exception 'Este DNI ya esta registrado con otro asesor. Solicita reasignacion a gerencia.';
    end if;

    update public.clientes
    set nombres = coalesce(nullif(trim(coalesce(p_nombres, '')), ''), nombres),
        apellidos = coalesce(nullif(trim(coalesce(p_apellidos, '')), ''), apellidos),
        celular = coalesce(nullif(trim(coalesce(p_celular, '')), ''), celular),
        correo = coalesce(nullif(trim(coalesce(p_correo, '')), ''), correo),
        direccion = coalesce(nullif(trim(coalesce(p_direccion, '')), ''), direccion),
        fuente = coalesce(nullif(trim(coalesce(p_fuente, '')), ''), fuente),
        observaciones = coalesce(observaciones, nullif(trim(coalesce(p_observaciones, '')), '')),
        asesor_id = case
          when v_role in ('admin', 'jefe_ventas') then v_asesor_id
          else coalesce(asesor_id, v_asesor_id)
        end,
        created_by = coalesce(created_by, auth.uid()),
        updated_at = now()
    where id = v_cliente.id
    returning * into v_cliente;
  else
    insert into public.clientes (
      nombres,
      apellidos,
      dni,
      celular,
      correo,
      direccion,
      fuente,
      observaciones,
      asesor_id,
      created_by
    )
    values (
      trim(p_nombres),
      nullif(trim(coalesce(p_apellidos, '')), ''),
      nullif(trim(coalesce(p_dni, '')), ''),
      trim(p_celular),
      nullif(trim(coalesce(p_correo, '')), ''),
      nullif(trim(coalesce(p_direccion, '')), ''),
      nullif(trim(coalesce(p_fuente, '')), ''),
      nullif(trim(coalesce(p_observaciones, '')), ''),
      v_asesor_id,
      auth.uid()
    )
    returning * into v_cliente;
  end if;

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
    v_cliente.id,
    v_asesor_id,
    p_monto,
    p_fecha_limite,
    'ACTIVA',
    p_observaciones
  )
  returning * into v_separacion;

  update public.las_lomas_lotes
  set estado = 'SEPARADO',
      cliente_id = v_cliente.id,
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
    case
      when v_cliente_reutilizado then 'Separacion creada reutilizando cliente existente por DNI'
      else 'Cliente y separacion creados desde ficha directa'
    end
  );

  return jsonb_build_object(
    'cliente_id', v_cliente.id,
    'separacion_id', v_separacion.id,
    'cliente_reutilizado', v_cliente_reutilizado
  );
end;
$$;

revoke all on function public.crm_crear_cliente_y_separacion(
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  date,
  uuid
) from public;

grant execute on function public.crm_crear_cliente_y_separacion(
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  date,
  uuid
) to authenticated;

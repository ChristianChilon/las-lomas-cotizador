-- 013_crm_expedientes_separacion.sql
-- Expediente privado de separacion: documentos, pago reportado y revision gerencial.
-- Tambien conserva en el repositorio la solicitud de liberacion usada por el CRM.
-- Ejecutar despues de 012_crm_cotizaciones_comerciales.sql.

alter table public.separaciones
  add column if not exists liberacion_solicitada boolean not null default false;

alter table public.separaciones
  add column if not exists motivo_liberacion text;

alter table public.separaciones
  add column if not exists fecha_solicitud_liberacion timestamptz;

alter table public.separaciones
  add column if not exists solicitado_liberacion_por uuid
    references public.profiles(id) on delete set null;

alter table public.separaciones
  add column if not exists fecha_liberacion_resuelta timestamptz;

alter table public.separaciones
  add column if not exists resuelto_liberacion_por uuid
    references public.profiles(id) on delete set null;

-- La funcion pudo haber sido creada manualmente con otro tipo de retorno.
-- PostgreSQL exige eliminar esa firma antes de poder redefinirla.
drop function if exists public.crm_solicitar_liberacion_separacion(uuid, text);

create or replace function public.crm_solicitar_liberacion_separacion(
  p_separacion_id uuid,
  p_motivo text
)
returns public.separaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_separacion public.separaciones%rowtype;
begin
  v_role := public.current_profile_role();

  if coalesce(v_role, '') not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para solicitar liberaciones.';
  end if;

  select * into v_separacion
  from public.separaciones
  where id = p_separacion_id
  for update;

  if not found then
    raise exception 'La separacion indicada no existe.';
  end if;

  if v_role = 'asesor'
     and v_separacion.asesor_id is distinct from auth.uid() then
    raise exception 'Solo puedes solicitar la liberacion de tus separaciones.';
  end if;

  if v_separacion.estado <> 'ACTIVA' then
    raise exception 'Solo se puede liberar una separacion activa.';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Explica brevemente el motivo de la liberacion.';
  end if;

  update public.separaciones
  set liberacion_solicitada = true,
      motivo_liberacion = trim(p_motivo),
      fecha_solicitud_liberacion = now(),
      solicitado_liberacion_por = auth.uid(),
      fecha_liberacion_resuelta = null,
      resuelto_liberacion_por = null,
      updated_at = now()
  where id = p_separacion_id
  returning * into v_separacion;

  return v_separacion;
end;
$$;

revoke all on function public.crm_solicitar_liberacion_separacion(uuid, text)
  from public, anon, authenticated;
grant execute on function public.crm_solicitar_liberacion_separacion(uuid, text)
  to authenticated;

create table if not exists public.separacion_expedientes (
  separacion_id uuid primary key
    references public.separaciones(id) on delete cascade,
  cliente_id uuid not null
    references public.clientes(id) on delete restrict,
  lote_id bigint not null
    references public.las_lomas_lotes(id) on delete restrict,
  asesor_id uuid
    references public.profiles(id) on delete set null,
  estado text not null default 'INCOMPLETO'
    check (estado in ('INCOMPLETO', 'EN_REVISION', 'VALIDADO', 'OBSERVADO')),
  pago_monto numeric(12,2)
    check (pago_monto is null or pago_monto >= 0),
  pago_fecha date,
  pago_banco text,
  pago_operacion text,
  observaciones text,
  enviado_revision_at timestamptz,
  revisado_por uuid references public.profiles(id) on delete set null,
  revisado_at timestamptz,
  motivo_revision text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.separacion_documentos (
  id uuid primary key default gen_random_uuid(),
  separacion_id uuid not null
    references public.separaciones(id) on delete cascade,
  cliente_id uuid not null
    references public.clientes(id) on delete restrict,
  lote_id bigint not null
    references public.las_lomas_lotes(id) on delete restrict,
  asesor_id uuid
    references public.profiles(id) on delete set null,
  tipo text not null
    check (tipo in (
      'DNI', 'VOUCHER_SEPARACION', 'VOUCHER_INICIAL', 'CONTRATO', 'OTRO'
    )),
  storage_path text not null unique,
  nombre_archivo text not null,
  mime_type text not null,
  tamano_bytes bigint not null
    check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE', 'EN_REVISION', 'VALIDADO', 'RECHAZADO')),
  observaciones text,
  subido_por uuid references public.profiles(id) on delete set null,
  revisado_por uuid references public.profiles(id) on delete set null,
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists separacion_expedientes_estado_idx
  on public.separacion_expedientes (estado, updated_at desc);

create index if not exists separacion_expedientes_asesor_idx
  on public.separacion_expedientes (asesor_id, estado, updated_at desc);

create index if not exists separacion_documentos_separacion_idx
  on public.separacion_documentos (separacion_id, created_at desc);

drop trigger if exists separacion_expedientes_set_updated_at
  on public.separacion_expedientes;
create trigger separacion_expedientes_set_updated_at
before update on public.separacion_expedientes
for each row execute function public.set_updated_at();

drop trigger if exists separacion_documentos_set_updated_at
  on public.separacion_documentos;
create trigger separacion_documentos_set_updated_at
before update on public.separacion_documentos
for each row execute function public.set_updated_at();

alter table public.separacion_expedientes enable row level security;
alter table public.separacion_documentos enable row level security;

drop policy if exists "separacion_expedientes_staff_select"
  on public.separacion_expedientes;
create policy "separacion_expedientes_staff_select"
on public.separacion_expedientes
for select
to authenticated
using (public.is_crm_manager() or asesor_id = auth.uid());

drop policy if exists "separacion_documentos_staff_select"
  on public.separacion_documentos;
create policy "separacion_documentos_staff_select"
on public.separacion_documentos
for select
to authenticated
using (public.is_crm_manager() or asesor_id = auth.uid());

drop policy if exists "separacion_documentos_staff_delete"
  on public.separacion_documentos;
create policy "separacion_documentos_staff_delete"
on public.separacion_documentos
for delete
to authenticated
using (
  public.is_crm_manager()
  or (
    asesor_id = auth.uid()
    and subido_por = auth.uid()
    and estado <> 'VALIDADO'
  )
);

revoke all on table public.separacion_expedientes from anon, authenticated;
revoke all on table public.separacion_documentos from anon, authenticated;
grant select on table public.separacion_expedientes to authenticated;
grant select, delete on table public.separacion_documentos to authenticated;
grant all on table public.separacion_expedientes to service_role;
grant all on table public.separacion_documentos to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'crm-expedientes',
  'crm-expedientes',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "crm_expedientes_storage_select" on storage.objects;
create policy "crm_expedientes_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'crm-expedientes'
  and exists (
    select 1
    from public.separaciones s
    where s.id::text = split_part(name, '/', 1)
      and (public.is_crm_manager() or s.asesor_id = auth.uid())
  )
);

drop policy if exists "crm_expedientes_storage_insert" on storage.objects;
create policy "crm_expedientes_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crm-expedientes'
  and exists (
    select 1
    from public.separaciones s
    where s.id::text = split_part(name, '/', 1)
      and (public.is_crm_manager() or s.asesor_id = auth.uid())
  )
);

drop policy if exists "crm_expedientes_storage_delete" on storage.objects;
create policy "crm_expedientes_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crm-expedientes'
  and exists (
    select 1
    from public.separaciones s
    where s.id::text = split_part(name, '/', 1)
      and (public.is_crm_manager() or s.asesor_id = auth.uid())
  )
);

create or replace function public.crm_guardar_expediente_separacion(
  p_separacion_id uuid,
  p_pago_monto numeric,
  p_pago_fecha date,
  p_pago_banco text,
  p_pago_operacion text,
  p_observaciones text default null
)
returns public.separacion_expedientes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_separacion public.separaciones%rowtype;
  v_expediente public.separacion_expedientes%rowtype;
begin
  v_role := public.current_profile_role();

  if coalesce(v_role, '') not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para gestionar expedientes.';
  end if;

  select * into v_separacion
  from public.separaciones
  where id = p_separacion_id
  for update;

  if not found then
    raise exception 'La separacion indicada no existe.';
  end if;

  if v_role = 'asesor'
     and v_separacion.asesor_id is distinct from auth.uid() then
    raise exception 'Solo puedes gestionar tus propios expedientes.';
  end if;

  select * into v_expediente
  from public.separacion_expedientes
  where separacion_id = p_separacion_id
  for update;

  if found and v_expediente.estado = 'VALIDADO' then
    raise exception 'El expediente ya fue validado y no admite cambios.';
  end if;

  if p_pago_monto is not null and p_pago_monto < 0 then
    raise exception 'El monto reportado no puede ser negativo.';
  end if;

  insert into public.separacion_expedientes (
    separacion_id,
    cliente_id,
    lote_id,
    asesor_id,
    estado,
    pago_monto,
    pago_fecha,
    pago_banco,
    pago_operacion,
    observaciones,
    created_by
  )
  values (
    v_separacion.id,
    v_separacion.cliente_id,
    v_separacion.lote_id,
    v_separacion.asesor_id,
    'INCOMPLETO',
    p_pago_monto,
    p_pago_fecha,
    nullif(trim(coalesce(p_pago_banco, '')), ''),
    nullif(trim(coalesce(p_pago_operacion, '')), ''),
    nullif(trim(coalesce(p_observaciones, '')), ''),
    auth.uid()
  )
  on conflict (separacion_id) do update
  set pago_monto = excluded.pago_monto,
      pago_fecha = excluded.pago_fecha,
      pago_banco = excluded.pago_banco,
      pago_operacion = excluded.pago_operacion,
      observaciones = excluded.observaciones,
      estado = 'INCOMPLETO',
      enviado_revision_at = null,
      revisado_por = null,
      revisado_at = null,
      motivo_revision = null,
      updated_at = now()
  returning * into v_expediente;

  return v_expediente;
end;
$$;

create or replace function public.crm_registrar_documento_separacion(
  p_separacion_id uuid,
  p_tipo text,
  p_storage_path text,
  p_nombre_archivo text,
  p_mime_type text,
  p_tamano_bytes bigint
)
returns public.separacion_documentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_tipo text := upper(trim(coalesce(p_tipo, '')));
  v_separacion public.separaciones%rowtype;
  v_expediente public.separacion_expedientes%rowtype;
  v_documento public.separacion_documentos%rowtype;
begin
  v_role := public.current_profile_role();

  if coalesce(v_role, '') not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para adjuntar documentos.';
  end if;

  select * into v_separacion
  from public.separaciones
  where id = p_separacion_id
  for update;

  if not found then
    raise exception 'La separacion indicada no existe.';
  end if;

  if v_role = 'asesor'
     and v_separacion.asesor_id is distinct from auth.uid() then
    raise exception 'Solo puedes adjuntar documentos a tus separaciones.';
  end if;

  if v_tipo not in (
    'DNI', 'VOUCHER_SEPARACION', 'VOUCHER_INICIAL', 'CONTRATO', 'OTRO'
  ) then
    raise exception 'Tipo de documento no permitido.';
  end if;

  if p_storage_path is null
     or split_part(p_storage_path, '/', 1) <> p_separacion_id::text then
    raise exception 'La ruta del documento no corresponde a la separacion.';
  end if;

  if p_mime_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  ) then
    raise exception 'Formato de archivo no permitido.';
  end if;

  if coalesce(p_tamano_bytes, 0) <= 0 or p_tamano_bytes > 10485760 then
    raise exception 'El archivo debe pesar como maximo 10 MB.';
  end if;

  select * into v_expediente
  from public.separacion_expedientes
  where separacion_id = p_separacion_id
  for update;

  if found and v_expediente.estado = 'VALIDADO' then
    raise exception 'El expediente ya fue validado y no admite documentos nuevos.';
  end if;

  if not found then
    insert into public.separacion_expedientes (
      separacion_id, cliente_id, lote_id, asesor_id, created_by
    ) values (
      v_separacion.id,
      v_separacion.cliente_id,
      v_separacion.lote_id,
      v_separacion.asesor_id,
      auth.uid()
    );
  else
    update public.separacion_expedientes
    set estado = 'INCOMPLETO',
        enviado_revision_at = null,
        revisado_por = null,
        revisado_at = null,
        motivo_revision = null,
        updated_at = now()
    where separacion_id = p_separacion_id;
  end if;

  insert into public.separacion_documentos (
    separacion_id,
    cliente_id,
    lote_id,
    asesor_id,
    tipo,
    storage_path,
    nombre_archivo,
    mime_type,
    tamano_bytes,
    estado,
    subido_por
  ) values (
    v_separacion.id,
    v_separacion.cliente_id,
    v_separacion.lote_id,
    v_separacion.asesor_id,
    v_tipo,
    trim(p_storage_path),
    trim(p_nombre_archivo),
    trim(p_mime_type),
    p_tamano_bytes,
    'PENDIENTE',
    auth.uid()
  ) returning * into v_documento;

  return v_documento;
end;
$$;

create or replace function public.crm_eliminar_documento_separacion(
  p_documento_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_documento public.separacion_documentos%rowtype;
begin
  v_role := public.current_profile_role();

  select * into v_documento
  from public.separacion_documentos
  where id = p_documento_id
  for update;

  if not found then
    raise exception 'El documento indicado no existe.';
  end if;

  if not public.is_crm_manager()
     and not (
       v_role = 'asesor'
       and v_documento.asesor_id = auth.uid()
       and v_documento.subido_por = auth.uid()
       and v_documento.estado <> 'VALIDADO'
     ) then
    raise exception 'No tienes permisos para eliminar este documento.';
  end if;

  if v_documento.estado = 'VALIDADO' then
    raise exception 'Un documento validado no se puede eliminar.';
  end if;

  delete from public.separacion_documentos
  where id = p_documento_id;

  update public.separacion_expedientes
  set estado = 'INCOMPLETO',
      enviado_revision_at = null,
      revisado_por = null,
      revisado_at = null,
      motivo_revision = null,
      updated_at = now()
  where separacion_id = v_documento.separacion_id;

  return v_documento.storage_path;
end;
$$;

create or replace function public.crm_enviar_expediente_revision(
  p_separacion_id uuid
)
returns public.separacion_expedientes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_separacion public.separaciones%rowtype;
  v_expediente public.separacion_expedientes%rowtype;
begin
  v_role := public.current_profile_role();

  select * into v_separacion
  from public.separaciones
  where id = p_separacion_id
  for update;

  if not found then
    raise exception 'La separacion indicada no existe.';
  end if;

  if coalesce(v_role, '') not in ('admin', 'jefe_ventas', 'asesor')
     or (
       v_role = 'asesor'
       and v_separacion.asesor_id is distinct from auth.uid()
     ) then
    raise exception 'No tienes permisos para enviar este expediente.';
  end if;

  if v_separacion.estado <> 'ACTIVA' then
    raise exception 'Solo una separacion activa puede enviarse a revision.';
  end if;

  select * into v_expediente
  from public.separacion_expedientes
  where separacion_id = p_separacion_id
  for update;

  if not found then
    raise exception 'Primero registra los datos del pago.';
  end if;

  if coalesce(v_expediente.pago_monto, 0) <= 0
     or v_expediente.pago_fecha is null
     or trim(coalesce(v_expediente.pago_banco, '')) = ''
     or trim(coalesce(v_expediente.pago_operacion, '')) = '' then
    raise exception 'Completa monto, fecha, banco y numero de operacion.';
  end if;

  if not exists (
    select 1 from public.separacion_documentos d
    where d.separacion_id = p_separacion_id
      and d.tipo = 'DNI'
      and d.estado <> 'RECHAZADO'
  ) then
    raise exception 'Adjunta el DNI del comprador.';
  end if;

  if not exists (
    select 1 from public.separacion_documentos d
    where d.separacion_id = p_separacion_id
      and d.tipo in ('VOUCHER_SEPARACION', 'VOUCHER_INICIAL')
      and d.estado <> 'RECHAZADO'
  ) then
    raise exception 'Adjunta el voucher de separacion o inicial.';
  end if;

  update public.separacion_documentos
  set estado = 'EN_REVISION',
      revisado_por = null,
      revisado_at = null,
      updated_at = now()
  where separacion_id = p_separacion_id
    and estado = 'PENDIENTE';

  update public.separacion_expedientes
  set estado = 'EN_REVISION',
      enviado_revision_at = now(),
      revisado_por = null,
      revisado_at = null,
      motivo_revision = null,
      updated_at = now()
  where separacion_id = p_separacion_id
  returning * into v_expediente;

  return v_expediente;
end;
$$;

create or replace function public.crm_revisar_expediente_separacion(
  p_separacion_id uuid,
  p_estado text,
  p_motivo text default null
)
returns public.separacion_expedientes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text := upper(trim(coalesce(p_estado, '')));
  v_expediente public.separacion_expedientes%rowtype;
begin
  if not public.is_crm_manager() then
    raise exception 'Solo gerencia puede revisar expedientes.';
  end if;

  if v_estado not in ('VALIDADO', 'OBSERVADO') then
    raise exception 'Resultado de revision no permitido.';
  end if;

  select * into v_expediente
  from public.separacion_expedientes
  where separacion_id = p_separacion_id
  for update;

  if not found then
    raise exception 'El expediente indicado no existe.';
  end if;

  if v_expediente.estado <> 'EN_REVISION' then
    raise exception 'El expediente debe estar en revision.';
  end if;

  if v_estado = 'OBSERVADO'
     and length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Indica el motivo de la observacion.';
  end if;

  update public.separacion_expedientes
  set estado = v_estado,
      revisado_por = auth.uid(),
      revisado_at = now(),
      motivo_revision = case
        when v_estado = 'OBSERVADO' then trim(p_motivo)
        else null
      end,
      updated_at = now()
  where separacion_id = p_separacion_id
  returning * into v_expediente;

  update public.separacion_documentos
  set estado = case
        when v_estado = 'VALIDADO' then 'VALIDADO'
        else 'RECHAZADO'
      end,
      revisado_por = auth.uid(),
      revisado_at = now(),
      observaciones = case
        when v_estado = 'OBSERVADO' then trim(p_motivo)
        else observaciones
      end,
      updated_at = now()
  where separacion_id = p_separacion_id
    and estado = 'EN_REVISION';

  return v_expediente;
end;
$$;

revoke all on function public.crm_guardar_expediente_separacion(
  uuid, numeric, date, text, text, text
) from public, anon, authenticated;
grant execute on function public.crm_guardar_expediente_separacion(
  uuid, numeric, date, text, text, text
) to authenticated;

revoke all on function public.crm_registrar_documento_separacion(
  uuid, text, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.crm_registrar_documento_separacion(
  uuid, text, text, text, text, bigint
) to authenticated;

revoke all on function public.crm_eliminar_documento_separacion(uuid)
  from public, anon, authenticated;
grant execute on function public.crm_eliminar_documento_separacion(uuid)
  to authenticated;

revoke all on function public.crm_enviar_expediente_revision(uuid)
  from public, anon, authenticated;
grant execute on function public.crm_enviar_expediente_revision(uuid)
  to authenticated;

revoke all on function public.crm_revisar_expediente_separacion(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.crm_revisar_expediente_separacion(uuid, text, text)
  to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.separacion_expedientes;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.separacion_documentos;
exception
  when duplicate_object then null;
end $$;

comment on table public.separacion_expedientes is
  'Control privado del pago y revision documental de cada separacion.';

comment on table public.separacion_documentos is
  'Archivos privados del expediente de separacion almacenados en Supabase Storage.';

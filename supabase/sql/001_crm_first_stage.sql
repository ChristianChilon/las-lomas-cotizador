-- CRM inmobiliario - primera etapa
-- Proyecto Las Lomas de Malabrigo
-- Tabla publica de lotes existente confirmada: public.las_lomas_lotes
-- Importante: public.las_lomas_lotes.id es bigint/int8, no uuid.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'asesor'
    check (role in ('admin', 'jefe_ventas', 'asesor')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombres text not null,
  apellidos text,
  dni text,
  celular text not null,
  correo text,
  direccion text,
  fuente text,
  observaciones text,
  asesor_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.separaciones (
  id uuid primary key default gen_random_uuid(),
  lote_id bigint references public.las_lomas_lotes(id) on delete set null,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  asesor_id uuid references public.profiles(id) on delete set null,
  monto_separacion numeric,
  fecha_limite date,
  estado text not null default 'ACTIVA'
    check (estado in ('ACTIVA', 'VENCIDA', 'CANCELADA', 'CONVERTIDA')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.historial_lotes (
  id uuid primary key default gen_random_uuid(),
  lote_id bigint references public.las_lomas_lotes(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text,
  cambiado_por uuid references public.profiles(id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

alter table public.las_lomas_lotes
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

alter table public.las_lomas_lotes
  add column if not exists asesor_id uuid references public.profiles(id) on delete set null;

alter table public.las_lomas_lotes
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'las_lomas_lotes_estado_crm_check'
      and conrelid = 'public.las_lomas_lotes'::regclass
  ) then
    alter table public.las_lomas_lotes
      add constraint las_lomas_lotes_estado_crm_check
      check (
        estado in (
          'DISPONIBLE',
          'EN_NEGOCIACION',
          'SEPARADO',
          'VENDIDO',
          'BLOQUEADO',
          'RESERVADO'
        )
      );
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
before update on public.clientes
for each row execute function public.set_updated_at();

drop trigger if exists separaciones_set_updated_at on public.separaciones;
create trigger separaciones_set_updated_at
before update on public.separaciones
for each row execute function public.set_updated_at();

drop trigger if exists las_lomas_lotes_set_updated_at on public.las_lomas_lotes;
create trigger las_lomas_lotes_set_updated_at
before update on public.las_lomas_lotes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    active
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'asesor',
    false
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1;
$$;

create or replace function public.is_crm_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'jefe_ventas', 'asesor');
$$;

create or replace function public.is_crm_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'jefe_ventas');
$$;

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.separaciones enable row level security;
alter table public.historial_lotes enable row level security;
alter table public.las_lomas_lotes enable row level security;

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
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "lotes_public_select" on public.las_lomas_lotes;
create policy "lotes_public_select"
on public.las_lomas_lotes
for select
to anon, authenticated
using (true);

drop policy if exists "lotes_staff_update" on public.las_lomas_lotes;
create policy "lotes_staff_update"
on public.las_lomas_lotes
for update
to authenticated
using (public.is_crm_staff())
with check (public.is_crm_staff());

drop policy if exists "clientes_staff_select" on public.clientes;
create policy "clientes_staff_select"
on public.clientes
for select
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "clientes_staff_insert" on public.clientes;
create policy "clientes_staff_insert"
on public.clientes
for insert
to authenticated
with check (
  public.is_crm_staff()
  and (
    public.is_crm_manager()
    or asesor_id = auth.uid()
    or created_by = auth.uid()
  )
);

drop policy if exists "clientes_staff_update" on public.clientes;
create policy "clientes_staff_update"
on public.clientes
for update
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.is_crm_manager()
  or asesor_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "separaciones_staff_select" on public.separaciones;
create policy "separaciones_staff_select"
on public.separaciones
for select
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
);

drop policy if exists "separaciones_staff_insert" on public.separaciones;
create policy "separaciones_staff_insert"
on public.separaciones
for insert
to authenticated
with check (
  public.is_crm_staff()
  and (
    public.is_crm_manager()
    or asesor_id = auth.uid()
  )
);

drop policy if exists "separaciones_staff_update" on public.separaciones;
create policy "separaciones_staff_update"
on public.separaciones
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

drop policy if exists "historial_staff_select" on public.historial_lotes;
create policy "historial_staff_select"
on public.historial_lotes
for select
to authenticated
using (public.is_crm_staff());

drop policy if exists "historial_staff_insert" on public.historial_lotes;
create policy "historial_staff_insert"
on public.historial_lotes
for insert
to authenticated
with check (public.is_crm_staff());

create or replace function public.crm_crear_separacion(
  p_lote_id bigint,
  p_cliente_id uuid,
  p_monto numeric default null,
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
  v_estado_anterior text;
  v_separacion public.separaciones;
begin
  v_role := public.current_profile_role();

  if v_role not in ('admin', 'jefe_ventas', 'asesor') then
    raise exception 'No tienes permisos para crear separaciones.';
  end if;

  select estado
  into v_estado_anterior
  from public.las_lomas_lotes
  where id = p_lote_id
  for update;

  if v_estado_anterior is null then
    raise exception 'El lote indicado no existe.';
  end if;

  if v_estado_anterior not in ('DISPONIBLE', 'EN_NEGOCIACION') then
    raise exception 'El lote no esta disponible para separacion.';
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
    p_cliente_id,
    auth.uid(),
    p_monto,
    p_fecha_limite,
    'ACTIVA',
    p_observaciones
  )
  returning * into v_separacion;

  update public.las_lomas_lotes
  set estado = 'SEPARADO',
      cliente_id = p_cliente_id,
      asesor_id = auth.uid(),
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

grant execute on function public.crm_crear_separacion(
  bigint,
  uuid,
  numeric,
  date,
  text
) to authenticated;

-- Para crear el primer administrador:
-- 1. Crea el usuario desde Authentication > Users.
-- 2. Copia su UUID.
-- 3. Ejecuta esto en el SQL Editor, cambiando los datos:
--
-- insert into public.profiles (id, full_name, email, role, active)
-- values ('UUID_DEL_USUARIO', 'Administrador', 'correo@dominio.com', 'admin', true)
-- on conflict (id) do update
-- set full_name = excluded.full_name,
--     email = excluded.email,
--     role = 'admin',
--     active = true;

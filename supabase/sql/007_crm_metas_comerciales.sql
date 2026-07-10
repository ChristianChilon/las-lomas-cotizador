-- 007_crm_metas_comerciales.sql
-- Metas mensuales por asesor para el centro de control comercial.
-- Ejecutar despues de 001 y 002. No modifica public.las_lomas_lotes.

create extension if not exists pgcrypto;

create table if not exists public.metas_comerciales (
  id uuid primary key default gen_random_uuid(),
  periodo date not null,
  asesor_id uuid not null references public.profiles(id) on delete cascade,
  meta_clientes integer not null default 0 check (meta_clientes >= 0),
  meta_seguimientos integer not null default 0 check (meta_seguimientos >= 0),
  meta_separaciones integer not null default 0 check (meta_separaciones >= 0),
  meta_ventas integer not null default 0 check (meta_ventas >= 0),
  meta_monto_ventas numeric(14, 2) not null default 0
    check (meta_monto_ventas >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metas_comerciales_periodo_inicio_mes_check
    check (periodo = date_trunc('month', periodo)::date)
);

create unique index if not exists metas_comerciales_periodo_asesor_idx
  on public.metas_comerciales (periodo, asesor_id);

create index if not exists metas_comerciales_asesor_idx
  on public.metas_comerciales (asesor_id, periodo desc);

drop trigger if exists metas_comerciales_set_updated_at
  on public.metas_comerciales;
create trigger metas_comerciales_set_updated_at
before update on public.metas_comerciales
for each row execute function public.set_updated_at();

alter table public.metas_comerciales enable row level security;

drop policy if exists "metas_select_por_rol"
  on public.metas_comerciales;
create policy "metas_select_por_rol"
on public.metas_comerciales
for select
to authenticated
using (
  public.is_crm_manager()
  or asesor_id = auth.uid()
);

drop policy if exists "metas_insert_gerencia"
  on public.metas_comerciales;
create policy "metas_insert_gerencia"
on public.metas_comerciales
for insert
to authenticated
with check (
  public.is_crm_manager()
  and created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = asesor_id
      and p.role = 'asesor'
      and p.active = true
  )
);

drop policy if exists "metas_update_gerencia"
  on public.metas_comerciales;
create policy "metas_update_gerencia"
on public.metas_comerciales
for update
to authenticated
using (public.is_crm_manager())
with check (
  public.is_crm_manager()
  and exists (
    select 1
    from public.profiles p
    where p.id = asesor_id
      and p.role = 'asesor'
      and p.active = true
  )
);

drop policy if exists "metas_delete_gerencia"
  on public.metas_comerciales;
create policy "metas_delete_gerencia"
on public.metas_comerciales
for delete
to authenticated
using (public.is_crm_manager());

revoke all on table public.metas_comerciales from anon;
grant select, insert, update, delete
  on table public.metas_comerciales to authenticated;

comment on table public.metas_comerciales is
  'Objetivos comerciales mensuales por asesor. La meta de equipo es la suma de las metas individuales.';

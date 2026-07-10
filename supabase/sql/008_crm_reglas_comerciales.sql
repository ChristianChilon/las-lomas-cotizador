-- 008_crm_reglas_comerciales.sql
-- Reglas operativas para SLA de primer contacto y cadencias de seguimiento.
-- Ejecutar despues de 001, 002 y 007. No modifica public.las_lomas_lotes.

create table if not exists public.configuracion_comercial (
  project_key text primary key default 'las_lomas',
  sla_primer_contacto_minutos integer not null default 30
    check (sla_primer_contacto_minutos between 1 and 10080),
  cadencia_caliente_dias integer not null default 2
    check (cadencia_caliente_dias between 1 and 365),
  cadencia_tibio_dias integer not null default 4
    check (cadencia_tibio_dias between 1 and 365),
  cadencia_frio_dias integer not null default 7
    check (cadencia_frio_dias between 1 and 365),
  alerta_separacion_dias integer not null default 3
    check (alerta_separacion_dias between 1 and 30),
  hora_inicio time not null default '08:00',
  hora_fin time not null default '20:00',
  atender_sabado boolean not null default true,
  atender_domingo boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint configuracion_comercial_proyecto_check
    check (project_key = 'las_lomas'),
  constraint configuracion_comercial_horario_check
    check (hora_fin > hora_inicio)
);

insert into public.configuracion_comercial (project_key)
values ('las_lomas')
on conflict (project_key) do nothing;

drop trigger if exists configuracion_comercial_set_updated_at
  on public.configuracion_comercial;
create trigger configuracion_comercial_set_updated_at
before update on public.configuracion_comercial
for each row execute function public.set_updated_at();

alter table public.configuracion_comercial enable row level security;

drop policy if exists "configuracion_comercial_staff_select"
  on public.configuracion_comercial;
create policy "configuracion_comercial_staff_select"
on public.configuracion_comercial
for select
to authenticated
using (public.is_crm_staff());

drop policy if exists "configuracion_comercial_manager_insert"
  on public.configuracion_comercial;
create policy "configuracion_comercial_manager_insert"
on public.configuracion_comercial
for insert
to authenticated
with check (
  public.is_crm_manager()
  and project_key = 'las_lomas'
  and updated_by = auth.uid()
);

drop policy if exists "configuracion_comercial_manager_update"
  on public.configuracion_comercial;
create policy "configuracion_comercial_manager_update"
on public.configuracion_comercial
for update
to authenticated
using (public.is_crm_manager())
with check (
  public.is_crm_manager()
  and project_key = 'las_lomas'
  and updated_by = auth.uid()
);

revoke all on table public.configuracion_comercial from anon;
grant select, insert, update
  on table public.configuracion_comercial to authenticated;

comment on table public.configuracion_comercial is
  'Reglas editables de velocidad de atencion, cadencias por prioridad y alertas de separacion.';

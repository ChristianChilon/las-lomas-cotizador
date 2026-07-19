-- 015_crm_preparar_produccion.sql
-- Limpia exclusivamente datos operativos y de prueba antes del inicio de ventas.
-- Conserva usuarios, perfiles, configuracion comercial y el inventario maestro.

begin;

delete from public.separacion_documentos;
delete from public.separacion_expedientes;
delete from public.cotizaciones;
delete from public.meta_lead_events;
delete from public.leads_publicos;
delete from public.separaciones;
delete from public.seguimientos_clientes;
delete from public.metas_comerciales;

update public.las_lomas_lotes
set estado = 'DISPONIBLE',
    cliente_id = null,
    asesor_id = null,
    updated_at = now()
where estado is distinct from 'DISPONIBLE'
   or cliente_id is not null
   or asesor_id is not null;

delete from public.clientes;

-- El reinicio de lotes puede generar auditoria; la base productiva debe iniciar limpia.
delete from public.historial_lotes;

commit;

-- Verificacion posterior. Todos los datos operativos deben quedar en cero.
select 'profiles' as tabla, count(*)::bigint as registros
from public.profiles
union all
select 'configuracion_comercial', count(*)::bigint
from public.configuracion_comercial
union all
select 'clientes', count(*)::bigint
from public.clientes
union all
select 'seguimientos_clientes', count(*)::bigint
from public.seguimientos_clientes
union all
select 'separaciones', count(*)::bigint
from public.separaciones
union all
select 'separacion_expedientes', count(*)::bigint
from public.separacion_expedientes
union all
select 'separacion_documentos', count(*)::bigint
from public.separacion_documentos
union all
select 'cotizaciones', count(*)::bigint
from public.cotizaciones
union all
select 'leads_publicos', count(*)::bigint
from public.leads_publicos
union all
select 'meta_lead_events', count(*)::bigint
from public.meta_lead_events
union all
select 'historial_lotes', count(*)::bigint
from public.historial_lotes
union all
select 'metas_comerciales', count(*)::bigint
from public.metas_comerciales
union all
select 'las_lomas_lotes', count(*)::bigint
from public.las_lomas_lotes;

select estado, count(*)::bigint as lotes
from public.las_lomas_lotes
group by estado
order by estado;

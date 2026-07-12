-- Las Lomas - catalogo publico sin precios individuales
-- Ejecutar despues de 010_crm_meta_lead_ads.sql.

create or replace function public.crm_obtener_lotes_publicos()
returns table (
  id bigint,
  mz text,
  lote bigint,
  area numeric,
  estado text,
  svg_id text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.mz,
    l.lote,
    l.area,
    case
      when upper(coalesce(l.estado, 'DISPONIBLE')) in (
        'RESERVADO',
        'CIERRE_SOLICITADO',
        'EN_NEGOCIACION'
      ) then 'SEPARADO'
      else upper(coalesce(l.estado, 'DISPONIBLE'))
    end as estado,
    l.svg_id
  from public.las_lomas_lotes l
  where l.svg_id is not null
  order by l.id;
$$;

revoke all on function public.crm_obtener_lotes_publicos()
  from public;
grant execute on function public.crm_obtener_lotes_publicos()
  to anon, authenticated;

-- El visitante anonimo solo puede consumir el RPC anterior. De esta manera
-- PostgREST no permite consultar precio, cliente_id, asesor_id u otras
-- columnas privadas directamente desde la tabla.
revoke select on table public.las_lomas_lotes from anon;
grant select on table public.las_lomas_lotes to authenticated;

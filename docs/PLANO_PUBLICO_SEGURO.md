# Plano publico y cotizador privado

## Rutas

- Publico: `/disponibilidad`
- Cotizador exacto para personal autenticado: `/asesores/cotizador`
- La portada `/` redirige al plano publico.

## Informacion publica

La pagina publica muestra manzana, lote, area, estado y referencias comerciales generales:

- Lotes desde S/24,000.
- Inicial desde S/6,000.
- Cuotas desde S/600.

No consulta ni renderiza el precio individual de ningun lote.

## Activacion de seguridad

Ejecutar `supabase/sql/011_crm_catalogo_publico_seguro.sql` despues de la migracion 010.

La migracion:

1. Crea `crm_obtener_lotes_publicos()` con unicamente las columnas autorizadas.
2. Retira a `anon` el permiso de lectura directa sobre `las_lomas_lotes`.
3. Conserva la lectura completa para usuarios autenticados del CRM.

El archivo `public/lotes.json` tambien queda sin precios y se utiliza solo como respaldo visual.

## Solicitudes de cotizacion

Cuando un visitante selecciona un lote disponible y envia el formulario:

- se registra el lote de interes;
- se crea o reutiliza el cliente por celular/correo;
- se conserva o asigna un asesor;
- se registra la fecha y el mensaje de solicitud;
- aparece en Leads entrantes del CRM.

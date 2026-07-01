# Las Lomas

Cotizador interactivo basado en el proyecto Verde Mar, adaptado al plano SVG de Las Lomas.

## Uso

```bash
npm install
npm run dev
```

El plano actual se carga en dos capas: `public/plano-base.webp` como fondo renderizado y `public/plano-lotes.svg` como capa SVG interactiva. Los datos de lotes se leen desde Supabase usando la tabla `las_lomas_lotes`; si Supabase no esta configurado o responde con error, la app usa `public/lotes.json` como respaldo.

## Supabase

La app espera estas variables en `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

La tabla activa es `las_lomas_lotes` y debe tener, como minimo, las columnas `id`, `mz`, `lote`, `area`, `precio`, `estado` y `svg_id`. Para que los cambios de estado se vean sin recargar, activa Realtime para esa tabla y permite lectura con la anon key mediante las politicas RLS.

## Regenerar lotes

El SVG fuente antiguo `public/plano-0-svg.svg` se conserva solo para los scripts de regeneracion. Incluye 206 paths de lote, 206 areas y 206 numeros de lote. Para regenerar `public/lotes.json`:

```bash
node scripts/generar-lotes-las-lomas.js
```

Por defecto calcula precios con `S/ 250` por m2. Para usar otro valor:

```powershell
$env:PRECIO_M2="300"; node scripts\generar-lotes-las-lomas.js
```

Luego ajusta `estado` o `precio` directamente en `public/lotes.json` si necesitas datos comerciales finales.

# Meta Lead Ads -> Las Lomas CRM

Esta integracion recibe en tiempo real los formularios instantaneos de Facebook e Instagram, obtiene el detalle del lead desde Graph API, evita duplicados y lo asigna a un asesor activo.

## 1. Supabase

Ejecutar en SQL Editor, respetando el orden:

1. `supabase/sql/009_crm_captura_leads_publicos.sql`
2. `supabase/sql/010_crm_meta_lead_ads.sql`

La migracion 010 crea la trazabilidad de Meta, las funciones seguras de reparto y la bandeja de errores. No abre tablas privadas al publico.

## 2. Variables protegidas en Vercel

Configurar en Project Settings -> Environment Variables y aplicar a Production, Preview y Development cuando corresponda:

| Variable | Uso |
| --- | --- |
| `META_WEBHOOK_VERIFY_TOKEN` | Texto secreto creado por la empresa para verificar el callback. |
| `META_APP_SECRET` | App Secret de la aplicacion de Meta. |
| `META_PAGE_ACCESS_TOKEN` | Token con acceso a los leads de la pagina. Puede provenir de un usuario del sistema del negocio. |
| `META_GRAPH_API_VERSION` | Version fijada de Graph API. Valor inicial: `v25.0`. |
| `META_WHATSAPP_CONSENT_FIELD` | Nombre tecnico de la pregunta de consentimiento. Valor recomendado: `consentimiento_whatsapp`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de Supabase usada solo por el webhook del servidor. |

Nunca colocar `META_APP_SECRET`, tokens o `SUPABASE_SERVICE_ROLE_KEY` en variables que empiecen con `NEXT_PUBLIC_`, en archivos enviados a GitHub ni en el navegador.

Despues de guardar las variables, volver a desplegar el proyecto en Vercel.

## 3. Aplicacion y webhook en Meta

1. Usar un portafolio comercial que controle la pagina de Facebook, Instagram y la cuenta publicitaria.
2. Crear o seleccionar una aplicacion de tipo Business en Meta for Developers.
3. Agregar Webhooks y configurar el objeto Page con el campo `leadgen`.
4. Usar como callback:

   `https://laslomasdemalabrigo.vercel.app/api/meta/webhook`

5. Usar exactamente el mismo valor de `META_WEBHOOK_VERIFY_TOKEN` como Verify Token.
6. Conceder a la aplicacion y al token acceso a los leads de la pagina.
7. Suscribir la pagina a la aplicacion.
8. Completar Business Verification y App Review cuando Meta lo solicite para produccion.

La configuracion suele requerir `leads_retrieval` y permisos relacionados con la pagina. Para obtener nombres de anuncio, conjunto y campana, el token tambien necesita acceso publicitario. Meta puede cambiar los requisitos por version, por lo que se debe confirmar la lista mostrada en el panel de la aplicacion.

## 4. Formulario recomendado

Marcar como obligatorios:

- Nombre completo (`full_name`).
- Celular (`phone_number`).
- Correo (`email`) cuando sea util.
- Preguntas de calificacion comercial.
- Consentimiento de tratamiento de datos con enlace a la politica de privacidad.
- Consentimiento expreso para contacto por WhatsApp.

Pregunta recomendada para WhatsApp:

`Acepto que Inmobiliaria Komodo S.A.C. me contacte por WhatsApp para brindarme informacion del proyecto Las Lomas de Malabrigo.`

Usar como nombre tecnico `consentimiento_whatsapp` y una respuesta afirmativa como `Si, autorizo`.

Preguntas comerciales sugeridas:

- Monto disponible para la inicial.
- Cuota mensual que puede asumir.
- Compra al contado o financiada.
- Plazo estimado para comprar.
- Interes en agendar una llamada o visita.

Las respuestas completas quedan almacenadas en el lead. El bot de WhatsApp de la siguiente etapa usara esos datos para evitar repetir preguntas.

## 5. Prueba antes de publicar anuncios

1. Abrir Meta Lead Ads Testing Tool.
2. Crear un lead de prueba para el formulario conectado.
3. Confirmar que el evento aparece como `COMPLETADO` en `meta_lead_events`.
4. Ingresar al CRM y abrir Leads entrantes.
5. Confirmar origen `Meta Ads`, campana, anuncio, asesor asignado y contador SLA.
6. Registrar un seguimiento desde la ficha del cliente.
7. Confirmar que el lead cambia automaticamente a `ATENDIDO`.

No iniciar presupuesto publicitario alto hasta completar esta prueba de extremo a extremo.

## 6. Operacion y recuperacion

- `external_id` es unico: un reintento de Meta nunca crea dos leads.
- Los webhooks con error quedan en `meta_lead_events` y aparecen para gerencia en Leads entrantes.
- El endpoint responde con error cuando no pudo procesar el evento, permitiendo que Meta lo reintente.
- El reparto conserva al asesor de un cliente existente; para un cliente nuevo utiliza balance por carga mensual.
- Los asesores solo ven sus propios leads por RLS.

## 7. Siguiente etapa: WhatsApp

Despues de confirmar la entrada de Meta se conecta WhatsApp Business Platform para:

1. Enviar una plantilla aprobada solo a leads con consentimiento.
2. Completar preguntas faltantes de calificacion.
3. Calcular puntaje Caliente, Tibio o Frio.
4. Detener el bot y entregar la conversacion al asesor cuando el lead sea caliente o pida atencion humana.
5. Enviar a Meta, mediante Conversions API, los hitos calificado, cita, separacion y venta.

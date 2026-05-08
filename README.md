# Owner Direct Demo

## Stack confirmado

Este repo no usa Vite ni React. Es una app vanilla:

- `index.html`
- `styles.css`
- `app.js`
- `server.js` con Node HTTP puro

Por eso Framer Motion no se puede instalar/usar directamente sin migrar la app a React/Vite. Las animaciones de esta versión están implementadas con CSS y Web APIs, respetando `prefers-reduced-motion`.

## OpenRouter en Render

Variables necesarias:

- `OPENROUTER_API_KEY`: key server-side. No se envía al comprador.
- `OPENROUTER_BASE_URL`: default `https://openrouter.ai/api/v1`.
- `OPENROUTER_MODEL`: modelo default de emergencia.
- `OPENROUTER_FALLBACK_MODELS`: fallback global separado por comas.
- `AI_ROUTING_STORAGE`: `db` o `disk`. En Render con Supabase usar `db`.
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AI_SETTINGS_TABLE`: default `ai_settings`.

## Routing IA

La configuración de modelos se lee del backend:

- `GET /api/ai-routing`
- `PUT /api/ai-routing`
- `GET /api/health/ai`

`/api/openrouter` resuelve el modelo en el servidor por tarea (`search`, `vision`, `plan`, `score`) y aplica fallbacks automáticamente. El admin puede usar un override temporal con el header `X-OpenRouter-Key`; si no existe, se usa `OPENROUTER_API_KEY`.

## Auditoría previa de config

Antes de este cambio, el frontend le mandaba a `/api/openrouter` el modelo activo y la cola de fallbacks leídos desde `localStorage`. En Render eso podía no representar la config real del servicio ni sobrevivir entre browsers/admins. Ahora el servidor usa la config persistida en Supabase/disk como fuente de verdad.

## Rutas

- `/`: Portal cliente.
- `/admin/ai`: panel admin IA. Si no sos admin, redirige visualmente al Portal cliente.

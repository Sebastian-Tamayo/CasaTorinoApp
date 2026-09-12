# Arquitectura — Reservas Casa Torino

## Diagrama lógico

```text
[Móvil personal]
      │ HTTPS
      ▼
[SPA React (Vercel CDN)]
      │ /api/reservas
      ▼
[Vercel Serverless Functions]
      │
      ▼
[Store HTTP remoto]  ← persistencia JSON de reservas
   (CrudCrud hoy; Blob/KV/Postgres mañana)
```

## Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/reservas` | Listado |
| `POST` | `/api/reservas` | Alta |
| `PUT` | `/api/reservas/:id` | Edición / cambio de estado |

## Frontend
- `StaffPage`: login + formulario + listado + edición inline  
- `config.ts`: datos de negocio, personal y PIN  
- `lib/api.ts`: cliente tipado (`ONLINE_API_BASE = '/api/reservas'`)

## Backend (Vercel)
- `api/reservas.js` → GET/POST  
- `api/reservas/[id].js` → PUT  
- `server/reservas-store.js` → URL del store + helpers (`mapItem`, CORS)

## Seguridad (nivel negocio pequeño)
- Auth por PIN en cliente (suficiente para uso interno controlado)  
- Sin datos de pago  
- Credenciales demo documentadas; PIN real debe rotarse

## Deploy
- Build: `npm run build` → `dist/`  
- Hosting + functions: Vercel (`vercel.json`)  
- SPA rewrite: rutas de app → `index.html` sin tragar `/api/*`  
- Producción: https://reservas-casatorino.vercel.app

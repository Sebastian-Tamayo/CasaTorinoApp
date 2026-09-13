# Ecosistema Casa Torino

Mapa rápido del monorepo [CasaTorinoApp](https://github.com/Sebastian-Tamayo/CasaTorinoApp).

## Piezas

| Pieza | Carpeta | Rol en el negocio | Stack | Live |
|-------|---------|-------------------|-------|------|
| **Web principal** | `web/` | Carta, menú del día, equipo, contacto, hub interno | HTML/CSS/JS | [casa-torino-web.vercel.app](https://casa-torino-web.vercel.app) |
| Archivo inauguración | `web/archivo/inauguracion/` | Histórico (no principal) | HTML/CSS/JS | [casatorino.netlify.app](https://casatorino.netlify.app) |
| Sala / reservas | `reservas/` | Anotar y seguir mesas (solo personal) | React, TS, Vite, Vercel Functions | [reservas-casatorino.vercel.app](https://reservas-casatorino.vercel.app) |
| Back-office | `erp/` | Dinero, fiscal, RRHH, documentos, proveedores | Next.js 15, Supabase, Tailwind | [casa-torino-app.vercel.app](https://casa-torino-app.vercel.app/login) |

## Flujo de valor

1. El cliente conoce el local por la **web principal**.  
2. Reserva por **WhatsApp** (no usa la app de staff).  
3. En sala, el personal registra la reserva en **reservas** (PIN interno).  
4. La operativa económica y documental vive en el **ERP**.

## Acceso del personal

Desde la web: **Gestión interna** → `web/interno.html`  
- Reservas staff → https://reservas-casatorino.vercel.app  
- ERP → https://casa-torino-app.vercel.app/login  

## Media conservada

- ERP: `docs/media/erp/` (Captura1–5, GIFs de demo, logo)  
- Web: `docs/media/web/` (logo, demo GIF)  
- Reservas: `docs/media/reservas/` (logo)

## Origen de la unificación

- `https://github.com/Sebastian-Tamayo/casa-torino-web` → `web/` (principal) + archivo inauguración  
- `https://github.com/Sebastian-Tamayo/CasaTorinoApp` (ERP raíz) → `erp/`  
- Módulo reservas (antes en monorepo `Proyeccion`) → `reservas/`

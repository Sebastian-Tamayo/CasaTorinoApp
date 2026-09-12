# Ecosistema Casa Torino

Mapa rápido del monorepo [CasaTorinoApp](https://github.com/Sebastian-Tamayo/CasaTorinoApp).

## Piezas

| Pieza | Carpeta | Rol en el negocio | Stack | Live |
|-------|---------|-------------------|-------|------|
| Marca / captación | `web/` | Landing e inauguración | HTML/CSS/JS | [casatorino.netlify.app](https://casatorino.netlify.app) |
| Sala / reservas | `reservas/` | Anotar y seguir mesas en el momento | React, TS, Vite, Vercel Functions | [reservas-casatorino.vercel.app](https://reservas-casatorino.vercel.app) |
| Back-office | `erp/` | Dinero, fiscal, RRHH, documentos, proveedores | Next.js 15, Supabase, Tailwind | Vercel + Supabase |

## Flujo de valor

1. El cliente conoce el local por la **web**.  
2. En sala, el personal registra la reserva en **reservas**.  
3. La operativa económica y documental vive en el **ERP**.

## Media conservada

- ERP: `docs/media/erp/` (Captura1–5, GIFs de demo, logo)  
- Web: `docs/media/web/` (logo, demo GIF)  
- Reservas: `docs/media/reservas/` (logo)

## Origen de la unificación

- `https://github.com/Sebastian-Tamayo/casa-torino-web` → `web/`  
- `https://github.com/Sebastian-Tamayo/CasaTorinoApp` (ERP raíz) → `erp/`  
- Módulo reservas (antes en monorepo `Proyeccion`) → `reservas/`

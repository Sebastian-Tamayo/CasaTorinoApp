# Mapa de código — por página y bloque

Úsalo para pedir cambios sin explorar todo el monorepo.  
Las Cursor Rules en `.cursor/rules/` resumen lo mismo para el agente.

---

## `web/` — casa-torino-web

| Página | Bloques | Archivos |
|---|---|---|
| **Landing** `index.html` / `casa.html` | Hero · menú del día · carta · parking · CTAs | + `carta-public.js`, `carta.js`, `styles.css`, `main.js` |
| **Interno** `interno.html` | Gate PIN · enlaces módulos | — |
| **TPV** `tpv.html` | Barra (jornada, Notas, Reservas, Editar Carta, Fichaje) · mesas · carta · ticket · cobro · modales | `tpvSync.js`, `tpvJornada.js`, `tpv-data.js`, `printService.js`, `api/tpv-*`, `api/shift-notes.js`, `api/kitchen.js`, `api/carta*` |
| **Cocina** `cocina.html` | Gate · grid tickets · histórico · PWA | `kitchenSync.js`, `api/kitchen.js`, `manifest-cocina.webmanifest`, `sw-cocina.js` |
| **Fichaje** `fichaje.html` | Entrada/salida · horas | `api/time-logs.js` |
| **Reservar** `reservar.html` | Formulario público | APIs reservas + alerta TPV |

### APIs `web/api/`

`_opsStore.js` (núcleo Supabase) · `carta.js` · `carta-image.js` · `tpv-auth.js` · `tpv-sync.js` · `tpv-jornada.js` · `tpv-cierres.js` · `kitchen.js` · `shift-notes.js` · `time-logs.js` · `ops-daily-purge.js` · `ops-health.js` · `qz-sign.js` · `_securityHeaders.js`

---

## `reservas/` — reservas-casatorino

| Zona | Archivos |
|---|---|
| UI staff | `src/App.tsx`, `src/pages/StaffPage.tsx`, `src/components/Topbar.tsx` |
| Store | `server/reservas-store.js` → `ops_kv` |
| API | `api/reservas.js`, `api/reservas/[id].js`, `api/reservas-alerts.js`, `api/reservas-capacity.js`, `api/reservas-health.js` |

---

## `erp/` — casa-torino-app

| Ruta app | Carpeta |
|---|---|
| Login | `src/app/login` |
| Dashboard | `src/app/gestion` |
| Caja | `src/app/gestion/caja` |
| Top ventas | `src/app/gestion/top-ventas` |
| Historial / Nuevo | `historial`, `nuevo` |
| Fiscal / RRHH / Proveedores / Docs | `fiscal`, `rrhh`, `proveedores`, `documentos` |
| Ops TPV bridge | `src/lib/ops-kv.ts`, `src/app/api/jornada`, `src/app/api/cierres` |

---

## `docs/` · `scripts/` · `.github/`

| Qué | Dónde |
|---|---|
| PRD / comercial / técnico | `docs/PRD.md`, `COMERCIAL.md`, `TECNICO.md`, `ESPECIFICACIONES-TECNICAS.md` |
| Media demo | `docs/media/` |
| Backup diario | `.github/workflows/daily-backup.yml`, `scripts/daily-backup.sh` |
| Deploy web Action | `.github/workflows/deploy-casa-torino-web.yml` |
| Cursor rules | `.cursor/rules/*.mdc` |

---

## Atajos “si me pides X”

| Pedido típico | Ir primero a |
|---|---|
| “En la web el menú…” | `carta-public.js` / `carta.js` |
| “En el TPV el botón…” | `tpv.html` (barra ~líneas superiores + JS al final) |
| “Cocina no recibe…” | `api/kitchen.js` + envío desde `tpv.html` |
| “Notas / proveedores” | `api/shift-notes.js` + modal en `tpv.html` |
| “Top ventas ERP” | `erp/.../top-ventas` + `ops-kv` |
| “Reservas del personal” | `reservas/src` + `reservas-store.js` |
| “Backup / ramas” | `.github/workflows/daily-backup.yml` |

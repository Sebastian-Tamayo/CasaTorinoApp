# Casa Torino OS — Documento técnico

Fuente de verdad operativa: arquitectura, persistencia, deploy, seguridad, recuperación y anti-regresión.  
Comercial / venta → [`COMERCIAL.md`](./COMERCIAL.md).  
**Si se pierde el proyecto:** [`RECUPERACION-GITHUB.md`](./RECUPERACION-GITHUB.md) (clonar `main` + secretos + redeploy).

| | |
|---|---|
| **Repo (copia maestra)** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Rama desplegable** | `main` |
| **Actualizado** | oct 2026 |
| **Alcance** | `web/` · `reservas/` · `erp/` · `docs/` |

---

## 1. Arquitectura

```text
Cliente web (clara) → Gestión interna (PIN)
                         ├─ TPV (PIN/sesión) ──sync──► Supabase ops_kv `tpv`
                         │                        └─► ops_kv `kitchen` + `jornada` + `cierres`
                         ├─ Cocina KDS (reusa sesión TPV)
                         ├─ Fichaje / horas → `time_logs` (fallback ops_kv)
                         ├─ Reservas staff / públicas → ops_kv `reservas` + alertas TPV
                         └─ ERP (Supabase) ← lectura directa ops_kv jornada/cierres
```

| Carpeta | Qué es | Root Vercel |
|---------|--------|-------------|
| `web/` | Web pública + interno + TPV + KDS + fichaje | `web` |
| `reservas/` | App reservas del personal (React + Vite) | `reservas` |
| `erp/` | Back-office Next.js 15 + Supabase | `erp` |
| `docs/` | COMERCIAL + TECNICO + `media/` | — |
| `scripts/` | Backup, restaurar módulo, subir GitHub | — |

### URLs producción

| Proyecto Vercel | Dominio |
|---|---|
| `casa-torino-web` | https://casa-torino-web.vercel.app |
| `reservas-casatorino` | https://reservas-casatorino.vercel.app |
| `casa-torino-app` | https://casa-torino-app.vercel.app |

---

## 2. Persistencia

| Pieza | Backend | Código clave |
|---|---|---|
| TPV mesas, cocina, jornada, cierres | Supabase `ops_kv` | `web/api/_opsStore.js` |
| Carta / precios | `ops_kv` clave `carta` (+ fallback `web/data/carta.json`) | `GET/POST /api/carta` |
| Fotos de platos | Storage bucket público `menu_images` (subida con **service role** en servidor) · campo `image_url` | `POST /api/carta-image` · SQL `008`/`009` |
| Fichajes | Tabla `time_logs` (SQL `007_time_logs.sql`); fallback ops_kv | `web/api/time-logs.js` |
| Notas de turno TPV | Tabla `shift_notes` (SQL `010_shift_notes.sql`) | `GET/POST /api/shift-notes` · UI en `tpv.html` |
| Resumen reservas TPV | API reservas (`reservas-casatorino`) | Botón **Reservas** en `tpv.html` · enlace a app personal |
| Reservas | Supabase `ops_kv` claves `reservas` + `tpvReservaAlerts` | `reservas/server/reservas-store.js` |
| Top ventas / Caja ERP | Supabase `ops_kv` (`jornada`, `cierres`) | `erp/src/app/api/jornada` · `erp/src/app/api/cierres` (lectura directa) |
| ERP (gastos, RRHH, docs, fiscal) | Tablas Supabase + RLS | `erp/` |

> TPV / cocina / jornada / reservas / Top ventas ERP usan Supabase `ops_kv`. Fotos de carta: Storage `menu_images`. Sin Vercel Blob ni Edge Config.

### Carta (API)

- `POST /api/carta` `{ "action":"put", "carta":{…} }` — reemplazo completo  
- `POST /api/carta` `{ "action":"seed" }` — copia JSON del deploy a Supabase  
- `POST /api/carta` `{ "action":"upsertItem", "categoryId":"…", "item":{…} }`  
- `POST /api/carta-image` `{ "action":"upload", "itemId", "contentType", "dataBase64" }` → URL pública en Storage `menu_images`  
  Requiere `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SECRET_KEY`) en Vercel. **Sin fallback a ops_kv.**  
  Campo del plato: `image_url` (solo carta web; el TPV de sala no pinta fotos).  
  SQL: `008_menu_images_storage.sql` + `009_menu_images_secure.sql`.

Auth mutaciones: header `X-Tpv-Key` o sesión TPV.

### Cocina (KDS)

- URL `/cocina.html` · mismo PIN/sesión que TPV (`ct_tpv_session`)
- API `/api/kitchen` · cliente `kitchenSync.js` (poll ~4 s en pantalla; 60 s si pestaña oculta)
- TPV envía solo `categoryType: comida`
- Estados de comanda + menús 1/2 tiempos; histórico alineado con jornada
- PWA: `manifest-cocina.webmanifest` con `display: fullscreen` · SW `sw-cocina.js`
- **Forzar actualización:** `cocina-version.json` + `_cocinaVersion.js` + `COCINA_CLIENT_VERSION` (poll cada 5 min, pausa si oculta). **Nunca** 426 en create/ack/syncJornada del kitchen (el TPV no manda cabecera cocina).

### Jornada TPV

- API `GET/POST /api/tpv-jornada` — `start` · `end` · `sale` · `updateSale` · `updateLine` · `deleteSale` · `reset`
- Persistencia: ops_kv clave `jornada` · cliente `tpvJornada.js`

### Forzar actualización del TPV (todos los navegadores)

Tras **cualquier cambio que afecte al TPV**, subir la misma versión en estos 3 sitios y desplegar `web`:

1. `web/tpv-version.json` → `required`
2. `web/api/_tpvVersion.js` → `required`
3. `web/tpv.html` → `TPV_CLIENT_VERSION`

Efecto en **cada** tablet/móvil/PC (no basta con que uno actualice):

- Pantalla bloqueante: **«Actualiza para seguir»** + botón **Actualizar**
- Ack por navegador (`localStorage`) — cada dispositivo debe pulsar
- API `tpv-sync` y `tpv-jornada` exigen cabecera `X-Tpv-Client-Version`; si falta o no coincide → **426** (clientes viejos tampoco pueden operar)

### Purge diario

- `/api/ops-daily-purge` — limpia estado operativo (madrugada / ~08:00 Madrid) y dispara backups de informes email

### Informes email (semanal / mensual)

- Destino por defecto: `cafebartorino@gmail.com` (`REPORT_EMAIL_TO`)
- HTML responsive (móvil) con: total ventas, comida/bebida, efectivo/tarjeta, top productos, picos de mesas ocupadas
- **Semanal (lun–dom):** lunes ~08:00 Madrid vía purge/cron
- **Mensual:** día 1 del mes ~08:00 Madrid (totales por semana, no por día)
- Prueba manual: `GET /api/ops-daily-purge?informe=semanal|mensual&dryRun=1` (sin función API extra — límite Hobby 12)
- Envío: Resend (`RESEND_API_KEY` + `REPORT_EMAIL_FROM` en Vercel proyecto web)
- Sin Resend: HTML en ops_kv `informe-html:{periodKey}` + log `informe-log` (idempotencia)
- Cada cierre guarda `activityByHour` (mesas distintas / tickets por hora Madrid)

---

## 3. Stack

| Capa | Tecnología | Coste típico |
|---|---|---|
| Web / TPV / KDS | HTML/JS + APIs Vercel | Hobby 0 € |
| Reservas | React, Vite, Supabase ops_kv | Hobby 0 € |
| ERP | Next.js 15, Tailwind, Supabase | Hobby 0 € |
| Datos ops | Supabase free (`ops_kv`, `time_logs`, tablas ERP) | 0 € |
| Impresión | QZ Tray + POS-58 | Hardware local |
| Auth operativa | PIN + cookies `HttpOnly; Secure; SameSite=Lax` | — |

Principio: preferir Supabase free frente a Blob/Edge de pago; deploys controlados para no saturar storage Hobby.

---

## 4. Deploy

### Checklist por proyecto

| Proyecto | Root | Persistencia | Env críticas |
|---|---|---|---|
| **casa-torino-web** | `web` | ops_kv + Storage `menu_images` | `TPV_PIN`, Supabase URL/key + service role, `TPV_SYNC_KEY` |
| **reservas-casatorino** | `reservas` | ops_kv (`reservas`, `tpvReservaAlerts`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **casa-torino-app** | `erp` | Supabase ERP | `NEXT_PUBLIC_SUPABASE_*`, `ERP_PIN` / `TPV_SYNC_KEY` |

### Publicar web (desde raíz del monorepo; Root Directory = `web`)

```bash
npx vercel link --yes --scope sebas3212 --project casa-torino-web
npx vercel deploy --prod --yes --scope sebas3212
npx vercel alias set <deployment>.vercel.app casa-torino-web.vercel.app --scope sebas3212
```

Comprobar: `/data/carta.json` · `/interno.html` · `/tpv.html` · `/cocina.html` · `/api/ops-health`

### Publicar reservas

```bash
# desde monorepo, proyecto reservas, Root = reservas
npx vercel deploy --prod --yes --scope sebas3212
```

**Blindaje:** proyecto Vercel **desconectado de Git** (un push a `main` no redeploya). Deploy solo por CLI. Health: `GET /api/reservas-health` → `{ ok: true, store: "supabase-ops_kv" }`.

### Publicar ERP

```bash
cd erp && npx vercel deploy --prod --yes --scope sebas3212
```

### Encoding

No redirigir `git show … > archivo` en PowerShell (UTF-16 rompe tildes). Usar Python `Path.write_bytes` o `git checkout -- path`.

### Script local web

```bash
cd web
bash scripts/assert-light-theme.sh   # --bg: #fff8e8
bash scripts/deploy-web.sh
```

---

## 5. Secretos (nunca en el repo)

Plantillas: `web/.env.example` · `reservas/.env.example` · `erp/.env.example`.

| Módulo | Variables |
|---|---|
| Web / TPV | `TPV_PIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TPV_SYNC_KEY` |
| Reservas | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ PINs runtime) |
| ERP | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ERP_PIN` |

**No subir:** `.env`, tokens, PINs reales, carpetas `.vercel/`, `node_modules/`.  
**No usar:** `RESERVAS_STORE_URL` / CrudCrud · `@vercel/blob` · Edge Config (`RESERVAS_EDGE_CONFIG_*`, `BLOB_READ_WRITE_TOKEN`).

---

## 6. Reservas — anti-regresión

**Estado seguro:** Supabase `ops_kv` clave `reservas` · GitHub desconectado del proyecto Vercel · Ignore Build Step activo.

| Causa histórica | Efecto |
|---|---|
| CrudCrud free | 500 «Error del servidor de reservas» |
| Edge Config cuota writes | Avisos Vercel / riesgo de pausa |
| Push a `main` con store vacío + auto-deploy | Sustituía el deploy bueno |
| Root Directory mal | Build roto / API rota |

**Reglas:**
1. No reconectar Git al proyecto `reservas-casatorino` sin `SUPABASE_*` en env.
2. Deploy solo CLI desde monorepo.
3. Antes de publicar: `grep -n "edge-config\\|Edge Config" reservas/server/reservas-store.js` (debe quedar vacío).
4. Nunca restaurar CrudCrud ni Edge Config.

---

## 7. Recuperación

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp
./scripts/restaurar-modulo.sh web|reservas|erp|all
```

1. Configurar Root Directory en Vercel  
2. Pegar env desde `.env.example`  
3. Deploy · TPV: abrir `/tpv.html` + PIN  

Espejo de emergencia: `Sebastian-Tamayo/Proyeccion` → rama `backup/casa-torino-app`.  
Backup diario automático: ramas `backup/daily-YYYY-MM-DD` (ver §8).

### Auth TPV
- PIN validado en `/api/tpv-auth` contra `TPV_PIN` (servidor; **no** en HTML)
- Cookie HttpOnly `ct_tpv_session`
- Sync mesas: `/api/tpv-sync` + ops_kv

---

## 8. Respaldo diario (03:00 Madrid)

Workflow: `.github/workflows/daily-backup.yml` · script `scripts/daily-backup.sh`

- Cron UTC 01:00 / 02:00 (cubre DST Madrid) · idempotente por día
- Crea rama `backup/daily-YYYY-MM-DD` + tag `backup-YYYY-MM-DD` desde **main**
- Retención **14 días**
- **No** deploy · **No** force-push a `main` · **No** toca Vercel

Manual: `bash scripts/daily-backup.sh`

Subir desde PC: `bash scripts/subir-github.sh "mensaje"` · espejo: `bash scripts/traer-espejo-proyeccion.sh`

---

## 9. Seguridad (baseline 2026)

Revisión OWASP Top 10:2025 · cabeceras HTTP · RGPD/LOPDGDD proporcional a un bar familiar.

| Área | Estado |
|---|---|
| HTTPS / TLS Vercel | ✅ |
| Cookies sesión `HttpOnly; Secure; SameSite=Lax` | ✅ |
| Secretos fuera de Git | ✅ |
| PIN TPV en servidor | ✅ |
| RLS Supabase (ERP) | ✅ |
| Headers: HSTS, nosniff, Referrer-Policy, XFO, Permissions-Policy | ✅ (`web/vercel.json`, `erp/next.config.ts`, `_securityHeaders.js`) |
| Backup diario 03:00 | ✅ |
| CSP estricto | ⚠️ diferido (FA / Google Fonts / QZ) |
| PIN reservas en front | ⚠️ mover a env |
| Rate-limit PIN | ⚠️ pendiente |
| CORS `*` APIs públicas | ⚠️ aceptable en lectura |

**Veredicto:** apto para un local con PIN; proporcional al riesgo (RGPD art. 32).

### Datos personales

| Dato | Uso | Dónde |
|---|---|---|
| Reservas (nombre, teléfono) | Servicio | Supabase `ops_kv` |
| Fichajes | Obligación legal jornada | `time_logs` / ops_kv |
| Ticket / mesa | Operativa | ops_kv |
| Empleados / nóminas | Laboral | Supabase + RLS |

Pendiente operativo dueñas: aviso de privacidad en web + registro de encargados (Vercel/Supabase).

### Endurecimiento siguiente (sin urgencia)
1. PIN reservas/ERP solo en env  
2. Cookie sesión con valor aleatorio firmado  
3. Rate-limit 5 intentos / 15 min  
4. CSP Report-Only → enforced por ruta  
5. `npm audit` + Dependabot  
6. CORS mutadores a orígenes conocidos  

### Verificar prod
```bash
curl -sI https://casa-torino-web.vercel.app/ | rg -i 'strict-transport|x-content-type|referrer-policy'
```
TPV login · cocina · Actions → “Daily project backup” (manual).

---

## 10. Media

Capturas y GIFs de demo: [`media/`](./media/) (`web/`, `erp/`, `reservas/`).

---

*Documento técnico CasaTorinoApp · no sustituye pentest formal ni certificación ENS.*

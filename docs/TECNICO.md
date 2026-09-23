# Casa Torino OS — Documento técnico

Fuente de verdad operativa: arquitectura, persistencia, deploy, seguridad, recuperación y anti-regresión.  
Comercial / venta → [`COMERCIAL.md`](./COMERCIAL.md).

| | |
|---|---|
| **Repo** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Actualizado** | sept 2026 |
| **Alcance** | `web/` · `reservas/` · `erp/` |

---

## 1. Arquitectura

```text
Cliente web (clara) → Gestión interna (PIN)
                         ├─ TPV (PIN/sesión) ──sync──► Supabase ops_kv `tpv`
                         │                        └─► ops_kv `kitchen` + `jornada` + `cierres`
                         ├─ Cocina KDS (reusa sesión TPV)
                         ├─ Fichaje / horas → `time_logs` (fallback ops_kv)
                         ├─ Reservas staff / públicas → Edge Config `reservas`
                         └─ ERP (Supabase) ← proxy autenticado a cierres TPV
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
| Fotos de platos | Storage bucket público `menu_images` · campo `image_url` en cada ítem | `POST /api/carta-image` + Editar Carta TPV |
| Fichajes | Tabla `time_logs` (SQL `007_time_logs.sql`); fallback ops_kv | `web/api/time-logs.js` |
| Reservas | Vercel Edge Config clave `reservas` | `reservas/server/reservas-store.js` |
| ERP (gastos, RRHH, docs, fiscal) | Tablas Supabase + RLS | `erp/` |

> TPV / cocina / jornada **ya no usan Edge Config** para ops. Solo reservas siguen en Edge Config.

### Carta (API)

- `POST /api/carta` `{ "action":"put", "carta":{…} }` — reemplazo completo  
- `POST /api/carta` `{ "action":"seed" }` — copia JSON del deploy a Supabase  
- `POST /api/carta` `{ "action":"upsertItem", "categoryId":"…", "item":{…} }`  
- `POST /api/carta-image` `{ "action":"upload", "itemId", "contentType", "dataBase64" }` → URL pública en Storage `menu_images`  
  Campo opcional del plato: `image_url` (solo carta web; el TPV de sala no pinta fotos).  
  SQL: `web/supabase/008_menu_images_storage.sql` (ejecutar una vez en Supabase).

Auth: header `X-Tpv-Key` o sesión TPV.

### Cocina (KDS)

- URL `/cocina.html` · mismo PIN/sesión que TPV (`ct_tpv_session`)
- API `/api/kitchen` · cliente `kitchenSync.js` (poll ~1 s)
- TPV envía solo `categoryType: comida`
- Estados de comanda + menús 1/2 tiempos; histórico alineado con jornada

### Jornada TPV

- API `GET/POST /api/tpv-jornada` — `start` · `end` · `sale` · `updateSale` · `updateLine` · `deleteSale` · `reset`
- Persistencia: ops_kv clave `jornada` · cliente `tpvJornada.js`

### Purge diario

- `/api/ops-daily-purge` — limpia estado operativo (madrugada / ~09:00 según config)

---

## 3. Stack

| Capa | Tecnología | Coste típico |
|---|---|---|
| Web / TPV / KDS | HTML/JS + APIs Vercel | Hobby 0 € |
| Reservas | React, Vite, Edge Config | Hobby 0 € |
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
| **casa-torino-web** | `web` | ops_kv | `TPV_PIN`, Supabase URL/key, `TPV_SYNC_KEY` |
| **reservas-casatorino** | `reservas` | Edge Config | `RESERVAS_EDGE_CONFIG_ID`, `RESERVAS_TEAM_ID`, `RESERVAS_VERCEL_TOKEN` |
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

**Blindaje:** proyecto Vercel **desconectado de Git** (un push a `main` no redeploya). Deploy solo por CLI. Health: `GET /api/reservas-health` → `{ ok: true, store: "edge-config" }`.

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
| Web / TPV | `TPV_PIN`, Supabase, `TPV_SYNC_KEY`; legacy Edge Config env si aún existen |
| Reservas | `RESERVAS_EDGE_CONFIG_ID`, `RESERVAS_TEAM_ID`, `RESERVAS_VERCEL_TOKEN` (+ PINs runtime) |
| ERP | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ERP_PIN` |

**No subir:** `.env`, tokens, PINs reales, carpetas `.vercel/`, `node_modules/`.  
**No usar:** `RESERVAS_STORE_URL` / CrudCrud (límite ~100 req/día → 500).

---

## 6. Reservas — anti-regresión

**Estado seguro:** Edge Config clave `reservas` · GitHub desconectado del proyecto Vercel · Ignore Build Step activo.

| Causa histórica | Efecto |
|---|---|
| CrudCrud free | 500 «Error del servidor de reservas» |
| Push a `main` con store vacío + auto-deploy | Sustituía el deploy bueno |
| Root Directory mal | Build roto / API rota |

**Reglas:**
1. No reconectar Git al proyecto `reservas-casatorino` sin store Edge Config en `main`.
2. Deploy solo CLI desde monorepo.
3. Antes de publicar: `grep -n "Edge Config" reservas/server/reservas-store.js`.
4. Nunca restaurar CrudCrud vacío.

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
| Reservas (nombre, teléfono) | Servicio | Edge Config |
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

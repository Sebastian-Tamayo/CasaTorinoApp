# Recuperación desde GitHub — Casa Torino OS

**GitHub es la fuente de verdad del proyecto completo.**  
Si se pierde el portátil, se rompe Vercel o hay que reconstruir producción: todo el código recuperable está en este repositorio.

| | |
|---|---|
| **Repo** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Rama de verdad** | `main` |
| **Backup automático** | ramas `backup/daily-YYYY-MM-DD` + tags (retención 14 días, ~03:00 Madrid) |
| **Actualizado** | oct 2026 |

> Los **secretos** (PIN, tokens, keys) **no** van en el repo (`.gitignore`). Hay que tenerlos en Vercel / Supabase / GitHub Secrets. La lista está abajo.

---

## 1. Qué incluye el monorepo (todo el producto)

| Carpeta | Módulo | Deploy |
|---------|--------|--------|
| `web/` | Web pública, interno, TPV, cocina KDS, fichaje, APIs, plano mesas | Vercel `casa-torino-web` (Root = `web`) |
| `reservas/` | Agenda personal | Vercel `reservas-casatorino` |
| `erp/` | Back-office Next.js | Vercel `casa-torino-app` |
| `docs/` | PRD, técnico, comercial, recuperación, media demos | Solo GitHub |
| `.github/workflows/` | Deploy web + backup diario | GitHub Actions |
| `web/supabase/` · `erp/supabase/` | SQL migraciones | Supabase SQL Editor |

**URLs producción**

- Web/TPV/KDS: https://casa-torino-web.vercel.app  
- Reservas: https://reservas-casatorino.vercel.app  
- ERP: https://casa-torino-app.vercel.app  

---

## 2. Clonar y comprobar

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp
git checkout main
git pull origin main

# Punto de recuperación del día (si hace falta)
git fetch origin 'backup/daily-*'
git branch -r | grep backup/daily
```

Smoke tests locales (sin tocar producción):

```bash
node web/scripts/test-prod-smoke.js
node web/scripts/test-tpv-merge-delete.js
```

---

## 3. Secretos a restaurar (fuera del repo)

### GitHub → Settings → Secrets and variables → Actions

| Secret | Uso |
|--------|-----|
| `VERCEL_TOKEN` | Deploy producción web (workflow `Deploy casa-torino-web`) |

### Vercel proyecto `casa-torino-web` (Root Directory = `web`)

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` | ops_kv / Storage |
| `SUPABASE_ANON_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lectura |
| `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY` | Escritura server + fotos carta |
| `TPV_PIN` | Acceso TPV / cocina / interno |
| `TPV_SYNC_KEY` | APIs sync / cron / informes |
| `CRON_SECRET` | (opcional) auth cron purge |
| `RESEND_API_KEY` | Informes email |
| `REPORT_EMAIL_TO` / `REPORT_EMAIL_FROM` | Destinatario / from informes |

### Vercel `reservas-casatorino` y `casa-torino-app` (ERP)

Mismas claves Supabase según cada README (`reservas/README.md`, `erp/README.md`) + `ERP_PIN` si aplica.

### Supabase (proyecto existente)

- Tabla `public.ops_kv` (TPV, cocina, jornada, cierres, carta, floor_plan, reservas…)  
- Tablas: `time_logs`, `shift_notes`, Storage `menu_images`  
- SQL en `web/supabase/*.sql` y `erp/supabase/migrations/` (idempotentes; ejecutar si la DB está vacía)

**Los datos de mesas/ventas viven en Supabase, no en Git.**  
El **código** para volver a operar vive en GitHub.

---

## 4. Redesplegar producción desde GitHub

### A) Web + TPV + Cocina (automático)

1. Código en `main` (merge del PR o push a `main` con cambios en `web/**`).  
2. GitHub Actions: workflow **Deploy casa-torino-web**  
   - Se dispara en `push` a `main` (paths `web/**`)  
   - O manual: Actions → Deploy casa-torino-web → Run workflow (elegir rama `main`)  
3. El workflow hace `vercel deploy --prod` y alias `casa-torino-web.vercel.app`.

Manual (CLI, desde la **raíz** del monorepo):

```bash
npx vercel link --yes --scope sebas3212 --project casa-torino-web
npx vercel deploy --prod --yes --scope sebas3212
npx vercel alias set <url-del-deploy> casa-torino-web.vercel.app --scope sebas3212
```

Comprobar: `/tpv.html` · `/cocina.html` · `/interno.html` · `/api/ops-health` · `/tpv-version.json`

### B) Reservas

```bash
cd reservas
npx vercel link --yes --project reservas-casatorino
npx vercel deploy --prod --yes
```

### C) ERP

```bash
cd erp
npm ci
npx vercel link --yes --project casa-torino-app
npx vercel deploy --prod --yes
```

---

## 5. Tras un deploy del TPV (obligatorio)

Subir la **misma** versión en:

1. `web/tpv-version.json` → `required`  
2. `web/api/_tpvVersion.js` → `required`  
3. `web/tpv.html` → `TPV_CLIENT_VERSION`  
4. `web/sw-tpv.js` → `SW_VERSION`  

En **cada** dispositivo (Windows + móviles): pantalla **Actualizar**.

Versión de referencia plano/sync (oct 2026): ver `web/tpv-version.json` en `main`.

---

## 6. Plano de mesas / sync

- Doc: [`PLANO-MESAS.md`](./PLANO-MESAS.md)  
- Carritos: `ops_kv` clave `tpv`  
- Overlay: `ops_kv` clave `floor_plan`  
- Sync cliente ↔ Supabase (ahorro Hobby); broadcast `casa-torino-tpv-live`  
- SQL opcional: `web/supabase/011_plano_mesas.sql`

---

## 7. Informes email

- Doc: [`INFORMES-EMAIL.md`](./INFORMES-EMAIL.md)  
- Cron: `/api/ops-daily-purge` (lunes semanal, día 1 mensual)  
- Prueba sin enviar: `?informe=semanal&dryRun=1&force=1` + header `X-Tpv-Key`

---

## 8. Si “se rompe” solo el código local

```bash
git fetch origin
git checkout main
git reset --hard origin/main   # cuidado: descarta cambios locales no pusheados
```

Si hace falta el estado de ayer:

```bash
git checkout backup/daily-$(TZ=Europe/Madrid date -d yesterday +%F)   # o listar ramas backup/
```

---

## 9. Si se pierde Vercel pero queda GitHub + Supabase

1. Crear de nuevo 3 proyectos Vercel (o re-link).  
2. Root Directory: `web` / `reservas` / `erp`.  
3. Pegar env vars (sección 3).  
4. Deploy desde `main` (sección 4).  
5. Reasignar dominios/alias.  
6. Datos (mesas, carta, cierres) siguen en Supabase si el proyecto Supabase sigue vivo.

---

## 10. Checklist “proyecto completo a salvo”

- [ ] Repo GitHub con `main` actualizado (código TPV/plano/informes)  
- [ ] Workflow **Daily project backup** activo  
- [ ] Workflow **Deploy casa-torino-web** + secret `VERCEL_TOKEN`  
- [ ] Env vars en los 3 proyectos Vercel  
- [ ] Supabase con `ops_kv` + SQL aplicados  
- [ ] Este documento + [`DOSSIER-TECNICO-COMERCIAL.md`](./DOSSIER-TECNICO-COMERCIAL.md) §7 leídos  
- [ ] Tras deploy TPV: **Actualizar** en todos los dispositivos  

**Regla de oro:** ningún cambio importante se da por hecho hasta que esté en `origin/main` (o al menos pusheado en una rama remota visible en GitHub). El portátil no es la copia maestra.

# Deploy Casa Torino — checklist

## Proyectos Vercel (no mezclar Root Directory)

| Proyecto | Root | Dominio | Persistencia |
|---|---|---|---|
| **casa-torino-web** | `web` | casa-torino-web.vercel.app | Supabase `ops_kv` (kitchen, tpv, jornada, cierres) |
| **reservas** | `reservas` | reservas-casatorino.vercel.app | Edge Config clave `reservas` |
| **casa-torino-app** (ERP) | `erp` | casa-torino-app.vercel.app | Supabase tablas ERP + proxy a cierres |

> TPV / cocina / jornada **ya no usan Edge Config** para ops. Usan `web/api/_opsStore.js` → tabla `ops_kv`.  
> Reservas **sí** siguen en Edge Config (`reservas/server/reservas-store.js`).

## Publicar web (TPV + cocina + carta)

Desde la raíz del monorepo (Root Directory del proyecto = `web`):

```bash
# Windows / PowerShell
cd C:\CasaTorino\CasaTorinoApp
npx vercel link --yes --scope sebas3212 --project casa-torino-web
npx vercel deploy --prod --yes --scope sebas3212
npx vercel alias set <deployment>.vercel.app casa-torino-web.vercel.app --scope sebas3212
```

Comprobar:

- https://casa-torino-web.vercel.app/data/carta.json
- https://casa-torino-web.vercel.app/interno.html (tildes OK, no `├|`)
- https://casa-torino-web.vercel.app/reservar.html

## Publicar reservas

```bash
cd C:\CasaTorino\CasaTorinoApp\reservas
# o desde monorepo con project reservas y Root Directory=reservas
npx vercel deploy --prod --yes --scope sebas3212
```

Env: `RESERVAS_EDGE_CONFIG_*` / `RESERVAS_SLOT_CAPACITY` (default 40).

## Publicar ERP

```bash
cd C:\CasaTorino\CasaTorinoApp\erp
npx vercel deploy --prod --yes --scope sebas3212
```

Env servidor: `ERP_PIN` y/o `TPV_SYNC_KEY` (misma que web) para leer `/api/cierres` → `tpv-cierres`.

## Encoding (importante)

No redirigir `git show ... > archivo` en PowerShell (escribe UTF-16 y rompe tildes). Usar Python `Path.write_bytes` o `git checkout -- path`.

## Carta única

Fuente preferente: Supabase `ops_kv` clave `carta` vía `GET /api/carta`
(fallback `web/data/carta.json`). TPV (`carta.js` + `tpv-data.js`) y web pública (`carta-public.js`).
Para sembrar/actualizar sin redeploy (sesión TPV): `POST /api/carta` `{ "action":"seed" }` o `upsertItem`.

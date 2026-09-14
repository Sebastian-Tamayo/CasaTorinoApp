# Recuperación del ecosistema Casa Torino

Guía para **restaurar todo** o **solo un módulo** si falla Vercel, un portátil o un deploy.

> Los secretos (PIN del TPV, PINs de reservas, tokens, URLs de store) **no van en GitHub**.
> Están solo en variables de entorno de Vercel (o en `.env.local` local, gitignored).

## Módulos

| Carpeta | Qué es | Root Directory en Vercel |
|---------|--------|--------------------------|
| `web/` | Web pública + hub interno + **TPV** | `web` |
| `reservas/` | App de reservas del personal | `reservas` |
| `erp/` | Back-office / ERP (Next.js + Supabase) | `erp` |

## Secretos (nunca en el repo)

### Web / TPV — `web/.env.example`
- `TPV_PIN` — PIN de acceso al TPV
- `TPV_EDGE_CONFIG_ID` — Edge Config del sync de mesas
- `TPV_TEAM_ID` — team de Vercel
- `TPV_VERCEL_TOKEN` — token con permiso de Edge Config
- `TPV_SYNC_KEY` — clave opcional servidor (no va en el JS del cliente)

### Reservas — `reservas/.env.example`
- `RESERVAS_EDGE_CONFIG_ID` — Edge Config (mismo que TPV o dedicado)
- `RESERVAS_TEAM_ID` — team de Vercel
- `RESERVAS_VERCEL_TOKEN` — token con permiso de Edge Config
- PINs del personal: en GitHub solo hay `CHANGEME` en `server/staff.json` / `src/config.ts`. En producción sustituye por los PINs reales **sin hacer commit**, o usa `staff.example.json` como plantilla.
- **NO uses** `RESERVAS_STORE_URL` / CrudCrud: el plan gratis (~100 req/día) provocaba el error «Error del servidor de reservas».


### ERP — `erp/.env.example`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Recuperar TODO

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp

# Si el repo aún no tiene este backup, publícalo desde tu PC:
curl -fsSL https://raw.githubusercontent.com/Sebastian-Tamayo/Proyeccion/main/docs/publicar-en-casatorinoapp.sh | bash

# Configura secretos en cada proyecto Vercel y redeploy
```

## Recuperar SOLO un módulo

```bash
./scripts/restaurar-modulo.sh web
./scripts/restaurar-modulo.sh reservas
./scripts/restaurar-modulo.sh erp
./scripts/restaurar-modulo.sh all
```

### Web / TPV
1. Vercel → Root Directory = `web`
2. Pegar variables de `web/.env.example`
3. Deploy → abrir `/tpv.html` e introducir el PIN

### Reservas
1. Root Directory = `reservas`
2. Variables Edge Config (`RESERVAS_EDGE_CONFIG_ID`, `RESERVAS_TEAM_ID`, `RESERVAS_VERCEL_TOKEN`) + PINs reales en runtime
3. Deploy **solo con CLI** (`vercel deploy --prod` desde el monorepo). No reconectar Git a `main` mientras `reservas/server/reservas-store.js` en GitHub no sea la versión Edge Config.

### ERP
1. Root Directory = `erp`
2. Copiar `erp/.env.example` → env de Vercel (Supabase)
3. Deploy

## Notas TPV
- El PIN se valida en `/api/tpv-auth` contra `TPV_PIN` (servidor). **No está en el HTML.**
- Tras login correcto: cookie HttpOnly `ct_tpv_session` (~12 h).
- Sync móvil↔PC: `/api/tpv-sync` + Edge Config.

### Reservas — store estable (anti-caída)
Desde 2026-09 las reservas **ya no usan CrudCrud** (petaba al superar el límite).
Usan **Vercel Edge Config**. En el proyecto `reservas-casatorino` deben existir:
- `RESERVAS_EDGE_CONFIG_ID` (o `TPV_EDGE_CONFIG_ID`)
- `RESERVAS_TEAM_ID` (o `TPV_TEAM_ID`)
- `RESERVAS_VERCEL_TOKEN` (o `TPV_VERCEL_TOKEN`)
Root Directory del proyecto Vercel: `reservas`.

#### Por qué se rompía mientras trabajabas
1. Un backup “safe” subió a GitHub `main` el store vacío (CrudCrud sin URL).
2. Vercel tenía el repo conectado → **auto-deploy** sustituía el deploy bueno por el código roto.
3. CrudCrud libre se agotaba (~100 req/día) → API 500 «Error del servidor de reservas».

#### Blindaje activo (producción)
- Persistencia: Edge Config (sin límite diario de CrudCrud).
- Proyecto Vercel **desconectado de Git** (`vercel git disconnect`): un push a `main` **ya no redeploya** reservas.
- Ignore Build Step a nivel proyecto: si alguien reconecta Git, los builds desde commit se saltan; solo CLI despliega.
- Healthcheck: `GET https://reservas-casatorino.vercel.app/api/reservas-health` → `{ ok: true, store: "edge-config" }`.

#### Reglas para no volver a tumbarlo
1. **No reconectar** GitHub → proyecto `reservas-casatorino` hasta que `main` tenga el store Edge Config.
2. Deploy solo: `cd <monorepo> && vercel deploy --prod --scope sebas3212` (rootDirectory = `reservas`).
3. Nunca restaurar CrudCrud / `RESERVAS_STORE_URL` vacío.
4. Antes de publicar paquetes “safe” a CasaTorinoApp, verificar que `reservas/server/reservas-store.js` mencione `Edge Config`.

### Cocina (KDS)
- URL: `/cocina.html` (Gestión interna → Cocina)
- PIN: mismo que TPV (`TPV_PIN` / cookie `ct_tpv_session`)
- Store Edge Config clave `kitchen` (misma Edge Config que el TPV)
- API: `/api/kitchen` · sync cliente `kitchenSync.js` (poll ~1s)
- TPV: botón **Enviar a Cocina** (solo `categoryType: comida`)

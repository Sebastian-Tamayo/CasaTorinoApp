# Reservas — anti-regresión (leer antes de tocar deploys)

## Estado seguro (2026-09-14)

- Producción: https://reservas-casatorino.vercel.app
- Store: **Vercel Edge Config** (clave `reservas`), NO CrudCrud
- Health: `/api/reservas-health` → `{ "ok": true, "store": "edge-config" }`
- GitHub **desconectado** del proyecto Vercel `reservas-casatorino`
- Ignore Build Step: bloquea rebuilds si alguien reconecta Git por error

## Qué rompía el sistema

| Causa | Efecto |
|-------|--------|
| CrudCrud free (~100 req/día) | 500 «Error del servidor de reservas» |
| Push a `main` con `STORE = ''` | Auto-deploy sustituía el deploy bueno |
| Root Directory mal puesto | Build «No Next.js…» / API rota |

## Reglas operativas

1. **No reconectar** el repo a este proyecto Vercel hasta que `CasaTorinoApp/main` tenga el store Edge Config.
2. Desplegar solo con CLI desde monorepo (rootDirectory = `reservas`):
   ```bash
   vercel deploy --prod --scope sebas3212
   ```
3. Variables obligatorias en Vercel: `RESERVAS_EDGE_CONFIG_ID`, `RESERVAS_TEAM_ID`, `RESERVAS_VERCEL_TOKEN`.
4. Antes de un “publish safe” a GitHub, comprobar:
   ```bash
   grep -n "Edge Config" reservas/server/reservas-store.js
   ```
   Si no aparece, **no publiques**.

## Código canónico (copia de respaldo)

En este repo Proyeccion: `docs/casatorino-sync/reservas/`

# Casa Torino App — Ecosistema familiar

Respaldo canónico del negocio **Casa Torino** (Gijón): web pública, TPV, cocina (KDS), reservas y ERP.

> Empresa familiar. Este repositorio es el **backup continuo** del software operativo.
> **Nunca** subas PINs, tokens ni `.env` reales a GitHub.

## Módulos

| Carpeta | Qué es | Producción |
|---------|--------|------------|
| `web/` | Web pública clara + Gestión interna + **TPV** + **Cocina** | https://casa-torino-web.vercel.app |
| `reservas/` | App de reservas staff | https://reservas-casatorino.vercel.app |
| `erp/` | Back-office (Next.js + Supabase) | https://casa-torino-app.vercel.app |
| `docs/` | Recuperación y anti-regresión | — |

## Accesos (PIN en Vercel, no en el código)

- **Gestión interna / TPV / Cocina**: PIN del personal (`TPV_PIN` en Vercel) — se pide **siempre** al abrir.
- Tema web pública: **claro/crema** (`#fff8e8`). No sustituir por oscuro al desplegar TPV.

## Deploy seguro (web)

```bash
cd web
bash scripts/assert-light-theme.sh   # falla si el tema no es claro
bash scripts/deploy-web.sh           # deploy a producción
```

## Variables de entorno (Vercel)

### Web / TPV / Cocina (`casa-torino-web`)
- `TPV_PIN`
- `TPV_EDGE_CONFIG_ID`
- `TPV_TEAM_ID`
- `TPV_VERCEL_TOKEN`
- `TPV_SYNC_KEY` (opcional)

### Reservas (`reservas-casatorino`)
- `RESERVAS_EDGE_CONFIG_ID` (o `TPV_EDGE_CONFIG_ID`)
- `RESERVAS_TEAM_ID`
- `RESERVAS_VERCEL_TOKEN`
- Root Directory = `reservas`
- **No reconectar Git** hasta confirmar store Edge Config (ver `docs/reservas/ANTI-REGRESION.md`)

## Histórico de cocina
Los pedidos marcados como **Listo** se guardan en histórico del día y se borran a las **09:00** (Europe/Madrid).

## Recuperación
Ver `docs/RECUPERACION.md` y `docs/casatorino-sync/`.

## Reglas de oro
1. Web pública siempre **clara**.
2. Secretos solo en Vercel / `.env.local` (gitignored).
3. TPV, Cocina e Interna **siempre** piden PIN al entrar.
4. Reservas usan **Edge Config**, no CrudCrud.
5. Hacer push frecuente a este repo: es el respaldo de la empresa.

---
Casa Torino · Gijón

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
- `RESERVAS_STORE_URL` — URL del store JSON
- PINs del personal: en GitHub solo hay `CHANGEME` en `server/staff.json` / `src/config.ts`. En producción sustituye por los PINs reales **sin hacer commit**, o usa `staff.example.json` como plantilla.

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
2. `RESERVAS_STORE_URL` + PINs reales en runtime
3. Deploy

### ERP
1. Root Directory = `erp`
2. Copiar `erp/.env.example` → env de Vercel (Supabase)
3. Deploy

## Notas TPV
- El PIN se valida en `/api/tpv-auth` contra `TPV_PIN` (servidor). **No está en el HTML.**
- Tras login correcto: cookie HttpOnly `ct_tpv_session` (~12 h).
- Sync móvil↔PC: `/api/tpv-sync` + Edge Config.

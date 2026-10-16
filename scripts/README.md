# Scripts — Casa Torino App

Utilidades de **respaldo y recuperación** del monorepo. No sustituyen el flujo normal GitHub → Vercel.

| Script | Uso |
|--------|-----|
| `subir-github.sh` | Commit + push rápido de respaldo (con assert tema claro) |
| `restaurar-modulo.sh` | Checklist al restaurar un módulo (`web` / `reservas` / `erp` / `all`) |
| `push-backup-hoy.sh` | Push de `main` pendiente en tu PC |
| `daily-backup.sh` | Respaldo programable: rama `backup/daily-YYYY-MM-DD` + purga (>14 días) |

Operación detallada: [`../docs/DOSSIER-TECNICO-COMERCIAL.md`](../docs/DOSSIER-TECNICO-COMERCIAL.md) §7 · recuperación: [`../docs/RECUPERACION-GITHUB.md`](../docs/RECUPERACION-GITHUB.md).

### Respaldo automático (GitHub Actions)
Workflow [`.github/workflows/daily-backup.yml`](../.github/workflows/daily-backup.yml): ~**03:00 Europe/Madrid**, sin tocar `main` ni Vercel. Retención 14 días.

> Eliminados (oct 2026, peligrosos/obsoletos): `publicar-en-casatorinoapp.sh` (forzaba Edge Config) y `traer-espejo-proyeccion.sh` (espejo antiguo con force-push).

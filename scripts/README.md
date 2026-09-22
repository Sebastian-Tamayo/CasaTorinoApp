# Scripts — Casa Torino App

Utilidades de **respaldo y recuperación** del monorepo. No sustituyen el flujo normal GitHub → Vercel.

| Script | Uso |
|--------|-----|
| `subir-github.sh` | Commit + push rápido de respaldo (con assert tema claro) |
| `restaurar-modulo.sh` | Restaurar un módulo desde espejo / docs |
| `publicar-en-casatorinoapp.sh` | Publicar contenido hacia este repo |
| `traer-espejo-proyeccion.sh` | Traer espejo desde Proyeccion |
| `push-backup-hoy.sh` | Backup del día |
| `daily-backup.sh` | Respaldo programable: rama `backup/daily-YYYY-MM-DD` + purga (>14 días) |

Operación detallada: [`../docs/RECUPERACION.md`](../docs/RECUPERACION.md) · [`../docs/SUBIR-GITHUB.md`](../docs/SUBIR-GITHUB.md) · [`../docs/SEGURIDAD-2026.md`](../docs/SEGURIDAD-2026.md).

### Respaldo automático (GitHub Actions)
Workflow [`.github/workflows/daily-backup.yml`](../.github/workflows/daily-backup.yml): ~**03:00 Europe/Madrid**, sin tocar `main` ni Vercel. Retención 14 días.
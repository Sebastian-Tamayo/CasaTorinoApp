# Subir / respaldar en GitHub

Este repo es el **respaldo continuo** de Casa Torino.

## Desde tu PC (recomendado)

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp
# ... aplicar cambios ...
git add -A
git status
git commit -m "backup: descripción breve"
git push origin main
```

## Qué no subir
- `.env`, tokens, PINs reales
- carpetas `.vercel/`

## Checklist rápido
1. `web/styles.css` tiene `--bg: #fff8e8`
2. `bash web/scripts/assert-light-theme.sh` pasa
3. Reservas con Edge Config (no CrudCrud vacío)

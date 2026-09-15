# Subir / respaldar en GitHub

Este repo (`Sebastian-Tamayo/CasaTorinoApp`) es el **respaldo continuo** de Casa Torino.

> El agente de Cursor a veces **no tiene permiso de push** a `CasaTorinoApp`.
> En ese caso el espejo de emergencia va a `Sebastian-Tamayo/Proyeccion` → rama `backup/casa-torino-app`.

## Desde tu PC (recomendado — empuja a CasaTorinoApp)

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp
# Opción A: si ya tienes commits locales pendientes
git pull --ff-only
git push origin main

# Opción B: traer el espejo de Proyeccion y publicarlo aquí
git fetch https://github.com/Sebastian-Tamayo/Proyeccion.git backup/casa-torino-app
git merge --allow-unrelated-histories FETCH_HEAD -m "backup: sincronizar desde Proyeccion"
# o, más limpio si el espejo trae el árbol completo:
# git reset --hard FETCH_HEAD   # solo si estás seguro
git push origin main
```

Script rápido (con sesión GitHub en tu máquina):

```bash
bash scripts/subir-github.sh "backup: estado 15 sep 2026"
```

## Espejo de emergencia (Proyeccion)

Rama: `backup/casa-torino-app`  
Repo: https://github.com/Sebastian-Tamayo/Proyeccion/tree/backup/casa-torino-app

Contiene el árbol del ecosistema (sin secretos) alineado con producción web/TPV.

También se actualiza `docs/casatorino-sync/web/` en `main` de Proyeccion cuando se sincroniza la web.

## Qué no subir
- `.env`, tokens, PINs reales
- carpetas `.vercel/`
- `node_modules/`

## Checklist rápido
1. `web/styles.css` tiene `--bg: #fff8e8`
2. `bash web/scripts/assert-light-theme.sh` pasa
3. Reservas con Edge Config (no CrudCrud vacío)
4. README con fecha de estado actualizada

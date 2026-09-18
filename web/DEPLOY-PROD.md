# Deploy producción (casa-torino-web)

Alias: **https://casa-torino-web.vercel.app**  
Proyecto: `casa-torino-web` (Root Directory = `web`) — plan Hobby/gratis.

## CLI (desde la raíz del monorepo)

```bash
# Importante: cwd = raíz del repo (no web/), porque Root Directory=web
npx vercel@latest deploy --prod --yes --scope sebas3212 --token "$VERCEL_TOKEN"
```

## Checklist post-deploy

- `/printService.js` → `cols: 28` y `BUILD_TICKET`
- `/api/ops-daily-purge` ≠ 404
- `/tpv.html` → `payDraft` / pagos 1→N

# Deploy producción (casa-torino-web)

Alias real del TPV/cocina: **https://casa-torino-web.vercel.app**

Proyecto Vercel: `casa-torino-web` (`prj_YrLr62ys2WkZzYKrjix0NK4WmtES`) — **no** el proyecto `web`.

## Por qué Git “success” no basta
El integration de GitHub marca deploy OK, pero el alias a veces **no** se actualiza.
Hay que forzar:

```bash
cd web
npx vercel@39 deploy --prod --yes --scope sebas3212 --token "$VERCEL_TOKEN"
```

O Redeploy/Promote en el dashboard del proyecto `casa-torino-web`.

## Checklist post-deploy
- `printService.js` → `cols: 28` y `BUILD_TICKET`
- `/api/ops-daily-purge` ≠ 404
- TPV → modal Cobrar con pagos 1→N y “Falta/Cubierto”

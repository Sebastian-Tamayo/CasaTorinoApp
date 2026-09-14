# Sync TPV móvil ↔ PC

## Problema
El carrito vivía solo en `sessionStorage` de cada navegador. Un pedido en el móvil no aparecía en el PC.

## Solución (producción)
- Endpoint: `https://casa-torino-web.vercel.app/api/tpv-sync`
- Persistencia: Vercel Edge Config
- Cliente: `web/tpvSync.js` (push al cambiar + poll ~1,5 s)

## Uso
1. Móvil y PC abren el mismo TPV.
2. En ambos, ponéis el **mismo número de mesa** (ej. 9).
3. Al añadir productos en un dispositivo, el otro se actualiza solo en ~1–2 segundos.

## Archivos
- `web/tpvSync.js`
- `web/api/tpv-sync.js`
- `web/tpv.html` (ya cableado)

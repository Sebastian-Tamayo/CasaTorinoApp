# TPV mobile layout fix

Problema: en móvil las columnas derechas quedaban cortadas / demasiado estrechas.

Cambio:
- 1 columna ancha de productos en móvil (<560px)
- Cuenta a pantalla completa (bottom sheet)
- Sin desborde horizontal del topbar

Desplegar a producción (con token Vercel):

```bash
cd web   # carpeta del proyecto casa-torino-web
cp docs/casatorino-sync/tpv-fix/tpv.html ./tpv.html
npx vercel --prod --token "$VERCEL_TOKEN"
```

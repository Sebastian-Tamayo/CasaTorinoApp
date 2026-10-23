# Acceso GitHub: publicar ecosistema Casa Torino (Vercel)

El agente Cursor (`cursor[bot]`) necesita **Contents: Read and write** en este repo (`CasaTorinoApp`) para poder hacer push.

## URLs correctas

| Pieza | URL |
|-------|-----|
| Web principal | https://casa-torino-web.vercel.app |
| Instagram | https://www.instagram.com/cafebartorino |
| Facebook | https://www.facebook.com/profile.php?id=61572881816775 |
| Reservas | https://reservas-casatorino.vercel.app |
| ERP | https://casa-torino-app.vercel.app/login |
| Inauguración (archivo) | https://casatorino.netlify.app |

## Conceder acceso al agente (recomendado)

1. GitHub → Settings → Applications → Installed GitHub Apps → **Cursor**
2. Repository access: All repositories (o `CasaTorinoApp`)
3. Permissions → **Contents: Read and write**
4. Acepta permisos nuevos si GitHub lo pide

## Publicar desde tu PC

```bash
bash scripts/ops/publicar-en-casatorinoapp.sh
```

Eso restaura `web/` completa (con Instagram/Facebook), README Vercel y archivo Netlify.

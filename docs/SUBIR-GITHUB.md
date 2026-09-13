# Sincronizar monorepo con GitHub (Vercel = fuente de verdad)

La producción ya está en Vercel. Este repo debe reflejarlo:

- Web principal: https://casa-torino-web.vercel.app (`web/`)
- Reservas: https://reservas-casatorino.vercel.app (`reservas/`)
- ERP: https://casa-torino-app.vercel.app (`erp/`)
- Inauguración Netlify: solo archivo (`web/archivo/inauguracion/`)

## Desde tu PC (con permiso de escritura)

```bash
# Opción A — si tienes el bundle del agente
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp
git fetch
git pull
git bundle unbundle /ruta/a/casatorino-vercel-ecosistema.bundle
# o aplica el commit preparado y:
git push origin main
```

```bash
# Opción B — script del repo
bash scripts/subir-github.sh
```

## Permiso para el agente Cursor

En GitHub → Settings → Applications → **Cursor** (GitHub App) → Repository access → `CasaTorinoApp`  
→ Permissions → **Contents: Read and write** (y metadata).  
Sin eso, el push del agente falla con 403 (`cursor[bot]`).

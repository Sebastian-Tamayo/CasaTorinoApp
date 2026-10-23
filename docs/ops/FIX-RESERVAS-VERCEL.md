# Arreglar reservas-casatorino.vercel.app (500)

## Situación
- El código en GitHub **ya está bien** (commit `ee215b7`, store CrudCrud nuevo).
- El dominio **https://reservas-casatorino.vercel.app** sigue sirviendo un deploy viejo.
- El proyecto Vercel `casa-torino-app` falló al build porque el repo ahora es monorepo (`erp/`, `web/`, `reservas/`) y Vercel intentó construir la raíz.

## Opción A — Dashboard Vercel (recomendado)

### Proyecto de RESERVAS (`reservas-casatorino`)
1. Vercel → proyecto que tiene el dominio `reservas-casatorino.vercel.app`
2. **Settings → General → Root Directory** → `reservas`
3. **Settings → Environment Variables** →
   - `RESERVAS_STORE_URL` =
     `https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas`
4. **Deployments → Redeploy** (o Connect al repo `CasaTorinoApp` si aún no)

### Proyecto del ERP (`casa-torino-app`)
1. **Settings → General → Root Directory** → `erp`
2. Redeploy

## Opción B — Git Bash (CLI)

```bash
curl -fsSL https://raw.githubusercontent.com/Sebastian-Tamayo/CasaTorinoApp/main/scripts/ops/redeploy-reservas-vercel.sh | bash
```

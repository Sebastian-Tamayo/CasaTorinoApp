# Deploy — Casa Torino Reservas (Vercel)

Producción permanente en Vercel (migrado desde Netlify por límite de créditos).

## URL de producción

**https://reservas-casatorino.vercel.app**

Proyecto Vercel: `reservas-casatorino`  
API: `GET/POST /api/reservas` · `PUT /api/reservas/:id`

## Redeploy / actualizar

```bash
cd casa-torino-reservas
npm install
npm run build
npx vercel login          # solo la primera vez en esa máquina
npx vercel --prod
```

Root del proyecto en Vercel: carpeta `casa-torino-reservas` (no la raíz del monorepo).

## Dominio

- Dominio actual: `reservas-casatorino.vercel.app`
- Para cambiarlo: Vercel → proyecto → **Settings → Domains** (o renombrar el Project Name en **Settings → General**)

## Variables opcionales

| Variable | Uso |
|----------|-----|
| `RESERVAS_STORE_URL` | Endpoint del store JSON (por defecto CrudCrud en código) |

## PIN demo

Personal: Lorena / Yuli / Dayana / Claribel — PIN `1234` (`src/config.ts`).

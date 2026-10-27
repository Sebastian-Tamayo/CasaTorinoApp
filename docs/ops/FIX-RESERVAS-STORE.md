# Fix: Error del servidor de reservas

## Causa
La app en Vercel (`reservas-casatorino.vercel.app`) guarda datos en **CrudCrud**.
El endpoint gratis se agotó (**límite 100 peticiones**) → la API responde `500` con
`Error del servidor de reservas`.

## Arreglo rápido (recomendado): variable en Vercel

1. Abre el proyecto en Vercel → **Settings → Environment Variables**
2. Añade:

```
RESERVAS_STORE_URL=https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas
```

3. **Redeploy** (Deployments → ⋮ → Redeploy)

## Arreglo en código (Git Bash)

```bash
bash /tmp/fix-reservas-store.sh
```

(ver script en el mensaje del agente)

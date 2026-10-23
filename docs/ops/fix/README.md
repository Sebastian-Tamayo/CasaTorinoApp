# Fix reservas 500

## Causa real del último fallo
El script se enlazó a **`sebas3212/casa-torino-app`** (proyecto Next/ERP).
La carpeta `reservas/` es Vite, no Next → Vercel: *"No Next.js version detected"*.

Hay que desplegar al proyecto **`reservas-casatorino`**.

## Comando (Git Bash)

```bash
curl -fsSL https://raw.githubusercontent.com/Sebastian-Tamayo/CasaTorinoApp/main/docs/ops/fix/DEPLOY-RESERVAS-CORRECTO.sh -o /tmp/fix-reservas.sh
bash /tmp/fix-reservas.sh
```

## Mientras tanto (funciona)
https://temporary-instant-khaki-0ocyy2g.vercel.app

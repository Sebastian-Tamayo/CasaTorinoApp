# Web Casa Torino (público + TPV + Cocina)

- **Web pública**: tema claro crema (`#fff8e8`)
- **Gestión interna** (`interno.html`): PIN obligatorio
- **TPV** (`tpv.html`): pedidos por mesa, sync, cocina, IVA
- **Cocina** (`cocina.html`): KDS + histórico diario (purge 09:00)

## Deploy
```bash
bash scripts/assert-light-theme.sh
bash scripts/deploy-web.sh
```

Producción: https://casa-torino-web.vercel.app

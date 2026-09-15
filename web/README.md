# Web Casa Torino (público + TPV + Cocina)

Producción: https://casa-torino-web.vercel.app

- **Web pública**: tema claro crema (`#fff8e8`); menú del día y carta
- **Gestión interna** (`interno.html`): PIN obligatorio
- **TPV** (`tpv.html`): mesas, sync, cocina, jornada, impresión POS-58
- **Cocina** (`cocina.html`): KDS + histórico diario (purge 09:00)

## Destacado TPV (15 sep 2026)

- Precio editable en **cuenta** para menús y **Varios**
- Categoría **Varios / libre** (producto + precio a mano)
- Categoría **Cafés**; postres a barra
- Menú español en 2 platos (cocina ↔ TPV)
- Ticket vs Cobrar separados
- Scroll táctil solo en layout de caja; móvil con scroll nativo

## Precios menú del día (TPV + web)

| | Español | Colombiano |
|--|---------|------------|
| Entre semana | 14 € | 13 € |
| Fin de semana | 18 € | 15 € |

Refrescos: **2,50 €**

## Deploy

```bash
bash scripts/assert-light-theme.sh
bash scripts/deploy-web.sh
```

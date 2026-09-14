# Cocina (KDS) — modelo de datos y estados

## Base de datos detectada

**No hay SQL/Postgres en el TPV.** La persistencia operativa es:

| Clave Edge Config | Uso |
|---|---|
| `tpv` | Cuentas por mesa (carrito) entre dispositivos |
| `kitchen` | Cola de comandas de cocina (KDS) |
| `reservas` | Reservas (otro proyecto) |

Proyecto: `casa-torino-web` → Vercel Edge Config `ecfg_…` (mismas env `TPV_EDGE_CONFIG_*`).

“Tiempo real” = **polling ~1 s** (mismo patrón que `tpvSync.js`). Edge Config no ofrece websockets; la cocina escucha vía `GET /api/kitchen`.

## Estados de comanda (cocina)

| status | Dónde se ve | Quién lo pone |
|---|---|---|
| `pending_kitchen` | Monitor Cocina | TPV → **Enviar a Cocina** |
| `ready` | Oculto; guardado en `lastCompleted` | Cocina → **Listo** |
| (undo) vuelve a `pending_kitchen` | Reaparece en grid | Cocina → **Deshacer** |

La cuenta de la mesa en el TPV **no se vacía** al enviar a cocina: solo se marca `sentQty` en líneas de comida. Cobro sigue en TPV.

## Enrutado comida / bebida

- Productos con `categoryType: "comida"` → van a KDS.
- `categoryType: "bebida"` (categoría `bebidas`) → solo cuenta TPV / barra.
- Pedido mixto: TPV registra todo; a cocina solo viaja la parte comida.

## Objeto pedido (kitchen)

```json
{
  "id": "k-…",
  "mesa": "7",
  "status": "pending_kitchen",
  "createdAt": "ISO",
  "completedAt": null,
  "notes": "sin cebolla en la mesa",
  "items": [
    { "id": "…", "name": "Empanada", "qty": 2, "categoryType": "comida", "note": "" }
  ]
}
```

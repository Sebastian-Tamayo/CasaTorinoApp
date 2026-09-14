# Histórico diario de Cocina

- Cada pedido marcado como **Listo** entra en `history` (Edge Config clave `kitchen`).
- Visible en Cocina → botón **Histórico**.
- **Día de cocina:** 09:00 → 09:00 (Europe/Madrid).
- A las **09:00** se vacía automáticamente el histórico del día anterior.
- Deshacer quita el último pedido del histórico y lo devuelve a pendientes.

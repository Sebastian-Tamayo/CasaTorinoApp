# Histórico diario de Cocina

- Cada pedido marcado como **Listo** entra en `history` (Supabase `ops_kv` clave `kitchen`).
- Visible en Cocina → botón **Histórico**.
- Al **iniciar jornada** (TPV) se vacían cola e histórico; también con `POST /api/kitchen` `{ action: "clear" }`.
- Pedidos de jornadas anteriores se purgan al consultar el panel (GET).
- Deshacer quita el último pedido del histórico y lo devuelve a pendientes.

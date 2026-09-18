# Histórico diario de Cocina

- Cada pedido marcado como **Listo** entra en `history` (Supabase `ops_kv` clave `kitchen`).
- Visible en Cocina → botón **Histórico**.
- **Día operativo:** 09:00 → 09:00 (Europe/Madrid).
- A las **09:00** se vacían histórico y cola de cocina (rollover al consultar + cron `GET/POST /api/ops-daily-purge`).
- El mismo cron vacía las **mesas TPV** (cuentas / hist).
- Cron Vercel: `0 7 * * *` y `0 8 * * *` UTC (cubre horario de verano/invierno → 09:00 Madrid).
- Deshacer quita el último pedido del histórico y lo devuelve a pendientes.
- También se puede vaciar con `POST /api/kitchen` `{ action: "clear" }` o al iniciar jornada TPV.

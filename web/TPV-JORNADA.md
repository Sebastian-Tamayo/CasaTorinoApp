# TPV — Jornada / total de caja

## Uso en sala
1. **Inicio de jornada** al empezar el servicio.
2. Cobrar normalmente con **Cobrado** (cada ticket se acumula).
3. **Total de jornada** para ver ventas por tipo (comida/bebida), categoría y producto.
4. **Fin de sesión** al cerrar; el total queda congelado hasta la siguiente apertura.

## Técnica
- API: `GET/POST /api/tpv-jornada`
- Persistencia: Edge Config clave `jornada` (mismas env que TPV: `TPV_EDGE_CONFIG_ID`, etc.)
- Cliente: `tpvJornada.js`

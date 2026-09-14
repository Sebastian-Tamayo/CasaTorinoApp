# TPV — Jornada / total de caja

## Uso en sala
1. **Inicio de jornada** al empezar el servicio.
2. Cobrar normalmente con **Cobrado** (cada ticket se acumula).
3. **Total de jornada** para ver ventas por tipo (comida/bebida), categoría y producto.
4. **Fin de sesión** al cerrar; el total queda congelado hasta la siguiente apertura.

## Corregir errores (final del día)
En **Total de jornada → Corregir tickets**:
- Abrir un ticket (mesa + hora).
- Cambiar **cantidad** (+ / −), **precio** o **quitar producto**.
- **Borrar ticket** entero si estaba mal.
- Se puede corregir con la jornada **abierta o ya cerrada**.

Los totales (tipo / categoría / producto) se recalculan al momento.

## Técnica
- API: `GET/POST /api/tpv-jornada`
- Acciones POST: `start` · `end` · `sale` · `updateSale` · `updateLine` · `deleteSale` · `reset`
- Persistencia: Edge Config clave `jornada` (mismas env que TPV)
- Cliente: `tpvJornada.js`

# Plano interactivo de mesas (overlay)

Modo **adicional** del TPV. No sustituye el listado «Mesas» ni borra `ops_kv.tpv`.

## Comportamiento (producción)

| Situación | Plano |
|---|---|
| Con productos | Rojo · nombre camarera · total € |
| Vaciar o cobrar | Verde · Libre · sin camarera |
| Sin productos | Nunca “la atiende X” (sin fantasmas) |
| Sync | Supabase directo + broadcast `casa-torino-tpv-live` (no quema Hobby) |

Código: `web/planoMesas.js` · `web/tpvSync.js` · `web/tpv.html` · merge `web/api/_tpvMerge.js`.

## Dispositivos

| Rol | Dispositivo | Comportamiento |
|---|---|---|
| TPV central | Windows | Elige camarera · ve nombre+total · cobra |
| Camarera | Android / iOS | Elige nombre · mesa → carta para pedir |
| KDS | Android | Sin cambios (sigue cocina) |

## Datos (sin romper producción)

1. **Carritos / cobros:** siguen en `ops_kv` clave `tpv` (igual que siempre).
2. **Overlay plano:** `ops_kv` clave `floor_plan` (ya sembrada) **o** tabla SQL `public.tables` si ejecutas `web/supabase/011_plano_mesas.sql`.
3. **Desplegable camareras:** siempre en `ops_kv.floor_plan.waiters` (también con SQL `tables`). Solo se borran con el botón Eliminar; el refresh/purge de mesas **no** las resetea a los defaults.
4. No se eliminan claves ni registros existentes.

## Tiempo real (sin APIs Vercel)

El navegador usa `@supabase/supabase-js` directo:

- Intenta `postgres_changes` en `public.tables` (tras SQL 011).
- Si no hay tabla: Broadcast + poll corto a Supabase (no a Vercel).

## SQL

Ejecutar una vez en Supabase SQL Editor: `web/supabase/011_plano_mesas.sql`  
(Idempotente: `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`.)

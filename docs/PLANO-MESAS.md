# Plano interactivo de mesas (overlay)

Modo **adicional** del TPV. No sustituye el listado «Mesas» ni borra `ops_kv.tpv`.

## Dispositivos

| Rol | Dispositivo | Comportamiento |
|---|---|---|
| TPV central | Windows | Ve todas las mesas; toca ocupada → cobrar |
| Camarera | Android / iOS | Toca libre → se asigna y abre la mesa para pedir |
| KDS | Android | Sin cambios (sigue cocina) |

## Datos (sin romper producción)

1. **Carritos / cobros:** siguen en `ops_kv` clave `tpv` (igual que siempre).
2. **Overlay plano:** `ops_kv` clave `floor_plan` (ya sembrada) **o** tabla SQL `public.tables` si ejecutas `web/supabase/011_plano_mesas.sql`.
3. No se eliminan claves ni registros existentes.

## Tiempo real (sin APIs Vercel)

El navegador usa `@supabase/supabase-js` directo:

- Intenta `postgres_changes` en `public.tables` (tras SQL 011).
- Si no hay tabla: Broadcast + poll corto a Supabase (no a Vercel).

## SQL

Ejecutar una vez en Supabase SQL Editor: `web/supabase/011_plano_mesas.sql`  
(Idempotente: `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`.)

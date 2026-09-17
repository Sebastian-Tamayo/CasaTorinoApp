# Ecosistema Casa Torino

```
Cliente web (clara) → Gestión interna (PIN)
                         ├─ TPV (PIN/sesión) ──sync──► Supabase ops_kv `tpv`
                         │                        └─► ops_kv `kitchen` + `jornada` + `cierres`
                         ├─ Cocina KDS (reusa sesión)
                         ├─ Reservas staff / públicas → Edge Config `reservas`
                         └─ ERP (Supabase) ← proxy autenticado a cierres
```

## Persistencia

| Pieza | Backend |
|---|---|
| TPV mesas, cocina, jornada, cierres | Supabase `ops_kv` (`web/api/_opsStore.js`) |
| Reservas | Vercel Edge Config (`reservas/server/reservas-store.js`) |
| ERP gastos/RRHH/docs | Supabase tablas ERP |

Carta/precios: fuente única `web/data/carta.json` (web pública + TPV).

Deploy: ver [`DEPLOY-CHECKLIST.md`](DEPLOY-CHECKLIST.md).

# Ecosistema Casa Torino

```
Cliente web (clara) → Gestión interna (PIN)
                         ├─ TPV (PIN) ──sync──► Edge Config `tpv`
                         │                 └─► Edge Config `kitchen`
                         ├─ Cocina KDS (PIN) ◄── kitchen
                         ├─ Reservas staff
                         └─ ERP (Supabase)
```

Persistencia operativa: **Vercel Edge Config** (no SQL en TPV/Cocina).

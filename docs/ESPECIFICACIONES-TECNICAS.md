# Especificaciones técnicas — Casa Torino OS

Documento de especificación para exposición / onboarding técnico.  
Detalle operativo ampliado: [`TECNICO.md`](./TECNICO.md). Mapa de archivos: [`MAPA-CODIGO.md`](./MAPA-CODIGO.md).

| | |
|---|---|
| **Versión** | 2026-10 |
| **Repo** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Monorepo** | `web/` · `reservas/` · `erp/` · `docs/` · `scripts/` |

---

## 1. Vista de sistema

```text
┌──────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ Web pública  │   │ TPV / KDS /     │   │ Reservas staff   │
│ index/casa   │   │ fichaje/interno │   │ (React + Vite)   │
└──────┬───────┘   └────────┬────────┘   └────────┬─────────┘
       │                    │                     │
       └──────────┬─────────┴──────────┬──────────┘
                  ▼                    ▼
         Vercel (web)              Supabase
         Root Directory=web        ops_kv · time_logs
                                   shift_notes · menu_images
                  │                    ▲
         ┌────────┴────────┐           │
         │ ERP Next.js 15  │───────────┘
         │ casa-torino-app │
         └─────────────────┘
```

| Proyecto Vercel | Root Directory | Dominio |
|---|---|---|
| `casa-torino-web` | `web` | https://casa-torino-web.vercel.app |
| `reservas-casatorino` | `reservas` | https://reservas-casatorino.vercel.app |
| `casa-torino-app` | `erp` | https://casa-torino-app.vercel.app |

---

## 2. Stack por módulo

| Módulo | Runtime | UI | Datos |
|---|---|---|---|
| Web / TPV / KDS / Fichaje | Node serverless (Vercel) + estático | HTML/CSS/JS | Supabase `ops_kv`, Storage, `time_logs`, `shift_notes` |
| Reservas | Vite build + serverless API | React + TS | `ops_kv` (`reservas`, `tpvReservaAlerts`) |
| ERP | Next.js 15 App Router | React + Tailwind | Supabase tablas + RLS; lectura `ops_kv` caja/top ventas |
| Impresión | Local | QZ Tray | POS-58 térmico |
| Auth operativa | PIN servidor | Cookies `HttpOnly; Secure; SameSite=Lax` | `TPV_PIN`, `ERP_PIN` |

---

## 3. APIs web (superficie)

| Ruta | Rol |
|---|---|
| `GET/POST /api/carta` | Carta única (ops_kv `carta`) |
| `POST /api/carta-image` | Upload foto → Storage `menu_images` |
| `GET/POST /api/tpv-sync` | Estado mesas |
| `GET/POST /api/tpv-jornada` | Jornada / ventas |
| `GET/POST /api/tpv-cierres` | Cierres |
| `GET/POST /api/tpv-auth` | PIN → cookie sesión |
| `GET/POST /api/kitchen` | Cola KDS |
| `GET/POST /api/shift-notes` | Notas de turno |
| `GET/POST /api/time-logs` | Fichajes |
| `GET/POST /api/ops-daily-purge` | Limpieza diaria (cron) |
| `GET /api/ops-health` | Health |
| `POST /api/qz-sign` | Firma QZ Tray |

Clientes clave: `tpvSync.js`, `tpvJornada.js`, `kitchenSync.js`, `carta.js`, `printService.js`.

---

## 4. Modelo de datos (ops)

| Clave / tabla | Contenido |
|---|---|
| `ops_kv.tpv` | Mesas / cuentas |
| `ops_kv.kitchen` | Pedidos cocina |
| `ops_kv.jornada` | Jornada abierta + ventas |
| `ops_kv.cierres` | Histórico cierres |
| `ops_kv.carta` | Carta + menús |
| `ops_kv.reservas` | Agenda |
| `ops_kv.tpvReservaAlerts` | Avisos TPV |
| `public.shift_notes` | Notas pendiente turno |
| `public.time_logs` | Fichajes |
| Storage `menu_images` | Fotos platos/menú |

SQL de referencia: `web/supabase/*.sql` · `erp/supabase/migrations/`.

---

## 5. Reglas de dominio críticas

1. **Menú del día:** `isWeekendMenuDay` (sáb/dom + festivos Gijón) → solo ítems `weekday` **o** `weekend`.
2. **Cocina:** solo líneas `categoryType: comida` (bebidas/postres/barra no entran).
3. **Menús mixtos:** español puede ser 2 tiempos; colombiano 1 tiempo.
4. **Editar Carta TPV** escribe Supabase; la web pública lee la misma fuente.
5. **Purge:** cron Vercel → `/api/ops-daily-purge` (no depende de ramas feature).

---

## 6. Seguridad (baseline)

- HTTPS Vercel; HSTS / nosniff / Referrer-Policy / XFO / Permissions-Policy
- PIN TPV validado en servidor (`TPV_PIN`); no hardcode en HTML de prod
- Service role Supabase solo en serverless
- RLS en tablas ERP
- Secretos: plantillas `*/.env.example` — valores reales solo en Vercel

Pendiente no bloqueante: rate-limit PIN, CSP estricto, PIN reservas 100 % en env.

---

## 7. CI / backup / deploy

| Mecanismo | Qué hace |
|---|---|
| `Daily project backup` | 03:00 Madrid → `backup/daily-YYYY-MM-DD` + tag; retención 14 días |
| `Deploy casa-torino-web` | Push `web/**` a `main` → Vercel prod (requiere `secrets.VERCEL_TOKEN`) |
| Deploy reservas/ERP | Preferente CLI (`vercel deploy --prod`) |

**Nunca** el backup modifica `main` ni Vercel.

---

## 8. Entorno local (resumen)

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
# Web: servir estático + env Vercel pull
# Reservas: cd reservas && npm i && npm run dev
# ERP: cd erp && npm i && npm run dev
./scripts/restaurar-modulo.sh web|reservas|erp|all
```

---

## 9. Criterios de aceptación técnicos (smoke)

- [ ] `/` carga hero claro y un solo bloque de menú del día
- [ ] `/tpv.html` PIN → mesas; Notas + Reservas visibles
- [ ] `/cocina.html` recibe comida; PWA instalable
- [ ] `/api/ops-health` OK
- [ ] ERP Caja / Top ventas leen jornada/cierres
- [ ] Actions “Daily project backup” en verde (o disparo manual)

---

*Especificación técnica Casa Torino OS · complementa, no sustituye, pentest formal.*

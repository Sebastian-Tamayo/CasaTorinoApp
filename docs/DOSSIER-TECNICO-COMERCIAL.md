# Casa Torino OS — qué has creado (técnico + comercial)

**Dossier unificado de estudio** (sustituye los antiguos `COMERCIAL.md` + `TECNICO.md`).  
Producto real en producción · Casa Torino · Ceares, Gijón · oct 2026.

| | |
|---|---|
| **Producto** | Casa Torino OS (web + TPV + cocina + reservas + fichaje + ERP) |
| **Autor** | Sebastián Olaya Tamayo (Sebas-Dev) |
| **Repo (copia maestra)** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Rama de verdad** | `main` |
| **Infra** | Vercel + Supabase Hobby ≈ **0 €/mes** |
| **Estado** | Producción · estrés real +2.600 € / +130 comensales concurrentes |

Lecturas hermanas: [`PRD.md`](./PRD.md) · [`ESPECIFICACIONES-TECNICAS.md`](./ESPECIFICACIONES-TECNICAS.md) · [`MAPA-CODIGO.md`](./MAPA-CODIGO.md) · [`RECUPERACION-GITHUB.md`](./RECUPERACION-GITHUB.md).

---

## Índice

1. [Resumen](#1-resumen)
2. [Comercial](#2-comercial)
3. [Arquitectura](#3-arquitectura)
4. [Módulos](#4-módulos)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Flujos clave](#6-flujos-clave)
7. [Seguridad, secretos y operación](#7-seguridad-secretos-y-operación)
8. [Cómo estudiarlo](#8-cómo-estudiarlo)

---

## 1. Resumen

### En una frase

Has construido un **sistema de hostelería de punta a punta** —marca, sala, cocina, reservas, cumplimiento horario y oficina— en un monorepo desplegado en **3 proyectos Vercel**, con GitHub como fuente de verdad y coste de infra ≈ **0 €/mes**.

### Inventario mental

| Capa | Qué es | URL / ubicación |
|------|--------|-----------------|
| Web pública | Escaparate: carta, menú, parking, reserva, WhatsApp | https://casa-torino-web.vercel.app |
| Interno | Hub con PIN hacia todos los módulos de equipo | …/interno.html |
| TPV | Sala: mesas, plano, carta, cobro, ticket, jornada, Total día | …/tpv.html |
| Cocina KDS | Monitor solo comida + PWA fullscreen | …/cocina.html |
| Reservas staff | Agenda personal + alerta amarilla en TPV | https://reservas-casatorino.vercel.app |
| Fichaje | Entrada/salida + horas (RD-ley 8/2019) | …/fichaje.html (+ en TPV) |
| ERP | Caja, top ventas, P&L, fiscal, RRHH, docs | https://casa-torino-app.vercel.app |
| Docs + backup | PRD, este dossier, recuperación, backup diario | `docs/` + GitHub Actions |

### Peso relativo del producto (orientativo, no LOC)

| Módulo | Peso aprox. |
|--------|-------------|
| TPV + plano + cobro | 34 % |
| Web pública + carta | 16 % |
| Cocina KDS | 14 % |
| ERP oficina | 14 % |
| Reservas | 12 % |
| Fichaje + informes + ops | 10 % |

El **TPV es el núcleo operativo**; web y ERP cierran marca y oficina.

### Últimos cambios relevantes en `main` (oct 2026)

| PR | Qué aporta |
|----|------------|
| #76 · ticket + Total día | POS-58: precios en una línea (24 cols). Total día (PIN): Por mesa con camarera |
| #75 · Total día PIN | Importes de caja ocultos a camareros; Total día con PIN 2908 |
| #74–#71 · menú + plano | Barra jornada corta; plano táctil Windows/móvil compacto |
| #70 · plano + recuperación | Sync plano mesas + guía RECUPERACION-GITHUB.md |

---

## 2. Comercial

### Pitch (30 s)

Un sistema de hostelería completo: web pública, reservas, TPV por mesa, monitor de cocina, fichaje legal y ERP — conectado, con PIN, sync casi en tiempo real y **sin cuotas tipo Square / Revo / CoverManager**. Probado en servicio real.

### Problema → solución

| Antes (bar típico) | Ahora (Casa Torino OS) |
|--------------------|------------------------|
| Pedidos a viva voz / papel | Mesa = cuenta digital compartida |
| Móvil y PC desincronizados | Pedido móvil → PC y cocina al instante |
| Reservas en WhatsApp / Excel | Agenda staff + alerta en TPV |
| Sin registro horario fiable | Fichaje entrada/salida integrado |
| Caja y gastos en cuadernos | ERP: P&L, fiscal, RRHH, documentos |
| Software 50–300 €/mes por módulo | Infra Hobby; margen en setup + soporte |

### Packs de venta

| Pack | Contenido | Para quién |
|------|-----------|------------|
| **A · Escaparate** | Web + reserva WhatsApp/web + interna básica | Solo presencia y reservas |
| **B · Sala + Cocina** | A + TPV + KDS + jornada + ticket | Dejar el papel |
| **C · Local completo** | B + reservas staff + alerta TPV + editar carta + fichaje | Varias camareras / turnos |
| **D · Dueña / Oficina** | C + ERP completo | Control sin gestoría diaria |

**Modelo de precio:** setup único (Pack B o D) + soporte €/mes. Margen alto porque hosting ≈ 0 €.  
**Extras:** impresora + QZ, white-label, formación 30–45 min.

### Diferenciadores

| vs | Ellos | Casa Torino OS |
|----|-------|----------------|
| Revo / Square | Cuota alta, genérico | A medida, stack free |
| CoverManager / TheFork | Solo reservas | Reservas + TPV + KDS + ERP + fichaje |
| Excel + WhatsApp | Sin sync | Tiempo real sala–cocina–caja |
| Apps de fichaje sueltas | Otro login / coste | Integrado en el TPV |

Taglines: *“Del WhatsApp al P&L”* · *“TPV + cocina + reservas + fichaje + oficina. Sin cuota abusiva.”* · *“Hecho en un bar real. Listo para el tuyo.”*

### Qué NO prometes

- No sustituye personal ni cocina sola  
- Sin internet hace falta plan B (papel)  
- El ERP organiza datos para gestoría; no presenta modelos AEAT automáticos  
- No hay app nativa iOS/Android (sí PWA Cocina)  
- No hay multi-local / franquicia todavía  

### Guion 2–3 min para dueñas

> Os he montado un sistema completo, no solo una web.  
> En internet: página clara para clientes.  
> Para el equipo: zona con PIN → TPV (mesas en móvil y PC), cocina (solo platos + alarma), reservas y oficina.  
> Sala y cocina van conectadas; las bebidas se quedan en barra.  
> Todo respaldado en GitHub: aunque se estropee un PC, el proyecto no se pierde.

### Demo en 4 minutos

1. Web: carta, parking, reservar  
2. Reserva → alerta amarilla en TPV  
3. TPV: mesa → menú + bebida → Enviar a cocina → KDS solo comida  
4. Cocina Listo → cobro / ticket  
5. Fichaje → Horas trabajadas  
6. ERP: cierre / gasto / P&L  

---

## 3. Arquitectura

```text
Cliente → Web pública
            ├─ Reserva pública ──────────────┐
            └─ Gestión interna (PIN)         │
                 ├─ TPV ──sync──► ops_kv     │
                 │         └─► kitchen / jornada / cierres
                 ├─ Cocina KDS (sesión TPV)  │
                 ├─ Fichaje → time_logs      │
                 ├─ Reservas staff ◄─────────┘  (+ alerta TPV)
                 └─ ERP ← lectura ops_kv jornada/cierres
                              ▲
                         Supabase
```

### Monorepo → 3 deploys

| Carpeta | Proyecto Vercel | Stack | Root |
|---------|-----------------|-------|------|
| `web/` | casa-torino-web | HTML/JS + serverless APIs | `web` |
| `reservas/` | reservas-casatorino | React + Vite + API | `reservas` |
| `erp/` | casa-torino-app | Next.js 15 + Tailwind + Supabase | `erp` |
| `docs/` | — (solo GitHub) | Markdown + media demos | — |

### Principio de diseño técnico

**Elegido a propósito**

- Supabase free (`ops_kv`) frente a Blob / Edge Config de pago  
- TPV/KDS en HTML/JS: latencia baja, fácil de tocar en sala  
- Poll corto + broadcast Supabase (sin saturar Hobby)  
- `main` = verdad; features por PR `cursor/<tema>-580d`  
- Force-update TPV/KDS por versión (todos los dispositivos)  

**Descartado / migrado**

- `@vercel/blob` para estado ops  
- Edge Config para reservas  
- CrudCrud / stores externos frágiles  
- Redeploy automático Git → reservas (desconectado a propósito)  
- CSP estricto enforced (pendiente)  

### Capas lógicas

| Capa | Responsabilidad | Ejemplos |
|------|-----------------|----------|
| Presentación | UI táctil / móvil / marca | `tpv.html`, `cocina.html`, `index.html`, ERP pages |
| Clientes sync | Poll, merge, versión, impresión | `tpvSync.js`, `kitchenSync.js`, `printService.js` |
| API serverless | Auth PIN, CRUD ops, cron | `web/api/*.js` |
| Persistencia | Estado compartido + tablas + storage | `ops_kv`, `time_logs`, `shift_notes`, `menu_images` |
| Hardware local | Ticket y cajón | QZ Tray → POS-58 (CP858) |

---

## 4. Módulos

### Web pública (marca + carta)

Landing clara (`index.html`; `casa.html` redirige a `/`): hero, menú del día automático, carta con precios alineados al TPV, parking, Maps, WhatsApp, reserva web. Misma fuente de carta: `ops_kv` clave `carta` vía `/api/carta`. Fotos en Storage `menu_images`.

- Archivos: `carta-public.js`, `carta.js`, `styles.css`, `main.js`  
- Precios menú: entre semana **13 €** · sábado **16 €** · domingo/festivo **18 €** (festivos Gijón = domingo)

### TPV — corazón operativo

Terminal de sala por mesa. Móvil camarera + PC Windows sincronizados. Plano interactivo (Terraza / Reservas / barra), asignación de camarera, envío a cocina solo comida, cobro efectivo/tarjeta/mixto, cobro parcial, ticket térmico, jornada de caja, Total día con PIN dueña, editar carta, notas de turno, fichaje embebido, alerta de reserva web.

| Pieza | Archivo / API |
|-------|---------------|
| UI + lógica | `web/tpv.html` |
| Sync mesas | `tpvSync.js` · `/api/tpv-sync` · `_tpvMerge.js` |
| Plano | `planoMesas.js` · `ops_kv` `floor_plan` / SQL 011 |
| Jornada / ventas | `tpvJornada.js` · `/api/tpv-jornada` |
| Ticket / cajón | `printService.js` · `/api/qz-sign` |
| Versión forzada | `tpv-version.json` · `_tpvVersion.js` · `sw-tpv.js` |
| Carta editable | `/api/carta` · `/api/carta-image` |
| Notas turno | `/api/shift-notes` |

**Regla de producto:** camareros no ven importes de caja en la barra; Total día (PIN 2908) muestra totales, sección **Por mesa** con nombre de quien atendió, y corrección de tickets.

### Cocina KDS (PWA)

Monitor de cocina: solo líneas `categoryType: comida`. Estados de comanda, Listo / deshacer, menús españoles en 2 tiempos (1º → espera → 2º), histórico alineado con jornada. Instalable a pantalla completa (`manifest-cocina.webmanifest` + `sw-cocina.js`). Poll ~4 s en pantalla.

- `cocina.html` · `kitchenSync.js` · `/api/kitchen` · `cocina-version.json`  
- Force update **sin** 426 en create (el TPV no manda cabecera cocina)

### Reservas

App React del personal (alta rápida, estados confirmada / hecha / no show / anulada). Reserva pública desde la web escribe el mismo store y genera alerta amarilla en el TPV. Persistencia `ops_kv`: `reservas` + `tpvReservaAlerts`. Proyecto Vercel **desconectado de Git** a propósito (deploys solo CLI).

### Fichaje / horas

Entrada y salida con plantilla (Lorena, Claribel, Yuli, Dayana, Alison, Sharif), hora Europe/Madrid. Vista de horas con filtros y totales. Tabla `time_logs` (SQL 007); orientado al registro diario de jornada (RD-ley 8/2019). También embebido en el TPV.

### ERP oficina

Next.js 15 App Router: login PIN, dashboard P&L, caja TPV, top ventas (lee jornada/cierres desde `ops_kv`), historial, nuevo movimiento, fiscal trimestral, RRHH/nóminas, proveedores, documentos (Storage). RLS en tablas ERP. Bridge: `erp/src/lib/ops-kv.ts` + APIs jornada/cierres.

### Informes email + purge diario

Cron Vercel → `/api/ops-daily-purge`: limpia estado operativo (~08:00 Madrid) y dispara informes. Semanal (lun–dom) los lunes; mensual el día 1. HTML con ventas, comida/bebida, efectivo/tarjeta, top productos, picos de mesas. Envío Resend; fallback HTML en `ops_kv` si no hay key. Detalle: [`INFORMES-EMAIL.md`](./INFORMES-EMAIL.md).

---

## 5. Modelo de datos

### Idea central

El estado operativo del día (mesas, cocina, jornada, carta, reservas) vive en una tabla clave-valor Supabase llamada **`ops_kv`**. Las piezas formales (fichajes, notas, fotos, ERP) usan tablas o Storage con SQL versionado.

### Claves `ops_kv`

| Clave | Contenido | Quién escribe |
|-------|-----------|---------------|
| `tpv` | Mesas / carritos / camarera / notas | TPV sync |
| `kitchen` | Cola KDS + histórico del día | TPV + KDS |
| `jornada` | Jornada abierta + `sales[]` + totals | TPV cobros |
| `cierres` | Histórico cierres + `activityByHour` | Fin jornada |
| `carta` | Carta + menús del día | Editar Carta / seed |
| `floor_plan` | Overlay plano mesas | `planoMesas.js` |
| `reservas` | Agenda staff/pública | App reservas |
| `tpvReservaAlerts` | Avisos amarillos TPV | Reservas → TPV |
| `informe-log` / `informe-html:*` | Idempotencia + HTML informes | Purge |

### Tablas / Storage

| Recurso | Rol | SQL ref |
|---------|-----|---------|
| `public.time_logs` | Fichajes | `007_time_logs.sql` |
| `public.shift_notes` | Notas de turno TPV | `010_shift_notes.sql` |
| `public.tables` (opcional) | Plano realtime | `011_plano_mesas.sql` |
| Storage `menu_images` | Fotos platos | `008` + `009` |
| Tablas ERP + RLS | Gastos, RRHH, fiscal, docs | `erp/supabase/migrations` |

### Venta (`sale`) — unidad de caja

Cada cobro crea una sale en `jornada.sales` con: `id`, `at`, `mesa`, `total`, `base`, `iva`, `tip`, `paymentMethod`, `payments[]`, `lines[]`, y desde oct 2026 también `waiterId` / `waiterName` (quien atendió la mesa). Los totales agregan `byType`, `byCategory`, `byProduct`, `byPayment` y `byMesa`.

### Día operativo (`ops day`)

El día de caja **no corta a medianoche**: usa corte ~08:00 Europe/Madrid (`_opsDay.js`) para que el cierre de noche pertenezca al servicio correcto. El purge madrugada alinea cocina/TPV con ese día.

---

## 6. Flujos clave

### Pedido → cocina → cobro (crítico)

1. Camarera elige mesa en plano (queda asignada)  
2. Añade líneas a la cuenta (sync `ops_kv.tpv`)  
3. Enviar a cocina → solo comida a `ops_kv.kitchen`  
4. KDS marca Listo → aviso TPV  
5. Cobro (parcial/mixto opcional) → sale en jornada + opcional ticket POS-58 + cajón si efectivo  
6. Mesa se vacía y queda libre (sin camarera fantasma)  

### Carta única web ↔ TPV

Editar Carta (PIN dueña) → `POST /api/carta` (y fotos a Storage) → `ops_kv.carta`. Web pública y TPV leen la misma fuente. Seed desde JSON del deploy si hace falta. El TPV de sala no pinta fotos; la web sí.

### Reserva web → alerta sala

Formulario / app → store reservas → `tpvReservaAlerts` → badge amarillo en TPV. El personal confirma o gestiona en reservas-casatorino.

### Jornada → ERP / informes

Inicio jornada limpia ventas del turno. Cada cobro suma. Fin jornada archiva cierre (`activityByHour`). ERP Caja / Top ventas leen `ops_kv`. Purge + Resend mandan informe semanal/mensual.

### Force update TPV (anti-cliente viejo)

Tras cambiar TPV se sube la **misma versión** en 3 sitios:

1. `web/tpv-version.json` → `required`  
2. `web/api/_tpvVersion.js` → `required`  
3. `web/tpv.html` → `TPV_CLIENT_VERSION`  

Cada dispositivo ve «Actualiza para seguir». Mutaciones sin cabecera correcta → HTTP **426**.

### Impresión térmica POS-58

QZ Tray en el PC de caja habla ESC/POS con la POS-58 (58 mm). Layout: **24 columnas** útiles (antes 28 partía «2,60» y el «E»). Encoding CP858. TOTAL en doble ancho en una sola línea. Firma del sitio vía `/api/qz-sign`.

---

## 7. Seguridad, secretos y operación

### Baseline

| Área | Estado |
|------|--------|
| HTTPS / TLS Vercel | ✅ |
| Cookies sesión `HttpOnly; Secure; SameSite=Lax` | ✅ |
| Secretos fuera de Git | ✅ |
| PIN TPV en servidor (`TPV_PIN`) | ✅ |
| RLS Supabase (ERP) | ✅ |
| Headers: HSTS, nosniff, Referrer-Policy, XFO, Permissions-Policy | ✅ |
| Backup diario 03:00 Madrid | ✅ |
| CSP estricto | ⚠️ diferido |
| Rate-limit PIN | ⚠️ pendiente |

**Veredicto:** apto para un local con PIN; proporcional al riesgo (RGPD art. 32). No sustituye pentest formal.

### Secretos (nunca en el repo)

Plantillas: `web/.env.example` · `reservas/.env.example` · `erp/.env.example`.

| Módulo | Variables |
|--------|-----------|
| Web / TPV | `TPV_PIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TPV_SYNC_KEY`, `RESEND_*`, `REPORT_EMAIL_*` |
| Reservas | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ PINs runtime) |
| ERP | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ERP_PIN` |

**No subir:** `.env`, tokens, PINs reales, `.vercel/`, `node_modules/`.  
**No usar:** CrudCrud · `@vercel/blob` · Edge Config.

### Deploy

| Proyecto | Cómo se publica |
|----------|-----------------|
| casa-torino-web | Push `web/**` a `main` → Action Deploy (`VERCEL_TOKEN`) o CLI |
| reservas-casatorino | **Solo CLI** (Git desconectado). Health: `/api/reservas-health` |
| casa-torino-app | CLI desde `erp/` (`vercel deploy --prod`) |

**Publicar web (desde raíz del monorepo; Root = `web`):**

```bash
npx vercel link --yes --scope sebas3212 --project casa-torino-web
npx vercel deploy --prod --yes --scope sebas3212
npx vercel alias set <deployment>.vercel.app casa-torino-web.vercel.app --scope sebas3212
```

Comprobar: `/interno.html` · `/tpv.html` · `/cocina.html` · `/api/ops-health`

### Reservas — anti-regresión

**Estado seguro:** Supabase `ops_kv` clave `reservas` · GitHub desconectado del proyecto Vercel · Ignore Build Step activo.

1. No reconectar Git al proyecto `reservas-casatorino` sin `SUPABASE_*` en env  
2. Deploy solo CLI desde monorepo  
3. Nunca restaurar CrudCrud ni Edge Config  

### Recuperación

```bash
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git
cd CasaTorinoApp
./scripts/restaurar-modulo.sh web|reservas|erp|all
```

1. Configurar Root Directory en Vercel  
2. Pegar env desde `.env.example`  
3. Deploy · TPV: abrir `/tpv.html` + PIN  

Guía completa: [`RECUPERACION-GITHUB.md`](./RECUPERACION-GITHUB.md).

### Backup diario (03:00 Madrid)

Workflow: `.github/workflows/daily-backup.yml` · script `scripts/daily-backup.sh`

- Crea rama `backup/daily-YYYY-MM-DD` + tag desde **main**  
- Retención **14 días**  
- **No** deploy · **No** force-push a `main` · **No** toca Vercel  

Manual: `bash scripts/daily-backup.sh`

### Auth TPV

- PIN validado en `/api/tpv-auth` contra `TPV_PIN` (servidor; **no** en HTML)  
- Cookie HttpOnly `ct_tpv_session`  
- Sync mesas: `/api/tpv-sync` + `ops_kv`  

---

## 8. Cómo estudiarlo

| Paso | Documento / superficie | Objetivo |
|------|------------------------|----------|
| 1 | Este dossier (§1–2) + [`PRD.md`](./PRD.md) | Qué es el producto y cómo se vende |
| 2 | Este dossier (§3–5) + [`ESPECIFICACIONES-TECNICAS.md`](./ESPECIFICACIONES-TECNICAS.md) | Arquitectura, APIs, modelo de datos |
| 3 | [`MAPA-CODIGO.md`](./MAPA-CODIGO.md) | Saber qué archivo tocar sin explorar todo |
| 4 | Este dossier (§6–7) + [`RECUPERACION-GITHUB.md`](./RECUPERACION-GITHUB.md) | Flujos, deploy, secretos, recuperación |
| 5 | Flujo real: TPV → cocina → cobro → Total día | Conectar teoría con servicio |
| 6 | [`PLANO-MESAS.md`](./PLANO-MESAS.md) + [`INFORMES-EMAIL.md`](./INFORMES-EMAIL.md) | Detalle plano/sync e informes |

### Glosario

| Término | Significado |
|---------|-------------|
| TPV | Terminal punto de venta (sala) |
| KDS | Kitchen Display System (monitor cocina) |
| `ops_kv` | Tabla clave-valor Supabase del estado operativo |
| Jornada | Turno de caja abierto/cerrado con `sales[]` |
| PWA | App instalable (Cocina a pantalla completa) |
| Force update | Bloqueo por versión hasta pulsar Actualizar |
| Hobby | Plan gratis Vercel/Supabase; hay que cuidar cuota |

### Mensaje clave

No has «hecho una web»: has diseñado un **producto OS de restaurante** con límites claros, stack barato, sync real y documentación para venderlo y reconstruirlo. Domina el flujo **pedido → cocina → caja** y el modelo **`ops_kv`**; el resto es periferia de ese núcleo.

---

*Casa Torino OS · Ceares 67, Gijón · oct 2026*  
*Media demo: [`media/`](./media/).*

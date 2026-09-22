# Reservas — Casa Torino

Módulo de **reservas de sala** del monorepo [CasaTorinoApp](https://github.com/Sebastian-Tamayo/CasaTorinoApp).

App **mobile-first** para el personal: anotar y gestionar mesas en segundos, con la misma agenda visible para todo el equipo.

[![Live](https://img.shields.io/badge/demo-reservas--casatorino.vercel.app-000000?logo=vercel&logoColor=white)](https://reservas-casatorino.vercel.app)
[![Stack](https://img.shields.io/badge/stack-React%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Vercel-111827)](#stack-técnico)
[![Status](https://img.shields.io/badge/estado-producción-22c55e)](https://reservas-casatorino.vercel.app)

---

## Contexto

**Casa Torino** (Gijón) ya tenía web pública y ERP. Faltaba una pieza **operativa en sala**:

| Pieza | Rol |
|--------|-----|
| [Web pública](https://casa-torino-web.vercel.app) | Carta y demanda |
| **Reservas (este módulo)** | Captura y agenda del personal |
| [ERP](https://casa-torino-app.vercel.app) | Oficina / control |

### Problema
Cuando un cliente pide mesa, el personal necesita apuntarla **en segundos** desde el móvil, sin fricción, y que las 4 personas del equipo vean lo mismo.

### Solución
- Alta rápida (nombre, personas, día, hora, nota, teléfono opcional)
- Edición y listados (hoy / todas)
- Estados: confirmada · hecha · no vino · anulada
- Acceso por **nombre + PIN** (sin OAuth: prioridad a velocidad en barra)

**Producción:** https://reservas-casatorino.vercel.app  

> Acceso interno del personal (no es un booking público de clientes).

---

## Encaje en el ecosistema

```text
        Web pública  ──demanda──►  Reservas (sala)  ──ocupación──►  ERP
```

Para portfolio: producto **pequeño, desplegado y usado de verdad** (UX simple + API serverless + necesidad real).

---

## Funcionalidades

- [x] Login local del personal (perfiles + PIN)
- [x] Crear / editar reserva
- [x] Ver hoy / ver todas (fecha visible)
- [x] Cambiar estado (Hecha / No vino / Anular)
- [x] Acceso WhatsApp al teléfono del cliente
- [x] API serverless (`/api/reservas`)
- [x] Persistencia estable (**Vercel Edge Config**)
- [x] Healthcheck (`/api/reservas-health`)

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| UI | React 19 + TypeScript + Vite |
| Estilos | CSS propio (mobile-first) |
| Routing | React Router |
| API | Vercel Serverless (`api/`) |
| Persistencia | **Vercel Edge Config** (clave `reservas`) |
| Hosting | Vercel · proyecto `reservas-casatorino` · Root Directory = `reservas` |
| Auth | PIN por perfil |

> Nota histórica: se abandonó CrudCrud (límite ~100 req/día). Anti-regresión: [`../docs/TECNICO.md`](../docs/TECNICO.md) §6.

---

## Estructura

```text
reservas/
├── docs/                 # Producto, arquitectura, deploy, media
├── api/                  # Serverless Vercel
├── server/               # Store Edge Config + servidor local
├── src/
│   ├── components/
│   ├── pages/
│   ├── lib/api.ts
│   └── config.ts
├── vercel.json
└── README.md
```

Docs del monorepo: [`../docs/COMERCIAL.md`](../docs/COMERCIAL.md) · [`../docs/TECNICO.md`](../docs/TECNICO.md)

---

## Local

Desde la raíz del monorepo:

```bash
cd reservas
npm install
npm run dev          # Vite + API local
# o
npm run build && npm run preview
```

Variables: `reservas/.env.example` → `.env.local` / Vercel  
(`RESERVAS_EDGE_CONFIG_ID`, `RESERVAS_TEAM_ID`, `RESERVAS_VERCEL_TOKEN`).

---

## Deploy

Proyecto Vercel: `reservas-casatorino` (Root Directory `reservas`).  
Push a `main` en este monorepo redeploya solo si cambian archivos bajo `reservas/`.

Guía: [`../docs/TECNICO.md`](../docs/TECNICO.md) §4 y §6.

---

## Decisiones de diseño

1. **Personal primero** — menos pasos en la reserva presencial.  
2. **PIN simple** — velocidad en sala frente a OAuth.  
3. **Serverless + Edge Config** — sin servidor que mantener.  
4. **Extensión, no monolito** — respeta web y ERP.  

---

## Autor

**Sebastián Olaya Tamayo** — módulo del ecosistema [CasaTorinoApp](https://github.com/Sebastian-Tamayo/CasaTorinoApp).

Uso interno + portfolio. No redistribuir credenciales de producción.

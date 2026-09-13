# Casa Torino App — Ecosistema digital del negocio familiar

> **Un solo proyecto · Web + ERP + Reservas**  
> Bar-restaurante familiar de fusión **Colombo-Asturiana** en Gijón (`Ctra. Ceares, 67`).

[![GitHub](https://img.shields.io/badge/repo-CasaTorinoApp-181717?logo=github)](https://github.com/Sebastian-Tamayo/CasaTorinoApp)
[![Web](https://img.shields.io/badge/web-casa--torino--web.vercel.app-000000?logo=vercel)](https://casa-torino-web.vercel.app)
[![Reservas](https://img.shields.io/badge/reservas-reservas--casatorino.vercel.app-000000?logo=vercel)](https://reservas-casatorino.vercel.app)
[![ERP](https://img.shields.io/badge/ERP-casa--torino--app.vercel.app-000000?logo=vercel)](https://casa-torino-app.vercel.app/login)
[![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20React%20%7C%20Supabase%20%7C%20Vercel-111827)](#módulos-del-ecosistema)

Este repositorio **unifica** lo que antes estaba repartido en varios sitios:

| Antes (separado) | Ahora (aquí) |
|------------------|--------------|
| Landing inauguración (Netlify, archivo) | [`web/`](web/) principal en Vercel + [`web/archivo/inauguracion/`](web/archivo/inauguracion/) |
| ERP / back-office (`CasaTorinoApp`) | [`erp/`](erp/) |
| App de reservas (en `Proyeccion`) | [`reservas/`](reservas/) |

Forman **el mismo negocio**: la web atrae, el ERP controla la operativa y las reservas gestionan la sala.

---

## Visión del ecosistema

```text
                         CLIENTES
                            │
                            ▼
              ┌─────────────────────────┐
              │  web/  · Marca pública  │  Carta, menú del día, equipo
              │  casa-torino-web…       │  Contacto / WhatsApp
              └────────────┬────────────┘
                           │ demanda / canal
                           ▼
              ┌─────────────────────────┐
              │  reservas/ · Sala       │  Alta rápida, edición, estados
              │  reservas-casatorino…   │  Personal + PIN interno
              └────────────┬────────────┘
                           │ ocupación / servicio
                           ▼
              ┌─────────────────────────┐
              │  erp/ · Back-office     │  Gastos, ingresos, fiscal,
              │  Next.js + Supabase     │  RRHH, documentos, proveedores
              └─────────────────────────┘
```

**Para reclutadores:** no son tres demos sueltas. Es un **producto conjunto** de un negocio familiar real: front de marca + operativa de sala + ERP mobile-first.

---


## Recuperación y secretos

- Guía: [`docs/RECUPERACION.md`](docs/RECUPERACION.md)
- Por módulo: `./scripts/restaurar-modulo.sh web|reservas|erp|all`
- Publicar backup en GitHub (desde tu PC con permiso de push):
  ```bash
  curl -fsSL https://raw.githubusercontent.com/Sebastian-Tamayo/Proyeccion/main/docs/publicar-en-casatorinoapp.sh | bash
  ```
- **El PIN del TPV, tokens y URLs de store no están en el código.** Solo en variables de entorno de Vercel.

### TPV (dentro de `web/`)
- Acceso con PIN del personal (validado en servidor)
- Sync en vivo móvil ↔ PC por número de mesa
- Impresión QZ Tray + apertura de cajón al cobrar

## Módulos del ecosistema

### 1. [`web/`](web/) — Página pública (principal)
Landing HTML/CSS/JS con carta (precios), menú del día, equipo, contacto y hub **Gestión interna**.  
**Producción:** https://casa-torino-web.vercel.app  
**Deploy Vercel:** Root Directory = `web`

Archivo histórico (solo inauguración): [`web/archivo/inauguracion/`](web/archivo/inauguracion/) · [casatorino.netlify.app](https://casatorino.netlify.app) — **no es la web principal**

### 2. [`reservas/`](reservas/) — Gestión de mesas (personal)
App React + TypeScript + Vite + API serverless en Vercel.  
Uso interno del equipo (PIN interno, no público).  
Los clientes reservan por WhatsApp; esta app es solo para el personal.  
**Live:** https://reservas-casatorino.vercel.app  
**Deploy Vercel:** Root Directory = `reservas`

### 3. [`erp/`](erp/) — ERP / back-office de hostelería
Next.js 15 + Supabase (PostgreSQL, Storage, RLS) + Tailwind.  
Gastos, ingresos, P&L, fiscal trimestral, RRHH, documentos y proveedores.  
Login = hub de **Gestión interna** (accesos a Reservas + ERP).  
**Live:** https://casa-torino-app.vercel.app/login  
**Deploy Vercel:** Root Directory = `erp`

---

## Estructura del monorepo

```text
CasaTorinoApp/
├── README.md
├── docs/
│   ├── ECOSISTEMA.md
│   └── media/          # capturas ERP / web / reservas
├── web/                # ← WEB PRINCIPAL (Vercel)
│   ├── index.html
│   ├── interno.html    # hub personal → Reservas + ERP
│   ├── styles.css
│   ├── main.js
│   ├── assets/
│   └── archivo/
│       └── inauguracion/   # landing Netlify histórica
├── reservas/           # app staff (PIN)
└── erp/                # Next.js + Supabase
```

---

## Cómo arrancar en local

### Web
```bash
cd web && npx serve .
```

### Reservas
```bash
cd reservas && npm install && npm run dev
```

### ERP
```bash
cd erp
cp .env.example .env.local   # URL + anon key de Supabase
npm install && npm run dev
```

---

## Deploys (producción)

| Módulo | Hosting | Root Directory | URL |
|--------|---------|----------------|-----|
| Web principal | Vercel | `web` | https://casa-torino-web.vercel.app |
| Reservas | Vercel | `reservas` | https://reservas-casatorino.vercel.app |
| ERP | Vercel | `erp` | https://casa-torino-app.vercel.app |
| Web inauguración (archivo) | Netlify | — | https://casatorino.netlify.app |

# Casa Torino — Reservas (extensión operativa)

> Módulo del monorepo **[CasaTorinoApp](https://github.com/Sebastian-Tamayo/CasaTorinoApp)**  
> Ecosistema: Web pública · ERP/back-office · Reservas de sala.


> **Caso real · negocio familiar · Gijón**  
> Módulo de reservas para el personal de **Casa Torino**, pensado como **extensión** de la web pública ya publicada y del ERP / operativa interna del negocio.

[![Live](https://img.shields.io/badge/demo-reservas--casatorino.vercel.app-000000?logo=vercel&logoColor=white)](https://reservas-casatorino.vercel.app)
[![Stack](https://img.shields.io/badge/stack-React%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Vercel-111827)](#stack-técnico)
[![Status](https://img.shields.io/badge/estado-producción-22c55e)](https://reservas-casatorino.vercel.app)

---

## Contexto del negocio

**Casa Torino** es un bar-restaurante familiar de **fusión Colombo-Asturiana** en Gijón (`Ctra. Ceares, 67`).

Ya existían:

| Pieza | Rol |
|--------|-----|
| **Web pública** | Landing / marca / inauguración → [casatorino.netlify.app](https://casatorino.netlify.app) |
| **ERP / operativa familiar** | Gestión interna del negocio (stock, caja, procesos del día a día) |

Este proyecto **no sustituye** esas piezas: las **complementa**.

### Problema real
Cuando un cliente se acerca a reservar, el personal necesita anotar la mesa **en segundos**, desde el móvil, sin fricción, y que las **4 personas del equipo** vean lo mismo al instante.

### Solución
App web **mobile-first** para el personal:

- Alta rápida de reserva  
- Edición (hora, personas, datos…)  
- Lista del día / todas con fecha visible  
- Estados: confirmada · hecha · no vino · anulada  
- Acceso simple por nombre + PIN (sin cuentas complejas)

**Producción (Vercel):** https://reservas-casatorino.vercel.app  

> PIN de demostración del equipo: `1234` (Lorena / Yuli / Dayana / Claribel). Cambiar en producción vía `src/config.ts`.  
> Guía de deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Encaje en el ecosistema Casa Torino

```text
                    CLIENTES
                       │
                       ▼
        ┌──────────────────────────┐
        │  Web pública (Netlify)   │  Marca, carta, historia, contacto
        │  casatorino.netlify.app  │
        └────────────┬─────────────┘
                     │  canal / demanda
                     ▼
        ┌──────────────────────────┐
        │  Reservas (este repo)    │  Captura operativa en sala
        │  reservas-casatorino…    │  Móvil del personal (Vercel)
        └────────────┬─────────────┘
                     │  datos de ocupación / servicio
                     ▼
        ┌──────────────────────────┐
        │  ERP familiar existente  │  Operativa, control interno,
        │  (negocio)               │  continuidad del día a día
        └──────────────────────────┘
```

**Para reclutadores:** es un ejemplo de producto **pequeño, desplegado y usado de verdad**, uniendo UX simple + API serverless + necesidad de negocio familiar.

---

## Capturas / vídeo (pendiente)

Las capturas y GIFs se añadirán aquí:

| Media | Descripción | Archivo |
|--------|-------------|---------|
| Login personal | Selector de persona + PIN | `docs/assets/01-login.png` *(próximamente)* |
| Alta rápida | Formulario móvil | `docs/assets/02-nueva-reserva.png` *(próximamente)* |
| Lista “Todas” | Fecha + hora visibles | `docs/assets/03-lista-todas.png` *(próximamente)* |
| Edición | Cambio de hora / personas | `docs/assets/04-editar.gif` *(próximamente)* |

Plantilla y naming: [`docs/MEDIA.md`](docs/MEDIA.md).

---

## Funcionalidades

- [x] Login local del personal (4 perfiles + PIN)
- [x] Crear reserva (nombre, teléfono opcional, personas, día, hora, nota)
- [x] Editar reserva existente
- [x] Ver hoy / ver todas (con **fecha visible** en listado)
- [x] Cambiar estado (Hecha / No vino / Anular)
- [x] Acceso WhatsApp al teléfono del cliente
- [x] API serverless en Vercel (`/api/reservas`)
- [x] Deploy en Vercel (producción)

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| UI | React 19 + TypeScript + Vite |
| Estilos | CSS propio (mobile-first, identidad Casa Torino) |
| Routing | React Router |
| API | Vercel Serverless Functions (`/api/reservas`) |
| Persistencia | Store HTTP remoto (CrudCrud; sustituible por Blob/KV) |
| Hosting | Vercel |
| Auth personal | PIN por perfil (sin OAuth, a propósito: simplicidad en sala) |

---

## Estructura del proyecto

```text
casa-torino-reservas/
├── docs/                  # Producto, arquitectura, media
├── api/                   # Vercel Serverless (listado, alta, edición)
├── server/                # Helpers compartidos + API local Express
├── public/                # Logo y estáticos
├── src/
│   ├── components/        # Topbar
│   ├── lib/api.ts         # Cliente HTTP
│   ├── pages/StaffPage.tsx
│   ├── config.ts          # Negocio + personal + PIN
│   └── ...
├── vercel.json
└── README.md              # Este documento
```

Más detalle: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) · [`docs/PRODUCTO.md`](docs/PRODUCTO.md) · [`docs/DEPLOY.md`](docs/DEPLOY.md)

---

## Cómo ejecutarlo en local

```bash
cd casa-torino-reservas
npm install
npm run build
npm run preview
```

Desarrollo con Vite + API local:

```bash
npm run dev
```

En producción la app llama a `/api/reservas` en el mismo dominio (Vercel).

### Deploy en Vercel

```bash
cd casa-torino-reservas
npx vercel login
npx vercel --prod
```

Opcional: variable de entorno `RESERVAS_STORE_URL` para el endpoint de persistencia.

---

## Decisiones de diseño (resumen)

1. **Personal primero, no cliente final** → reduce pasos en el momento de la reserva presencial.  
2. **PIN simple vs Google Auth** → prioridad a velocidad en barra/sala.  
3. **Serverless + store remoto** → sin servidor que mantener para un negocio pequeño.  
4. **Extensión, no monolito** → respeta web pública y ERP ya existentes.  
5. **Migración Netlify → Vercel** → continuidad del servicio tras agotar créditos de Netlify.

---

## Autor

**Sebastián Olaya Tamayo** — módulo del ecosistema [`CasaTorinoApp`](https://github.com/Sebastian-Tamayo/CasaTorinoApp): transición L3 → DevOps/Cloud → producto/negocio.

---

## Licencia / uso

Proyecto de portfolio y uso interno del negocio familiar Casa Torino.  
No redistribuir credenciales de producción.

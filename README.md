# 🍽️ Casa Torino App - Ecosistema Gastronómico (Monorepo)

Sistema integral desarrollado a medida para el restaurante Casa Torino (Gijón). Sustituye soluciones comerciales de TPV por una arquitectura propia, sin latencia, sin cuotas mensuales y adaptada 100% a las lógicas específicas del negocio.

**Prueba de estrés en producción:** Facturación de +2.600€ y gestión de +130 comensales concurrentes durante el fin de semana de inauguración de terraza, operando sin caídas y con sincronización en tiempo real.

## 🚀 Arquitectura y Módulos

El ecosistema se divide en los siguientes módulos para producción:
*   **/web (https://casa-torino-web.vercel.app):** Web pública clara (`#fff8e8`), Gestión interna, TPV móvil/escritorio y Monitor de Cocina (KDS).
*   **/reservas (https://reservas-casatorino.vercel.app):** App de reservas del staff usando React, Vite y Vercel Edge Config (sin latencia de BBDD tradicional).
*   **/erp (https://casa-torino-app.vercel.app):** Back-office construido con Next.js y Supabase.

## 🧠 Retos Técnicos Resueltos en Producción

1. **Lógica de Enrutamiento KDS:** El sistema discrimina el destino de los productos. Los postres van directamente a la barra y no saturan la pantalla de cocina.
2. **Gestión de Tiempos Asíncronos (Menús Mixtos):** Implementación de estados complejos de preparación. El "Menú Español" exige 2 tiempos (Listo 1º → TPV recoge → Listo 2º). El "Menú Colombiano" fluye en un solo tiempo.
3. **Hardware Local desde la Nube:** Comunicación sin fricción entre un TPV web (Vercel) y el hardware físico local. La impresión vía QZ Tray apunta a "POS-58". La acción "Ticket" imprime sin cerrar mesa, mientras que "Cobrar" abre el cajón, limpia la mesa y registra la jornada[cite: 1].
4. **UX Móvil Fluida:** Mantenimiento del scroll nativo en móviles para los camareros (sin bloqueos por `touch-action: none`), mientras se conserva la interfaz de paneles en pantallas anchas (≥1024px)[cite: 1].
5. **Seguridad:** Los secretos y el PIN del personal (`TPV_PIN`) viven exclusivamente en Vercel, nunca en el código[cite: 1]. El acceso exige validación por PIN en todo momento[cite: 1].

---

## 🔒 Documentación Técnica Interna (Staff Casa Torino)

> **Aviso:** Este repositorio es el backup continuo del software operativo. Nunca subas PINs, tokens ni `.env` reales a GitHub[cite: 1]. 

### Estado actual (15 sep 2026)[cite: 1]

**Carta / precios**[cite: 1]
- Menú entre semana: español 14 € · colombiano 13 €[cite: 1]
- Fin de semana: español 18 € · colombiano 15 €[cite: 1]
- Refrescos 2,50 €[cite: 1]
- Categoría Cafés separada de bebidas (café, café con leche, infusión, té frío)[cite: 1]

**Operativa TPV**
- Precio editable en la cuenta solo en menús y en productos Varios / libre
- Sync / jornada / cocina vía Supabase `ops_kv` (`web/api/_opsStore.js`)
- Carta única: `web/data/carta.json` (web pública + TPV)
- Cobro con efectivo/tarjeta (+ propina opcional) → cierres con desglose
- Menús del día: filtro automático semana/finde (Europe/Madrid), override en TPV

### Histórico de cocina
Los pedidos marcados como Listo se guardan en histórico del día; se renuevan con inicio de jornada TPV.

### Deploy
Ver checklist: [`docs/DEPLOY-CHECKLIST.md`](docs/DEPLOY-CHECKLIST.md).

### Variables de Entorno y Despliegue[cite: 1]
Para desarrollar en local: copiar credenciales a `web/.env.local` (no se sube a Git)[cite: 1].

**Deploy seguro (web)**[cite: 1]
```bash
cd web
bash scripts/assert-light-theme.sh   # falla si el tema no es claro
bash scripts/deploy-web.sh           # deploy a producción
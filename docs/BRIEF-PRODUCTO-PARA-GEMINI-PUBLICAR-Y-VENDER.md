# BRIEF DE PRODUCTO — Ecosistema digital para hostelería
## Documento maestro para Gemini (publicar · empaquetar · vender)

> **Instrucciones para Gemini:** Usa este documento como fuente de verdad.  
> Genera a partir de él: landing de venta, ficha de producto, pitch deck, copy para Product Hunt / Gumroad / LinkedIn, propuesta comercial B2B para bares, FAQ, y guion de demo.  
> Tono: profesional, claro, orientado a dueños de bar/restaurante (no jerga innecesaria). Destaca: **sin cuotas caras**, **todo conectado**, **probado en producción real**.

| Campo | Valor |
|---|---|
| **Nombre comercial sugerido** | *Casa Torino OS* · *Torino Suite* · *Hostelería Completa* (elige uno o propón variantes) |
| **Producto real / referencia** | Ecosistema Casa Torino (monorepo en producción) |
| **Autor / creador** | Sebastián Olaya Tamayo (Sebas-Dev) |
| **Repo** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Fecha del brief** | Septiembre 2026 |
| **Estado** | En producción real en un restaurante de Gijón (España) |
| **Modelo de stack** | 100 % gratis / Hobby (Vercel + Supabase free) — margen alto para el negocio |

---

## 1. Elevator pitch (30 segundos)

Un **ecosistema digital completo para bares y restaurantes**: web pública, reservas, TPV por mesa, monitor de cocina, fichaje legal de personal y ERP de oficina — todo conectado, con PIN, sincronizado en tiempo real y **sin pagar licencias mensuales caras** tipo Square/Revo/CoverManager.

No es “una app suelta”. Es el **día a día del local digitalizado de punta a punta**.

**Prueba de fuego en producción:** +2.600 € facturados y +130 comensales concurrentes en un fin de semana de inauguración de terraza, sin caídas y con sync en tiempo real.

---

## 2. Problema que resuelve

### Antes (típico en hostelería pequeña)
- Pedidos a viva voz o en papel → errores, gritos, mesas mal cobradas.
- Móvil y PC no comparten la misma cuenta.
- Cocina no ve al instante lo que pide sala.
- Reservas en WhatsApp caótico / Excel.
- No hay registro horario fiable (riesgo Inspección de Trabajo).
- Caja, gastos y nóminas en cuadernos o apps sueltas que no hablan entre sí.
- Software comercial: 50–300 €/mes por módulo, contratos rígidos, features que no usan.

### Ahora (este producto)
- Una mesa = una cuenta digital compartida.
- Pedido en móvil → aparece en PC y en cocina.
- Reservas con alerta en TPV.
- Fichaje entrada/salida conforme a la ley española.
- Dueñas ven caja, gastos, fiscal y RRHH en el móvil.
- Coste de infraestructura ≈ **0 €/mes** en planes free (con buen margen para vender instalación + soporte).

---

## 3. Mapa del producto (qué incluye)

```text
                         CLIENTES
                            │
                            ▼
              ┌─────────────────────────┐
              │  WEB PÚBLICA (marca)    │  Carta, menú, parking, WhatsApp, reserva
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  GESTIÓN INTERNA (PIN)  │  Hub del personal
              └─┬──────┬──────┬─────┬───┘
                │      │      │     │
           ┌────▼──┐ ┌─▼───┐ ┌▼───┐ ┌▼────────┐
           │  TPV  │ │Cocina│ │Res.│ │ ERP     │
           │ sala  │ │ KDS  │ │vas │ │ oficina │
           └────┬──┘ └──▲──┘ └────┘ └─────────┘
                │       │
                └──comida──┘     + Fichaje / horas trabajadas
```

| Módulo | URL producción (referencia) | Para quién |
|---|---|---|
| Web pública | https://casa-torino-web.vercel.app | Clientes |
| Gestión interna | …/interno.html | Equipo (PIN) |
| TPV | …/tpv.html | Sala / barra |
| Cocina (KDS) | …/cocina.html | Cocina |
| Fichaje / horas | …/fichaje.html | Dueñas / personal |
| Reservas staff | https://reservas-casatorino.vercel.app | Personal |
| ERP oficina | https://casa-torino-app.vercel.app | Dueñas / admin |

---

## 4. Inventario completo de funcionalidades

### 4.1 Web pública (escaparate)
- Diseño claro / crema, marca primero, mobile-first.
- Carta con precios (misma fuente que el TPV).
- Menús del día (español / colombiano) con lógica semana vs fin de semana.
- Productos estrella, fotos, parking 24 h, dirección, Maps.
- Reserva por web + WhatsApp.
- SEO / Open Graph (compartir en redes con logo).
- Acceso discreto a “Gestión interna”.

### 4.2 Gestión interna (hub)
- PIN del personal.
- Enlaces a TPV, Cocina, Reservas, ERP, Horas trabajadas.
- Botón volver a web / cerrar sesión.

### 4.3 TPV — sala (el corazón operativo)
- Pedidos **por mesa** (móvil + PC sincronizados).
- Carta por categorías (Colombia, España, picoteo, menús, bebidas, cafés…).
- Buscador de productos.
- Envío a cocina (solo comida; bebidas se quedan en barra).
- Notas de pedido (alergias, “sin cebolla”…).
- Menús mixtos con **2 tiempos** (español) vs 1 tiempo (colombiano).
- “Siguiente plato” / estados asíncronos con cocina.
- Cobro: efectivo / tarjeta, propina opcional.
- **Cobro parcial / pagos divididos** (selección de líneas).
- Ticket de impresión (QZ Tray → POS-58) sin cerrar mesa.
- Cobrar: registra venta, limpia mesa, abre cajón (si hay hardware).
- Jornada de caja: inicio / total / fin de sesión.
- Historial de cierres → ERP.
- Mesas pendientes de cobro + tiempos de línea.
- **Editar Carta** desde el TPV (PIN admin): alta / baja / precios → se refleja en la web.
- **Alerta amarilla** cuando entra una reserva web.
- Botón **Fichaje** (entrada/salida camareras).
- Purge diario automático de estado operativo (madrugada).
- PIN / sesión 24 h con renovación.

### 4.4 Monitor de cocina (KDS)
- Pantalla grande solo comida.
- Tickets en vivo + alarma.
- Botón **Listo** / deshacer / histórico del día.
- Lógica de menús: 1º plato → espera TPV → 2º plato.
- Se limpia / alinea con inicio–fin de jornada del TPV.
- PIN de acceso.

### 4.5 Reservas (staff + puente web)
- App móvil del personal (React + Vite).
- Alta rápida: quién, cuántos, hora, notas.
- Estados: confirmada / hecha / cancelada / no show.
- PIN del personal.
- Reserva desde la web pública → llega al store + **alerta en TPV**.
- Persistencia Edge Config (baja latencia).

### 4.6 Fichaje / registro horario (cumplimiento legal ES)
- Entrada (verde) / Salida (rojo).
- Select de plantilla: Lorena, Claribel, Yuli, Dayana, Alison, Sharif.
- Hora exacta Europe/Madrid.
- Guardado en Supabase (`time_logs`; fallback `ops_kv`).
- Vista **Horas trabajadas**: filtros por fechas / camarera, totales, tramos, abiertos.
- Orientado a RD-ley 8/2019 (registro diario, conservación 4 años).
- Soporta **turnos partidos** (varios fichajes/día).

### 4.7 ERP — oficina (mobile-first)
- Login PIN administración.
- **Inicio / dashboard** P&L operativo.
- **Caja TPV**: ver cierres e ingresos del local.
- **Gastos / ingresos** con categorías (incl. Nóminas y SS).
- **Documentos**: facturas, albaranes, contratos (Storage).
- **RRHH**: empleados, liquidar mes, nóminas.
- **Fiscal**: IVA soportado/repercutido, trimestres.
- **Proveedores**: ranking de compras.
- **Perfil** / cerrar sesión.
- RLS en Supabase (seguridad por políticas).

---

## 5. Stack técnico (para compradores técnicos / white-label)

| Capa | Tecnología | Coste típico |
|---|---|---|
| Hosting web/TPV/KDS | Vercel Hobby | 0 € |
| Reservas | Vercel + Edge Config | 0 € (Hobby) |
| ERP | Next.js 15 + Vercel | 0 € |
| Datos operativos | Supabase free (`ops_kv`, `time_logs`, tablas ERP) | 0 € |
| Impresión local | QZ Tray + impresora POS-58 | Hardware del local |
| Monorepo | GitHub | 0 € |
| Auth operativa | PIN + cookies HttpOnly (no exponer secretos en front) | — |

**Principio de diseño:** preferir almacenamiento **Supabase free** frente a Blob/Edge de pago; deploys controlados para no saturar el límite Hobby de storage.

**Arquitectura clave**
- Monorepo: `/web` · `/reservas` · `/erp` · `/docs`
- Sync TPV ↔ cocina ↔ jornada vía API serverless + Supabase
- Carta única compartida web + TPV
- Tema claro de marca (crema + oro) en web pública; dark UX táctil en TPV/KDS

---

## 6. Diferenciadores vs competencia

| vs | Ellos | Este producto |
|---|---|---|
| Revo / Square / SoftRestaurant | Cuota mensual alta, genérico | A medida, stack free, margen para el vendedor |
| CoverManager / TheFork | Solo reservas / marketing | Reservas + TPV + cocina + ERP + fichaje |
| Excel + WhatsApp | Caos, sin sync | Tiempo real sala–cocina–caja |
| Apps sueltas de fichaje | Otro login, otro coste | Integrado en el TPV que ya usan |
| “TPV solo” | No cierra el círculo | Del cliente en la web al P&L de la dueña |

**Ventaja comercial al venderlo:**  
Instalación + personalización + formación + soporte mensual barato, porque la infra casi no cuesta.

---

## 7. Prueba social / hechos de producción

- Restaurante real: **Casa Torino**, Ctra. Ceares 67, Gijón (fusión Colombo-Asturiana).
- Estrés real: **+2.600 €** y **+130 comensales** concurrentes en fin de semana de terraza.
- Operativa diaria: carta viva, mesas, cocina KDS, cierres a ERP.
- Cumplimiento: registro horario digital propio.
- Código respaldado en GitHub (patrimonio del negocio / del producto).

---

## 8. Empaquetado sugerido para VENDER

### Pack A — “Escaparate” (entrada)
Web pública + reserva WhatsApp/web + gestión interna básica.  
**Para:** locales que solo quieren presencia y reservas ordenadas.

### Pack B — “Sala + Cocina” (core)
Todo A + TPV + KDS + jornada + impresión ticket.  
**Para:** bares que quieren dejar el papel.

### Pack C — “Local completo” (recomendado)
Todo B + Reservas staff + alerta TPV + Editar carta + Fichaje legal + Horas.  
**Para:** equipos con varias camareras y turnos.

### Pack D — “Dueña / Oficina”
Todo C + ERP (caja, gastos, fiscal, RRHH, documentos, P&L).  
**Para:** dueñas que quieren control sin gestoría diaria.

### Extras de monetización
- Instalación / onboarding (1–2 días).
- Impresora + QZ Tray configurado.
- Personalización de carta, marca y PIN.
- Soporte mensual (WhatsApp / remoto).
- White-label: cambiar nombre, colores, logo, dominio.
- Formación al personal (guion 30–45 min).

### Precios orientativos (Gemini: propón 3 rangos ES/LatAm)
- Setup Pack B: ___ € (único)
- Setup Pack D: ___ € (único)
- Soporte: ___ €/mes  
*(El margen es alto porque Vercel+Supabase free cubren el hosting.)*

---

## 9. Demo en 4 minutos (guion)

1. **Web** (30 s): carta, parking, reservar.  
2. **Reservar** → llega alerta amarilla al **TPV**.  
3. **TPV**: mesa → pedir menú + bebida → Enviar a cocina → ver solo comida en **KDS**.  
4. Cocina **Listo** → sala cobra / ticket.  
5. **Fichaje** entrada/salida → **Horas trabajadas**.  
6. **ERP**: ver cierre / gasto / P&L.

---

## 10. Seguridad y límites (honestidad comercial)

**Incluye**
- PIN en zonas internas.
- Secretos en variables de entorno (nunca en el repo).
- RLS en tablas ERP.
- Fichajes tipo append (insert); vista para dueñas.

**No promete (aún)**
- Contabilidad oficial AEAT / presentación automática de modelos.
- Multi-local avanzado / franquicias (se puede evolucionar).
- App nativa iOS/Android (es web PWA-friendly / móvil navegador).
- Sustituir a un asesor fiscal; el ERP **ordena** datos para la gestoría.

---

## 11. Deliverables al comprador / al white-label

1. Código monorepo (GitHub).  
2. 3 proyectos Vercel (web, reservas, ERP) o plantilla.  
3. Proyecto Supabase + migraciones SQL.  
4. Documentación de deploy y PINs.  
5. Guía dueñas + este brief.  
6. Checklist de puesta en marcha (impresora, PIN, carta, personal).

---

## 12. Keywords / SEO / posicionamiento (para Gemini)

`TPV hostelería`, `TPV restaurante gratis`, `monitor cocina KDS`, `software bar España`, `registro horario hostelería`, `fichaje camareras`, `ERP bar`, `alternativa Revo`, `reservas restaurante WhatsApp`, `carta digital sincronizada`, `pagos divididos mesa`, `TPV móvil camareros`.

**Promesa corta (tagline opciones)**
- “Del WhatsApp al P&L: tu local, conectado.”
- “TPV + cocina + reservas + fichaje + oficina. Sin cuota abusiva.”
- “Hecho en un bar real. Listo para el tuyo.”

---

## 13. Assets vivos para capturas / demo

- Web: https://casa-torino-web.vercel.app  
- Interna: https://casa-torino-web.vercel.app/interno.html  
- TPV: https://casa-torino-web.vercel.app/tpv.html  
- Cocina: https://casa-torino-web.vercel.app/cocina.html  
- Horas: https://casa-torino-web.vercel.app/fichaje.html  
- Reservas: https://reservas-casatorino.vercel.app  
- ERP: https://casa-torino-app.vercel.app  
- Repo: https://github.com/Sebastian-Tamayo/CasaTorinoApp  

> Nota: las zonas internas piden PIN. Para demos públicas, usar entorno staging o vídeo grabado.

---

## 14. Prompts listos para pegar en Gemini

### Prompt A — Landing de venta
> Con este brief, escribe una landing page en español (HTML semántico + secciones) para vender el Pack D a dueños de bares en España. Incluye hero, problema, módulos, comparativa, precios, FAQ y CTA WhatsApp.

### Prompt B — Pitch deck
> Crea un outline de 10 diapositivas para presentar este ecosistema a un restaurante familiar. Texto de cada slide + notas del presentador.

### Prompt C — Ficha Product Hunt / Gumroad
> Redacta título, tagline, descripción larga, 5 bullets y 3 FAQs en inglés y español.

### Prompt D — Propuesta comercial PDF
> Genera una propuesta formal para “Restaurante Ejemplo S.L.” con packs A–D, alcance, plazos de instalación (días laborables técnicos, sin calendarios), y exclusiones.

### Prompt E — Guion Reel / TikTok 45 s
> 3 ganchos + guion hablado mostrando TPV → cocina → cobro.

---

## 15. Resumen en una frase (cierre)

**Un sistema de hostelería completo — web, reservas, TPV, cocina, fichaje y ERP — nacido en un restaurante real, pensado para venderse a otros locales con margen alto porque corre en infraestructura gratuita.**

---

*Fin del brief. Fuente: monorepo CasaTorinoApp · producción Gijón · sept 2026.*

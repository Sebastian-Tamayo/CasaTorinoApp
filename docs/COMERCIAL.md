# Casa Torino OS — Documento comercial

Ecosistema digital completo para hostelería, **en producción** en Casa Torino (Gijón).  
Fuente de verdad para vender, explicar a dueñas y generar landing / pitch / propuesta.

| | |
|---|---|
| **Producto** | Casa Torino OS (web + TPV + cocina + reservas + fichaje + ERP) |
| **Autor** | Sebastián Olaya Tamayo (Sebas-Dev) |
| **Repo** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Estado** | Producción real · sept 2026 |
| **Infra** | Vercel + Supabase Hobby ≈ **0 €/mes** |

---

## 1. Pitch (30 s)

Un **sistema de hostelería de punta a punta**: web pública, reservas, TPV por mesa, monitor de cocina, fichaje legal y ERP de oficina — todo conectado, con PIN, sync en tiempo real y **sin cuotas tipo Square/Revo/CoverManager**.

**Prueba de fuego:** +2.600 € facturados y +130 comensales concurrentes en un fin de semana de terraza, sin caídas.

---

## 2. Problema → solución

| Antes (bar típico) | Ahora |
|---|---|
| Pedidos a viva voz / papel | Mesa = cuenta digital compartida |
| Móvil y PC desincronizados | Pedido en móvil → PC y cocina al instante |
| Reservas en WhatsApp / Excel | Agenda staff + alerta en TPV |
| Sin registro horario fiable | Fichaje entrada/salida (RD-ley 8/2019) |
| Caja y gastos en cuadernos | ERP: P&L, fiscal, RRHH, documentos |
| Software 50–300 €/mes por módulo | Infra gratis; margen en instalación + soporte |

---

## 3. Mapa del producto

```text
                         CLIENTES
                            │
              ┌─────────────▼─────────────┐
              │  WEB PÚBLICA (marca)      │  Carta, menú, parking, WhatsApp, reserva
              └─────────────┬─────────────┘
              ┌─────────────▼─────────────┐
              │  GESTIÓN INTERNA (PIN)    │
              └─┬──────┬──────┬─────┬─────┘
           ┌────▼──┐ ┌─▼───┐ ┌▼───┐ ┌▼────────┐
           │  TPV  │ │Cocina│ │Res.│ │ ERP     │
           │ sala  │ │ KDS  │ │vas │ │ oficina │
           └───────┘ └─────┘ └────┘ └─────────┘
                         + Fichaje / horas
```

| Módulo | URL | Para quién |
|---|---|---|
| Web pública | https://casa-torino-web.vercel.app | Clientes |
| Gestión interna | …/interno.html | Equipo (PIN) |
| TPV | …/tpv.html | Sala / barra |
| Cocina (KDS) | …/cocina.html | Cocina |
| Fichaje / horas | …/fichaje.html | Dueñas / personal |
| Reservas staff | https://reservas-casatorino.vercel.app | Personal |
| ERP oficina | https://casa-torino-app.vercel.app | Dueñas / admin |

---

## 4. Qué incluye (inventario)

### Web pública
Carta con precios (misma fuente que el TPV), menús del día ES/CO, parking, Maps, reserva web + WhatsApp, SEO/OG, acceso discreto a gestión interna. Diseño claro / marca primero.

### Gestión interna
Hub con PIN → TPV, Cocina, Reservas, ERP, Horas trabajadas.

### TPV (corazón operativo)
- Pedidos **por mesa** (móvil + PC sincronizados)
- Carta por categorías + buscador
- Envío a cocina (solo comida); notas / alergias
- Menús mixtos: español 2 tiempos vs colombiano 1 tiempo
- Cobro efectivo/tarjeta, propina, **cobro parcial / pagos divididos**
- Ticket QZ Tray → POS-58; cajón al cobrar
- Jornada de caja + historial de cierres → ERP
- **Editar Carta** (PIN admin) → se refleja en la web
- Alerta amarilla de reserva web; botón **Fichaje**
- Purge diario automático de estado operativo

### Cocina (KDS)
Pantalla solo comida, alarma, Listo / deshacer, histórico del día, lógica 1º→2º plato.

### Reservas
App móvil del personal: alta rápida, estados (confirmada / hecha / no show / anulada), PIN. Reserva desde web → store + **alerta en TPV**.

### Fichaje (cumplimiento ES)
Entrada/salida, plantilla (Lorena, Claribel, Yuli, Dayana, Alison, Sharif), hora Europe/Madrid, vista Horas con filtros y totales, turnos partidos. Orientado a RD-ley 8/2019 (conservación 4 años).

### ERP
Dashboard P&L, caja TPV, gastos/ingresos, documentos (Storage), RRHH/nóminas, fiscal trimestral, proveedores. Mobile-first + RLS.

---

## 5. Cómo contarlo a las dueñas (guion 2–3 min)

> Os he montado un sistema completo, no solo una web.  
> En internet: página clara para clientes.  
> Para el equipo: zona con PIN → TPV (mesas en móvil y PC), cocina (solo platos + alarma), reservas y oficina.  
> Sala y cocina van conectadas; las bebidas se quedan en barra.  
> Todo respaldado en GitHub: aunque se estropee un PC, el proyecto no se pierde.

### Beneficios
Menos errores sala–cocina · más rapidez · misma cuenta en móvil y PC · imagen profesional · PIN · respaldo · histórico de cocina · control de caja y horas.

### Qué NO es
No sustituye personal · no cocina solo · sin internet hace falta plan B (papel) · el ERP organiza datos para gestoría, no presenta modelos AEAT solo.

### FAQ rápido
| Pregunta | Respuesta |
|---|---|
| ¿Hay que ser informático? | No: toques grandes, pensado para servicio |
| ¿Si alguien ve el enlace? | Pide PIN |
| ¿Solo móvil? | Sí; con PC se sincronizan |
| ¿Bebidas a cocina? | No |
| ¿Es nuestro? | Sí: repo Casa Torino en GitHub |

---

## 6. Packs de venta

| Pack | Contenido | Para quién |
|---|---|---|
| **A · Escaparate** | Web + reserva WhatsApp/web + interna básica | Solo presencia y reservas |
| **B · Sala + Cocina** | A + TPV + KDS + jornada + ticket | Dejar el papel |
| **C · Local completo** | B + reservas staff + alerta TPV + editar carta + fichaje | Varias camareras / turnos |
| **D · Dueña / Oficina** | C + ERP completo | Control sin gestoría diaria |

**Extras:** instalación/onboarding · impresora + QZ · personalización marca/PIN · soporte mensual · white-label · formación 30–45 min.

**Precios:** setup Pack B / Pack D (único) + soporte €/mes — margen alto porque hosting ≈ 0 €.

---

## 7. Diferenciadores

| vs | Ellos | Casa Torino OS |
|---|---|---|
| Revo / Square | Cuota alta, genérico | A medida, stack free |
| CoverManager / TheFork | Solo reservas | Reservas + TPV + KDS + ERP + fichaje |
| Excel + WhatsApp | Sin sync | Tiempo real sala–cocina–caja |
| Apps de fichaje sueltas | Otro login / coste | Integrado en el TPV |

Taglines: *“Del WhatsApp al P&L”* · *“TPV + cocina + reservas + fichaje + oficina. Sin cuota abusiva.”* · *“Hecho en un bar real. Listo para el tuyo.”*

---

## 8. Demo en 4 minutos

1. Web: carta, parking, reservar  
2. Reserva → alerta amarilla en TPV  
3. TPV: mesa → menú + bebida → Enviar a cocina → KDS solo comida  
4. Cocina Listo → cobro / ticket  
5. Fichaje → Horas trabajadas  
6. ERP: cierre / gasto / P&L  

---

## 9. Límites honestos

**Incluye:** PIN, secretos en env, RLS ERP, fichajes append-only.  
**No promete (aún):** contabilidad oficial AEAT automática · multi-local/franquicias · app nativa iOS/Android · sustituir asesor fiscal.

---

## 10. Entregables al comprador

1. Código monorepo (GitHub)  
2. 3 proyectos Vercel (web, reservas, ERP)  
3. Supabase + migraciones SQL  
4. Docs técnicos (`docs/TECNICO.md`) + este comercial  
5. Checklist puesta en marcha (impresora, PIN, carta, personal)

Keywords: `TPV hostelería`, `monitor cocina KDS`, `registro horario hostelería`, `alternativa Revo`, `carta digital sincronizada`, `pagos divididos mesa`.

---

*Casa Torino · Ctra. Ceares 67, Gijón · sept 2026*

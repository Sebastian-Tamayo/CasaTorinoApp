# Casa Torino — Propuesta del ecosistema digital

**Documento para presentar al cliente / dueñas**  
Bar-restaurante familiar · Fusión Colombo-Asturiana · Gijón (Ctra. Ceares, 67)

| | |
|---|---|
| **Versión** | 1.0 |
| **Autor** | Sebastián Olaya Tamayo |
| **Repositorio** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Objetivo** | Explicar de forma clara **todo** el sistema (no solo el TPV): web, reservas, TPV, monitor de cocina y ERP |

---

## 1. Resumen ejecutivo (1 minuto)

Se ha construido un **ecosistema digital completo** para Casa Torino: varias herramientas conectadas que cubren el ciclo real del negocio, desde que el cliente mira la carta hasta que las dueñas revisan números en oficina.

| Pieza | Para quién | Qué resuelve | Enlace |
|---|---|---|---|
| **Página web** | Clientes | Marca, carta, contacto, imagen profesional | https://casa-torino-web.vercel.app |
| **Gestión interna** | Equipo (PIN) | Puerta única al resto de herramientas | https://casa-torino-web.vercel.app/interno.html |
| **TPV** | Sala / barra | Pedidos por mesa, cobro, envío a cocina | Desde Gestión interna |
| **Monitor de cocina (KDS)** | Cocina | Comandas en pantalla grande, alarma, Listo | Desde Gestión interna |
| **Reservas** | Personal | Agenda de mesas compartida en el móvil | https://reservas-casatorino.vercel.app |
| **ERP (oficina)** | Dueñas / administración | Caja, gastos, fiscal, RRHH, documentos, P&L | https://casa-torino-app.vercel.app |

**Idea clave:** no es “una app suelta”. Es el **mismo negocio digitalizado de punta a punta**, con respaldo en GitHub para que no se pierda.

---

## 2. Visión del ecosistema (mapa)

```text
                         CLIENTES
                            │
                            ▼
              ┌─────────────────────────┐
              │  WEB PÚBLICA (marca)    │  Carta, menú, equipo, WhatsApp
              │  casa-torino-web…       │  Diseño claro / crema
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  GESTIÓN INTERNA (PIN)  │  Hub del personal
              └─┬──────┬──────┬──────┬──┘
                │      │      │      │
           ┌────▼──┐ ┌─▼───┐ ┌▼────┐ ┌▼────┐
           │  TPV  │ │Cocina│ │Reser│ │ ERP │
           │ sala  │ │ KDS  │ │vas  │ │ofic.│
           └────┬──┘ └──▲──┘ └─────┘ └─────┘
                │       │
                └──comida──┘   (bebidas se quedan en barra)
```

**Flujo de una noche típica**

1. El cliente conoce el bar en la **web** (o WhatsApp) y/o deja **reserva**.  
2. Al llegar, sala abre el **TPV** en la mesa.  
3. Se toma el pedido; la **comida** viaja al **monitor de cocina**; las bebidas quedan en la cuenta.  
4. Cocina marca **Listo**; sala cobra (ticket / cajón si hay impresora).  
5. Las dueñas consultan caja, gastos y resultados en el **ERP**.

---

## 3. Página web pública — escaparate del negocio

### 3.1 Para qué sirve
Es la **carta de presentación en internet**: ambiente, carta con precios, menú del día, equipo, cómo contactar y reservar (WhatsApp).

### 3.2 Qué destaca
- Diseño **claro / crema** (cálido, de bar; no pantalla oscura).  
- Pensada para **móvil** (casi todos los clientes miran desde el teléfono).  
- Acceso discreto a la zona de personal (**Gestión interna**).  
- Enlaces al resto del ecosistema sin mezclar lo público con lo privado.

### 3.3 Beneficio para el cliente
> “Quien busque Casa Torino nos encuentra con imagen profesional, clara y coherente con el local.”

**Producción:** https://casa-torino-web.vercel.app

---

## 4. Gestión interna — la puerta con llave

### 4.1 Para qué sirve
Menú del equipo: desde un solo sitio se entra a **TPV**, **Cocina**, **Reservas** y **ERP**.

### 4.2 Seguridad
- Pide **PIN** al entrar (mismo criterio de seguridad que TPV y cocina).  
- Un cliente que encuentre el enlace **no** ve las herramientas del personal.  
- Cada apertura vuelve a pedir PIN (no se queda “abierto del día anterior”).

### 4.3 Beneficio
> “Una sola puerta del personal. Sin PIN, no se entra.”

**Enlace:** https://casa-torino-web.vercel.app/interno.html

---

## 5. TPV — pedidos por mesa y cobro en sala

### 5.1 Para qué sirve
Sustituye o refuerza el bloc de notas: cuenta digital por mesa, total con IVA, envío a cocina, cobro e impresión.

### 5.2 Funcionamiento (paso a paso)
1. Abrir TPV e introducir **PIN**.  
2. Elegir **número de mesa**.  
3. Añadir productos de la carta (tocando).  
4. Añadir **notas** si hace falta (“sin cebolla”, alergias…).  
5. Ver subtotal / IVA / total.  
6. Pulsar **Enviar a cocina** (solo va la comida).  
7. Al cobrar: ticket e, si está configurado, apertura de **cajón** (QZ Tray + impresora).

### 5.3 Detalles importantes
| Tema | Comportamiento |
|---|---|
| Móvil y PC | **Sincronizados** en vivo: lo que se apunta en el teléfono aparece en el ordenador (y al revés) |
| Comida vs bebida | Solo **comida** va a cocina; las **bebidas** quedan en la cuenta de barra |
| Pedido mixto | A cocina llega solo la parte de comida |
| IVA | Incluido en el cálculo de la cuenta (hostelería) |
| Seguridad | PIN obligatorio en cada apertura |

### 5.4 Beneficio
> “La cuenta de cada mesa vive en el móvil y en el PC a la vez, sin perderse ni gritar pedidos.”

---

## 6. Monitor de cocina (KDS) — la tele de las comandas

### 6.1 Para qué sirve
Pantalla grande para cocineros: ven las comandas nuevas **al momento**, sin depender de que alguien grite desde barra.

### 6.2 Cómo se ve y se usa
- Tarjetas grandes **por mesa**.  
- Tiempo que lleva el pedido.  
- Cantidades claras (ej. `2 × empanada`).  
- Notas destacadas.  
- Botón grande **Listo**.  
- Botón **Deshacer** por si se pulsó Listo sin querer.  
- **Alarma sonora** al entrar un pedido nuevo.  
- **Histórico del día** de lo ya servido (se limpia solo a las **09:00** hora de Madrid).

### 6.3 Relación con el TPV
- El TPV es quien **envía**.  
- Cocina solo recibe **comida**.  
- Sala sigue viendo comida + bebida en la cuenta de la mesa.

### 6.4 Beneficio
> “Cocina trabaja con su propio monitor: llega solo lo que hay que cocinar, suena aviso, y se marca Listo.”

---

## 7. Reservas — agenda compartida del personal

### 7.1 Para qué sirve
Herramienta **del equipo** (no portal público del cliente) para anotar y gestionar reservas en segundos desde el móvil.

Los clientes suelen reservar por **WhatsApp**; el personal registra y organiza en esta app para que **todo el equipo vea lo mismo**.

### 7.2 Funcionalidades
- Login simple por **persona + PIN** (pensado para velocidad en sala).  
- Alta rápida: nombre, teléfono opcional, personas, día, hora, nota.  
- Edición (cambiar hora, comensales, datos…).  
- Vistas: **hoy** / **todas** (con fecha visible).  
- Estados: confirmada · hecha · no vino · anulada.  
- Acceso rápido a **WhatsApp** del cliente cuando hay teléfono.

### 7.3 Estabilidad
Se sustituyó un almacén gratuito con límite diario (que tumbaba el servicio) por una persistencia **estable en producción**, pensada para no fallar a mitad de servicio.

### 7.4 Beneficio
> “Cuatro personas del equipo ven la misma agenda al instante; menos reservas perdidas en papel o chats sueltos.”

**Producción:** https://reservas-casatorino.vercel.app

---

## 8. ERP — la oficina del negocio (detalle completo)

### 8.1 Para qué sirve
Back-office de hostelería: **no toma comandas**; organiza caja, gastos, fiscalidad, personal, documentos y la cuenta de resultados.

Pensado **mobile-first** (móvil/tablet en el local) y desplegado en producción.

**Producción:** https://casa-torino-app.vercel.app

### 8.2 Módulos que incluye

#### A) Balance / cuenta de resultados (P&L · EBITDA)
- Visión del beneficio operativo del negocio.  
- Lógica simplificada: ingresos (base) − coste de mercancía − costes laborales ≈ EBITDA.  
- Cierres mensuales e histórico.

#### B) Control de caja · ingresos y salidas
- Registro unificado de **ingresos** (local vs domicilio).  
- Formas de pago: **tarjeta vs efectivo**.  
- Control de movimientos con confirmación al borrar.

#### C) Gastos y proveedores
- Registro de compras y gastos (importe, categoría, proveedor, IVA…).  
- Trazabilidad por distribuidor (alimentación, bebida, suministros).  
- Ranking / análisis de volumen de compras para ver **dónde se va el dinero**.

#### D) Gestión documental (gestoría)
- Subida de facturas, tickets, albaranes y contratos (PDF / imagen).  
- Visor integrado y filtros por categoría o proveedor.  
- Archivo en la nube (Supabase Storage) para no depender de un cajón de papeles.

#### E) Recursos humanos (RRHH)
- Fichas de empleados (puesto, salario, Seguridad Social, IRPF).  
- Liquidación de nómina del mes con un flujo guiado.  
- Histórico de nóminas pagadas.

#### F) Módulo fiscal trimestral
- Estimación de **IVA** a pagar / devolver por trimestres (Q1–Q4).  
- Acumulado de retenciones **IRPF** útil para la gestoría.  
- Desglose de bases e IVA soportado vs repercutido.

### 8.3 Quién lo usa
Dueñas o quien lleve los números. **No** es la herramienta del camarero en pleno servicio (esa es el TPV).

### 8.4 Beneficio
> “Es la oficina digital del bar: documentos, personal, impuestos y resultado del mes en un solo sitio, usable desde el móvil.”

### 8.5 Tecnología (para quien pregunte “¿está hecho en serio?”)
- Next.js + Supabase (base de datos + archivos).  
- Despliegue en Vercel.  
- Datos protegidos con políticas de seguridad en base de datos (RLS).

---

## 9. Comparativa: antes vs ahora

| Antes (típico) | Ahora con el ecosistema |
|---|---|
| Pedidos a viva voz / papel | TPV por mesa + envío digital a cocina |
| Móvil y PC no compartían la cuenta | Sync en vivo móvil ↔ PC |
| Cocina sin visibilidad | Monitor KDS con alarma y Listo |
| Reservas en papel / chat caótico | App de personal con estados |
| Reservas que “se caían” por límites baratos | Persistencia estable en producción |
| Papeles sueltos de gestoría | ERP documental + fiscal + RRHH |
| Web poco cuidada / oscura | Web clara, profesional, móvil |
| Miedo a “perder el sistema” | Respaldo del proyecto en GitHub |

---

## 10. Beneficios de negocio (para la propuesta)

1. **Menos errores** entre sala y cocina.  
2. **Más velocidad** de servicio (menos idas y vueltas).  
3. **Misma información** en móvil y PC.  
4. **Imagen profesional** hacia el cliente (web).  
5. **Control de acceso** con PIN en zonas sensibles.  
6. **Agenda de reservas** compartida por el equipo.  
7. **Visión financiera** (caja, gastos, P&L, fiscal, RRHH).  
8. **Continuidad**: el “plano” del sistema está respaldado en GitHub.  
9. **Escalable**: se puede mejorar sin tirar lo anterior.

---

## 11. Qué NO promete este sistema (honestidad comercial)

- No sustituye personas: **ayuda** al equipo.  
- No cocina solo ni decide por las dueñas.  
- Si no hay luz/internet, como cualquier sistema online, hace falta un **plan B** sencillo (papel).  
- El ERP **organiza y calcula**; la gestoría y las decisiones siguen siendo humanas.  
- El TPV y la cocina están pensados para el servicio; el ERP, para la oficina.

---

## 12. Seguridad (explicación sencilla)

- Zonas internas con **PIN** (Gestión interna, TPV, Cocina; reservas con PIN de personal).  
- Los secretos (PIN, tokens) **no** van publicados en la web ni en GitHub.  
- GitHub guarda el **código / plano** del sistema, no las “llaves de la caja fuerte”.  
- Cada apertura sensible vuelve a pedir identificación.

---

## 13. Dónde está todo guardado

**Monorepo (backup familiar del proyecto):**  
https://github.com/Sebastian-Tamayo/CasaTorinoApp

| Carpeta | Contenido |
|---|---|
| `web/` | Página pública + Gestión interna + TPV + Cocina |
| `reservas/` | App de reservas del personal |
| `erp/` | Oficina / ERP (Next.js + Supabase) |
| `docs/` | Guías, recuperación, esta propuesta |

---

## 14. Guion de presentación al cliente (3–4 minutos)

> “Os propongo / os presento el ecosistema digital completo de Casa Torino, no solo una caja registradora.  
>  
> En internet tenemos la **web** clara y profesional para clientes.  
>  
> Para el equipo hay **Gestión interna** con PIN: desde ahí se abre el **TPV** (pedidos por mesa en móvil y PC sincronizados), el **monitor de cocina** (solo comida, con alarma y Listo), las **reservas** del personal y el **ERP** de oficina.  
>  
> Sala y cocina van conectadas: lo que se envía desde el TPV aparece al momento en cocina; las bebidas se quedan en barra.  
>  
> En oficina, el ERP centraliza caja, gastos, proveedores, documentos, personal y el resultado del negocio, incluido el apoyo fiscal trimestral.  
>  
> Todo el proyecto está respaldado en GitHub para que sea patrimonio del negocio familiar y no dependa de un solo ordenador.  
>  
> El objetivo es trabajar con más orden, menos errores y una imagen moderna, sin complicar el día a día del bar.”

---

## 15. Preguntas frecuentes del cliente

**¿Hay que ser informático?**  
No. TPV, cocina y reservas están pensados a toques grandes, para servicio real.

**¿Se puede usar solo el móvil?**  
Sí. Si también hay PC, se sincronizan (TPV).

**¿Las bebidas van a cocina?**  
No. Solo la comida.

**¿Y si alguien encuentra el enlace de cocina?**  
Pide PIN.

**¿Las reservas las hace el cliente en la web?**  
La captación suele ser WhatsApp/web; la **app de reservas** es herramienta del **personal** para no perder la agenda.

**¿El ERP sustituye a la gestoría?**  
No la sustituye: **ordena datos** (IVA, IRPF, documentos, nóminas) para trabajar mejor con la gestoría.

**¿Esto es nuestro?**  
Sí: el proyecto vive en el repositorio de Casa Torino en GitHub.

---

## 16. Plan de adopción recomendado

1. **Formación corta (15–20 min)** al equipo: TPV + Cocina.  
2. **Una noche de prueba** en servicio más tranquilo.  
3. Dejar el **monitor de cocina** fijo en cocina.  
4. Formación aparte (20–30 min) a dueñas: **Reservas + ERP**.  
5. Revisar carta/precios del TPV si hace falta.  
6. Mantener respaldos en GitHub cuando haya mejoras.

---

## 17. Cierre de la propuesta

Casa Torino ya no depende de papeles sueltos, gritos a cocina o herramientas aisladas que se caen.  
Tiene un **sistema de marca + sala + cocina + reservas + oficina**, pensado para un negocio familiar real en Gijón, con cara profesional hacia el cliente y control hacia dentro.

Eso es lo que se propone: **ordenar el servicio y la gestión sin perder el carácter familiar del bar**.

---

*Documento de propuesta / presentación al cliente — Casa Torino · Gijón*  
*Fuente técnica: monorepo Sebastian-Tamayo/CasaTorinoApp (web · reservas · erp · docs)*

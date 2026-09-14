# CASA TORINO — Hoja de plan del ecosistema digital

**Documento de propuesta para cliente / dueñas**  
Bar-restaurante familiar · Fusión Colombo-Asturiana · Gijón (Ctra. Ceares, 67)

| Campo | Valor |
|---|---|
| **Versión** | 2.0 — plan completo actualizado |
| **Fecha** | Septiembre 2026 |
| **Autor** | Sebastián Olaya Tamayo |
| **Uso** | Presentar al cliente · pasar a Gemini Pro / Canvas · subir a GitHub a mano |
| **Repositorio** | `CasaTorinoApp` (monorepo: web + reservas + ERP + docs) |

> **Cómo usar este documento**  
> Está escrito para que se entienda **sin ser técnico**. Puedes pegarlo en Gemini Pro / Canvas y pedirle:  
> *“Conviértelo en una presentación visual tipo propuesta comercial, con diapositivas, iconos y diagrama del ecosistema.”*

---

## 0. Elevator pitch (30 segundos)

Casa Torino ya no depende solo de papel, WhatsApp suelto o gritos a cocina.  
Tiene un **ecosistema digital propio** que cubre:

1. **Cómo nos ven** (web)  
2. **Cómo reservamos** (agenda del personal)  
3. **Cómo cobramos y pedimos** (TPV)  
4. **Cómo cocina el servicio** (monitor de comandas)  
5. **Cómo controlamos el negocio** (ERP / oficina)

Todo con la misma identidad visual (crema + oro), acceso por **PIN del personal (3212)** en las zonas internas, y respaldo del proyecto para que sea patrimonio del negocio familiar.

---

## 1. Resumen ejecutivo

### 1.1 Qué se propone
Un sistema **a medida** para un bar-restaurante familiar real — no un software genérico de miles de euros al mes — pensado para:

- Trabajar más ordenados en sala y cocina  
- Saber **exactamente** cuánto se ha recaudado cada día  
- Tener imagen profesional hacia el cliente  
- Centralizar oficina (personal, gastos, documentos, fiscal)

### 1.2 Mapa rápido de piezas

| Pieza | Para quién | Qué resuelve | Enlace de producción |
|---|---|---|---|
| **Web pública** | Clientes | Marca, carta, contacto, WhatsApp | https://casa-torino-web.vercel.app |
| **Gestión interna** | Equipo (PIN) | Puerta única al resto | …/interno.html |
| **TPV** | Sala / barra | Pedidos por mesa, cobro, envío a cocina, jornada | Desde Gestión interna |
| **Monitor cocina (KDS)** | Cocineros | Comandas en pantalla, alarma, Listo / Deshacer | Desde Gestión interna |
| **Reservas** | Personal | Agenda compartida de mesas | https://reservas-casatorino.vercel.app |
| **ERP (oficina)** | Dueñas / admin. | Caja TPV, RRHH, gastos, docs, fiscal, P&L | https://casa-torino-app.vercel.app |

### 1.3 La idea en una frase
> **No es una app suelta: es el mismo negocio digitalizado de punta a punta.**

---

## 2. Diagrama del ecosistema (visión de dueña)

```text
                         CLIENTES
                            │
                            ▼
              ┌─────────────────────────┐
              │   WEB PÚBLICA (marca)   │  Carta · menú · equipo · WhatsApp
              │   Diseño crema / claro  │  Escaparate profesional
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  GESTIÓN INTERNA (PIN)  │  Hub del personal · PIN 3212
              └───┬──────┬──────┬───────┘
                  │      │      │
         ┌────────▼─┐ ┌──▼───┐ ┌▼──────────┐
         │   TPV    │ │Cocina│ │  Reservas │
         │  (sala)  │ │ KDS  │ │ (agenda)  │
         └────┬─────┘ └──▲───┘ └───────────┘
              │          │
              └──comida──┘     bebidas → se quedan en barra / cuenta
              │
              │  Fin de sesión / cierre de jornada
              ▼
         ┌─────────────────────┐
         │   ERP · OFICINA     │  Caja TPV (ingreso oficial)
         │   PIN 3212          │  RRHH · Gastos · Docs · Fiscal
         └─────────────────────┘
```

---

## 3. Historia de una noche de servicio (lo más importante)

Este es el argumento más potente para el cliente: **cómo se vive el sistema en un servicio real**.

1. Un cliente ve la **web** o escribe por WhatsApp.  
2. El personal anota la **reserva** en la app (todo el equipo ve lo mismo).  
3. Al llegar, sala abre el **TPV**, mesa X.  
4. Se tocan productos; se añaden notas (“sin cebolla”, alergias…).  
5. **Enviar a cocina** → solo va la **comida**; las bebidas quedan en la cuenta.  
6. En cocina suena la **alarma**; ven tarjetas grandes por mesa; pulsan **Listo**.  
7. Sala cobra en TPV (ticket / cajón si hay impresora).  
8. Al cerrar el turno: **Fin de sesión** → el total del día se envía al **ERP**.  
9. Las dueñas abren el ERP con PIN y ven **cuánto se ha recaudado de verdad**.

Eso cierra el círculo: **marca → sala → cocina → caja → oficina**.

---

## 4. Pieza a pieza (detalle comercial)

### 4.1 Web pública — “la fachada”

**Problema que resuelve**  
Sin web clara, el bar se ve menos profesional o depende solo de redes.

**Qué ofrece**
- Carta con precios y menú del día  
- Identidad cálida (crema / oro), pensada para móvil  
- Contacto y reserva por WhatsApp  
- Entrada discreta a la zona de personal

**Mensaje para el cliente**  
> “Quien busque Casa Torino nos encuentra bonitos, claros y coherentes con el local.”

---

### 4.2 Gestión interna — “la puerta con llave”

**Problema que resuelve**  
Que un cliente no entre por accidente a TPV, cocina o ERP.

**Qué ofrece**
- Hub único: TPV · Cocina · Reservas · ERP  
- **PIN obligatorio** al entrar  
- Misma lógica de seguridad que el resto del ecosistema

**Mensaje**  
> “Una sola puerta del personal. Sin PIN, no se entra.”

---

### 4.3 TPV — “la caja moderna / pedidos por mesa”

**Problema que resuelve**  
Pedidos a viva voz o en papel → se pierden, se confunden, móvil y PC no coinciden.

**Qué ofrece**
- Cuenta por **número de mesa**  
- Catálogo táctil (comida / bebida)  
- Notas del pedido  
- IVA 10% desglosado  
- Sync **móvil ↔ PC** en vivo  
- **Enviar a cocina** (solo comida)  
- Cobro + impresión / cajón (si QZ Tray + impresora)  
- **Jornada de caja:**
  - Inicio de jornada  
  - Total de jornada (por tipo, categoría y producto)  
  - Fin de sesión  
  - Corrección de tickets si hubo un error al final del día

**Mensaje**  
> “La cuenta de cada mesa vive en el móvil y en el PC a la vez; cocina recibe solo lo que hay que cocinar.”

---

### 4.4 Monitor de cocina (KDS) — “la tele de las comandas”

**Problema que resuelve**  
Gritos desde barra, papeles perdidos, cocina sin visibilidad del ritmo.

**Qué ofrece**
- Pantalla grande con tarjetas por mesa  
- Tiempo del pedido  
- Cantidades claras y notas destacadas  
- Botón **Listo** y **Deshacer**  
- Alarma sonora al entrar pedido nuevo  
- Histórico del día (se limpia solo a las 09:00 hora Madrid)

**Mensaje**  
> “Cocina trabaja con su propio monitor: llega solo la comida, suena aviso, y se marca Listo.”

---

### 4.5 Reservas — “la agenda compartida”

**Problema que resuelve**  
Reservas en papel / chats sueltos → se pierden o no las ve todo el equipo.

**Qué ofrece**
- App **del personal** (no portal público del cliente)  
- Alta rápida: nombre, personas, día, hora, nota, teléfono  
- Estados: confirmada · hecha · no vino · anulada  
- WhatsApp directo al cliente  
- Acceso por persona + PIN  
- Persistencia estable en producción

**Mensaje**  
> “Cuatro personas del equipo ven la misma agenda al instante.”

---

### 4.6 ERP — “la oficina del negocio” (rediseñado)

**Problema que resuelve**  
Antes: ingresos apuntados a mano (y a veces no necesarios / descuadrados).  
Ahora: el **ingreso oficial** sale del cierre del TPV.

**Qué ofrece hoy**
- Acceso por **PIN 3212** (mismo criterio que TPV)  
- **Caja TPV:** historial de cierres de jornada  
  - Suma del mes  
  - Desglose comida / bebida  
  - Historial que no se borra al cambiar de mes  
- **RRHH:** empleados, nóminas, SS, IRPF  
- **Gastos:** registro operativo (proveedores, suministros…)  
- **Documentos:** facturas, albaranes, contratos  
- **Proveedores:** gasto agrupado  
- **Fiscal:** estimación trimestral IVA / IRPF  
- **P&L / EBITDA** en el inicio (ingresos TPV − gastos)

**Qué ya NO se hace**
- No hace falta “inventar” ingresos diarios a mano  
- El TPV es la fuente de verdad de lo cobrado

**Mensaje**  
> “Cuando cerráis sesión en el TPV, el dinero del día entra solo en la oficina. Así sabéis la recaudación exacta.”

---

## 5. Antes vs ahora (argumento comercial fuerte)

| Antes (típico de muchos bares) | Ahora con el ecosistema |
|---|---|
| Pedidos a viva voz / papel | TPV por mesa + envío digital a cocina |
| Móvil y PC no compartían la cuenta | Sync en vivo móvil ↔ PC |
| Cocina sin visibilidad | Monitor KDS con alarma y Listo |
| Reservas en papel / chat caótico | App de personal con estados |
| Ingresos apuntados “a ojo” | Cierre de jornada → ERP (dato real) |
| Web poco cuidada | Web clara, profesional, móvil |
| Herramientas sueltas | Un ecosistema con misma marca y PIN |
| Miedo a perder el sistema | Proyecto respaldado (GitHub / deploys) |

---

## 6. Beneficios concretos para las dueñas

1. **Menos errores** entre sala y cocina.  
2. **Más velocidad** de servicio.  
3. **Misma información** en móvil y ordenador.  
4. **Imagen profesional** hacia el cliente.  
5. **Control de acceso** con PIN.  
6. **Agenda de reservas** compartida.  
7. **Recaudación exacta** del día/mes (desde cierres TPV).  
8. **Oficina ordenada**: personal, papeles, fiscal, gastos.  
9. **Escalable**: se puede mejorar sin tirar lo anterior.  
10. **Patrimonio digital del negocio familiar**, no de un PC suelto.

---

## 7. Seguridad (explicación sencilla)

- Zonas internas con **PIN** (Gestión interna, TPV, Cocina, ERP).  
- PIN del personal: **3212** (configurable en servidor; no va publicado en el código).  
- Cada apertura sensible vuelve a pedir identificación.  
- Los secretos (tokens, PIN) viven en variables de entorno, no en GitHub.  
- GitHub guarda el **plano** del sistema, no las “llaves de la caja fuerte”.

---

## 8. Honestidad comercial (qué NO promete)

Importante para generar confianza:

- No sustituye personas: **ayuda** al equipo.  
- No cocina solo ni decide por las dueñas.  
- Si no hay luz/internet, hace falta un **plan B** sencillo (papel).  
- El ERP **ordena y calcula**; la gestoría y las decisiones siguen siendo humanas.  
- TPV/Cocina = servicio; ERP = oficina.

---

## 9. Comparación con “ERPs de bares buenos” (por qué este encaja)

Los mejores sistemas de hostelería (Toast, Lightspeed, Restaurant365, etc.) coinciden en tres ideas:

1. **El POS es la fuente de la venta del día**  
2. **El cierre de turno alimenta la oficina / contabilidad**  
3. **Sala, cocina y back-office van conectados**

Casa Torino aplica esa misma lógica, pero **a medida** de un negocio familiar:

- Sin cuotas mensuales abusivas de un software extranjero genérico  
- Con flujos reales ya usados en el local (mesas, comida vs bebida, PIN simple)  
- Con identidad visual propia (crema / oro)

---

## 10. Stack (solo si preguntan “¿está hecho en serio?”)

| Capa | Tecnología |
|---|---|
| Web + TPV + Cocina | HTML/CSS/JS · Vercel |
| Reservas | React + TypeScript + Vite · Vercel |
| ERP | Next.js · Supabase · Vercel |
| Persistencia operativa TPV/Cocina/Cierres | Vercel Edge Config |
| Impresión / cajón | QZ Tray (opcional) |
| Diseño | Mobile-first · crema `#fff8e8` · oro `#f5c518` |

No hace falta entrar en esto en la reunión salvo que lo pidan.

---

## 11. Plan de adopción recomendado (próximos 15 días)

| Día | Acción |
|---|---|
| **1** | Formación corta (20 min): TPV + Cocina |
| **2** | Noche de prueba en servicio más tranquilo |
| **3** | Dejar monitor de cocina fijo en cocina |
| **4** | Formación dueñas (20–30 min): Reservas + ERP Caja |
| **5–7** | Usar Inicio/Fin de jornada todos los días |
| **8** | Revisar primer historial de caja en ERP |
| **9–14** | Ajustar carta/precios si hace falta |
| **15** | Revisión conjunta: qué mejorar en la siguiente fase |

---

## 12. Roadmap posible (fase 2 — opcional)

No es compromiso; es conversación futura:

- Export CSV de cierres hacia gestoría  
- Recordatorio WhatsApp automático de reservas  
- Roles (solo lectura / administración) en ERP  
- Integración más profunda gasto ↔ proveedor ↔ documento  
- Dashboard semanal “¿cómo vamos respecto a la semana pasada?”

---

## 13. Guion de presentación (3–4 minutos)

> “Os presento el ecosistema digital completo de Casa Torino, no solo una caja registradora.  
>  
> En internet tenemos la **web** clara y profesional para clientes.  
>  
> Para el equipo hay **Gestión interna** con PIN: desde ahí se abre el **TPV** (pedidos por mesa en móvil y PC sincronizados), el **monitor de cocina** (solo comida, con alarma y Listo), las **reservas** del personal y el **ERP** de oficina.  
>  
> Sala y cocina van conectadas. Al acabar el turno, el **Fin de sesión** del TPV manda la recaudación real a la oficina. Así sabéis exactamente cuánto habéis ingresado, por comida y bebida, con historial por mes.  
>  
> El objetivo es trabajar con más orden, menos errores y una imagen moderna, sin complicar el día a día del bar y manteniendo el carácter familiar.”

---

## 14. Preguntas frecuentes del cliente

**¿Hay que ser informático?**  
No. TPV, cocina y reservas están pensados a toques grandes.

**¿Se puede usar solo el móvil?**  
Sí. Si también hay PC, se sincronizan.

**¿Las bebidas van a cocina?**  
No. Solo la comida.

**¿Y si alguien encuentra el enlace de cocina o del ERP?**  
Pide PIN.

**¿Las reservas las hace el cliente en la web?**  
La captación suele ser WhatsApp/web; la app de reservas es del **personal**.

**¿El ERP sustituye a la gestoría?**  
No: ordena datos para trabajar mejor con ella.

**¿De dónde sale el dinero del día en el ERP?**  
Del **cierre de sesión del TPV**. Esa es la fuente oficial.

**¿Esto es nuestro?**  
Sí: el proyecto vive como respaldo del negocio familiar (GitHub / deploys).

---

## 15. Checklist de valor (para cerrar la reunión)

- [ ] Web pública en producción, clara y profesional  
- [ ] TPV con mesas, sync, cocina, jornada y correcciones  
- [ ] Monitor de cocina operativo  
- [ ] Reservas del personal estables  
- [ ] ERP con PIN, Caja TPV, RRHH y módulos de oficina  
- [ ] Flujo noche completa explicado y ensayable  
- [ ] Plan de formación de 2 semanas  
- [ ] Respaldo del proyecto listo para subir/mantener en GitHub

---

## 16. Cierre emocional (recomendado)

Esto no es un capricho técnico.  
Es una herramienta para que Casa Torino trabaje con **más orden, más orgullo y menos caos**, manteniendo el carácter familiar del bar… pero con un sistema a la altura de lo que el local merece.

---

## 17. Anexos rápidos (para Canvas / Gemini)

### A. Paleta visual a respetar
- Fondo crema: `#fff8e8`  
- Oro / acento: `#f5c518`  
- Texto oscuro: `#1c2541`  
- Éxito: verde esmeralda  
- Alerta: rojo controlado  

### B. Palabras clave de marca
Familiar · Colombo-Asturiana · Gijón · Orden · Calidez · Profesional sin frialdad  

### C. Prompt sugerido para Gemini Pro / Canvas
> “Usa este documento como fuente única. Crea una presentación comercial de 10–12 diapositivas para dueñas de un bar familiar en Gijón. Tono cercano y profesional, poco tecnicismo. Incluye: 1) portada, 2) problema, 3) mapa del ecosistema, 4) noche de servicio, 5–9) una diapositiva por módulo, 10) antes/después, 11) beneficios + plan 15 días, 12) cierre. Respeta colores crema y oro.”

---

*Documento de propuesta — Casa Torino · Gijón*  
*Ecosistema actual en producción: web · reservas · TPV · cocina · ERP*  
*Listo para presentación al cliente y posterior subida manual a GitHub*

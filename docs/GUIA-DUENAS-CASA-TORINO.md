# Casa Torino — Guía para explicar el proyecto a las dueñas

Documento pensado para que **Sebastián** pueda estudiar y contar, con palabras sencillas, qué se ha construido, para qué sirve cada pieza y cómo beneficia al bar.

---

## 1. La idea en una frase

Hemos digitalizado el día a día de Casa Torino:  
**la carta en internet, las reservas, el cobro en sala, la cocina y el control del negocio**, todo conectado, guardado con seguridad y respaldado en GitHub para que no se pierda.

No es “una app suelta”. Es un **ecosistema familiar**: varias herramientas que hablan entre sí y trabajan para el mismo local.

---

## 2. El mapa del ecosistema (visión de dueña)

Imagina el bar como una casa con varias habitaciones:

| Habitación | Qué es | Quién la usa | Enlace |
|---|---|---|---|
| **Fachada / escaparate** | Página web pública | Clientes | https://casa-torino-web.vercel.app |
| **Puerta del personal** | Gestión interna (con PIN) | Dueñas y equipo | https://casa-torino-web.vercel.app/interno.html |
| **Caja / camarero** | TPV (pedidos por mesa) | Sala | Dentro de Gestión interna → TPV |
| **Cocina** | Monitor de pedidos (pantalla grande) | Cocineros | Dentro de Gestión interna → Cocina |
| **Reservas** | Agenda de mesas | Personal | https://reservas-casatorino.vercel.app |
| **Oficina** | ERP (caja, gastos, control) | Dueñas / administración | https://casa-torino-app.vercel.app |

Todo el código está respaldado en GitHub:  
https://github.com/Sebastian-Tamayo/CasaTorinoApp

---

## 3. Qué problema resolvía antes… y qué hay ahora

### Antes (típico de muchos bares)
- Pedidos a viva voz o en papel → se pierden, se confunden.
- El móvil y el PC no compartían la misma cuenta de mesa.
- La cocina no veía al instante lo que pedía sala.
- Las reservas fallaban o se saturaban.
- Si “se rompía internet” o un deploy, costaba recuperar.
- La web a veces salía oscura / mal presentada.

### Ahora
- Cada mesa tiene su cuenta digital.
- El pedido se puede tomar en el móvil y aparece en el PC (y al revés).
- Cocina ve solo la **comida**, al momento, en pantalla grande.
- Reservas estables (sin el límite barato que las tumbaba).
- PIN en las zonas sensibles.
- Web pública **clara y profesional**.
- Copia de seguridad del proyecto en GitHub.

---

## 4. Explicación pieza por pieza (lenguaje humano)

### 4.1 Página web pública — “la carta de presentación”

**Para qué sirve**  
Que cualquiera, desde el móvil, vea Casa Torino: ambiente, carta, cómo llegar, redes, reservar.

**Qué verán las dueñas**
- Diseño **claro / crema** (cálido, de bar, no “pantalla negra”).
- Aspecto moderno y limpio.
- Acceso discreto a la zona de personal.

**Frase útil para contar:**  
> “Es nuestra escaparate en internet. Quien busque el bar, nos encuentra bonitos y claros.”

---

### 4.2 Gestión interna — “la puerta con llave”

**Para qué sirve**  
Es el menú del equipo: desde ahí se entra al TPV, a Cocina, a Reservas y al ERP.

**Seguridad**
- Pide **PIN** siempre al entrar.
- Así un cliente que encuentre el enlace no ve las herramientas del personal.

**Frase útil:**  
> “Es la puerta del personal. Sin PIN, no se entra.”

---

### 4.3 TPV — “la caja moderna / pedidos por mesa”

**Para qué sirve**  
Sustituye (o refuerza) el bloc de notas:
1. Pones el número de mesa.
2. Tocás productos de la carta.
3. Ves el total con IVA.
4. Puedes **enviar a cocina** la comida.
5. Cobras, imprimes ticket y abres cajón (si hay impresora/QZ Tray).

**Detalles importantes**
- Funciona en **móvil y PC a la vez**: si alguien apunta en el teléfono, se ve en el ordenador.
- Las **bebidas no van a cocina** (se quedan en la cuenta para barra).
- Si el pedido es mixto (comida + bebida), a cocina solo llega la comida.
- Hay notas del pedido (“sin cebolla”, alergias…).
- PIN obligatorio cada vez que se abre.

**Frase útil:**  
> “Es como tener la cuenta de cada mesa en el móvil y en el PC, sincronizada, sin perderse.”

---

### 4.4 Cocina (KDS) — “la tele de la cocina”

**Para qué sirve**  
Pantalla para cocineros: ven las comandas nuevas sin que nadie grite desde barra.

**Cómo se ve**
- Tarjetas grandes por mesa.
- Tiempo que lleva el pedido.
- Cantidades claras (“2 × empanada”).
- Notas en rojo / destacadas.
- Botón grande **Listo**.
- Botón **Deshacer** por si se pulsó Listo sin querer.
- Sonido de alarma cuando entra un pedido nuevo.
- **Histórico del día** de lo servido (se limpia solo a las 09:00).

**Frase útil:**  
> “La cocina tiene su propio monitor: le llegan solo los platos, al momento, y marca Listo cuando termina.”

---

### 4.5 Reservas — “la agenda del día”

**Para qué sirve**  
Que el personal gestione reservas sin depender de un papel o de un servicio gratuito que se caía.

**Qué se arregló**
- Antes fallaba por un sistema gratuito con límite diario.
- Ahora usa un almacén estable (Edge Config) pensado para no “morirse” a mitad de servicio.

**Frase útil:**  
> “Las reservas del personal ya no se caen por cupos baratos de internet: están montadas de forma estable.”

---

### 4.6 ERP — “la oficina del negocio”

**Para qué sirve**  
Back-office de hostelería (más “contabilidad / administración” que “sala”):

- **Caja e ingresos** (local / domicilio, tarjeta / efectivo).  
- **Gastos y proveedores** (dónde se va el dinero).  
- **Documentos** (facturas, albaranes, contratos en la nube).  
- **RRHH** (empleados, nóminas, SS e IRPF).  
- **Fiscal trimestral** (estimación IVA / IRPF para gestoría).  
- **Cuenta de resultados (P&L / EBITDA)** con cierres mensuales.

**Quién lo usa**  
Dueñas o quien lleve los números, no el camarero en pleno servicio.

**Enlace:** https://casa-torino-app.vercel.app

**Frase útil:**  
> “Es la parte de oficina: caja, gastos, papeles, personal e impuestos… para ver cómo va el negocio, no para tomar comandas.”

> Propuesta completa para el cliente (Word + Markdown):  
> `docs/Casa-Torino-Propuesta-Ecosistema-Cliente.docx` · `docs/PROPUESTA-ECOSISTEMA-CLIENTE.md`

---

## 5. Cómo encaja todo en un servicio real (historia de una noche)

1. Un cliente reserva → entra en **Reservas**.
2. Llega al local → el camarero abre **TPV**, mesa 7.
3. Pide menú + cerveza → en TPV queda todo; a **Cocina** solo llega el menú.
4. Suena la alarma en cocina → preparan → pulsan **Listo**.
5. El camarero cobra en TPV (ticket / cajón si está configurado).
6. Al día siguiente, a las 09:00, el histórico de cocina se limpia solo.
7. Las dueñas pueden revisar números en el **ERP**.

Eso es el círculo completo del negocio digitalizado.

---

## 6. Beneficios concretos para las dueñas

1. **Menos errores** entre sala y cocina.  
2. **Más rapidez** (menos ir y venir a gritar pedidos).  
3. **Mismo pedido en móvil y PC**.  
4. **Imagen profesional** en internet (web clara).  
5. **Control**: PIN en zonas internas.  
6. **Tranquilidad**: el proyecto está respaldado en GitHub (no depende de un solo ordenador).  
7. **Histórico de cocina** del día para revisar qué se ha servido.  
8. **Escalable**: se puede mejorar sin tirar lo anterior.

---

## 7. Qué NO es (para no generar falsas expectativas)

- No sustituye por magia a una persona: ayuda al equipo, no lo reemplaza.
- No es un robot que cocina.
- Si no hay luz/internet, como cualquier sistema online, hay que tener un plan B simple (papel).
- El ERP no “hace la contable sola”: organiza y facilita, pero las decisiones siguen siendo de las dueñas.

---

## 8. Seguridad (cómo explicarla sin tecnicismos)

- Hay **puertas con llave (PIN)** en Gestión interna, TPV y Cocina.
- Las contraseñas/PIN **no van publicadas** en la web ni en GitHub.
- El respaldo en GitHub guarda el “plano” del sistema, no las llaves de la caja fuerte.
- Cada vez que se abre TPV/Cocina/Interna, **vuelve a pedir PIN** (no se queda abierto del día anterior).

---

## 9. Dónde está guardado todo (respaldo familiar)

**Repositorio GitHub (backup del proyecto):**  
https://github.com/Sebastian-Tamayo/CasaTorinoApp

Ahí están, organizados por carpetas:
- `web/` → página + TPV + cocina  
- `reservas/` → reservas  
- `erp/` → oficina / ERP  
- `docs/` → manuales de recuperación  

**Idea clave para las dueñas:**  
> “Aunque se estropee un PC, el proyecto no se pierde: está guardado en la nube de la empresa (GitHub).”

---

## 10. Guion corto (2–3 minutos) para contárselo en el bar

> “Os he montado un sistema completo para Casa Torino, no solo una web.  
>  
> En internet tenemos la página bonita y clara para clientes.  
>  
> Para el equipo hay una zona con PIN: desde ahí abrís el TPV (pedidos por mesa en el móvil y el ordenador a la vez), la cocina (una pantalla que recibe solo la comida con alarma), las reservas y la parte de oficina.  
>  
> Sala y cocina van conectadas: lo que se envía desde el TPV aparece al momento en cocina; las bebidas se quedan en barra.  
>  
> Todo está respaldado en GitHub para que sea de la familia y no se pierda.  
>  
> La idea es trabajar más ordenados, con menos fallos, y que el negocio se vea y se gestione de forma moderna sin complicaros.”

---

## 11. Preguntas que pueden hacer… y respuestas sencillas

**“¿Hay que ser informático para usarlo?”**  
No. TPV y Cocina están hechos a toques grandes, pensados para el servicio.

**“¿Y si alguien ve el enlace de cocina?”**  
Pide PIN. Sin PIN no entra.

**“¿Se puede usar solo el móvil?”**  
Sí. Y si también hay PC, se sincronizan.

**“¿Las bebidas van a cocina?”**  
No. Solo la comida. Las bebidas quedan en la cuenta de la mesa.

**“¿Qué pasa con lo de cocina al cerrar el día?”**  
El histórico se limpia solo a las 09:00.

**“¿Esto es nuestro?”**  
Sí: está en el repositorio de Casa Torino en GitHub, como respaldo de la empresa familiar.

---

## 12. Próximos pasos recomendados (si preguntan “¿y ahora qué?”)

1. Formación corta al equipo (15–20 min): TPV + Cocina.  
2. Una noche de prueba real en servicio lento.  
3. Ajustar carta/precios si hace falta.  
4. Dejar el monitor de cocina fijo en cocina.  
5. Seguir haciendo respaldos en GitHub cuando haya mejoras.

---

## 13. Resumen emocional (cierre)

Esto no es un capricho técnico.  
Es una herramienta para que Casa Torino trabaje con **más orden, más orgullo y menos caos**, manteniendo el carácter familiar del bar… pero con un sistema a la altura de lo que el local merece.

---

*Documento para uso interno familiar — Casa Torino · Gijón*  
*Basado en el ecosistema publicado en GitHub: Sebastian-Tamayo/CasaTorinoApp*

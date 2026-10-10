# PRD — Casa Torino OS

**Documento madre del producto.** Define qué es, para quién, qué incluye y qué queda fuera.  
Lecturas hermanas: [`COMERCIAL.md`](./COMERCIAL.md) (venta) · [`ESPECIFICACIONES-TECNICAS.md`](./ESPECIFICACIONES-TECNICAS.md) (cómo está hecho) · [`MAPA-CODIGO.md`](./MAPA-CODIGO.md) (dónde tocar).

| Campo | Valor |
|---|---|
| **Producto** | Casa Torino OS |
| **Cliente piloto** | Casa Torino · Ceares, Gijón |
| **Estado** | Producción estable (oct 2026) |
| **Autor** | Sebastián Olaya Tamayo (Sebas-Dev) |
| **Repo** | https://github.com/Sebastian-Tamayo/CasaTorinoApp |
| **Objetivo negocio** | Sistema hostelería punta a punta sin cuotas mensuales tipo Square/Revo |

---

## 1. Visión

Un único ecosistema digital para un restaurante familiar: **marca en la web**, **sala (TPV)**, **cocina (KDS)**, **reservas**, **fichaje legal** y **oficina (ERP)**, sincronizado y operable con PIN, sobre infra Hobby (≈ 0 €/mes).

**Prueba de carga real:** +2.600 € y +130 comensales concurrentes en terraza, sin caídas.

---

## 2. Usuarios

| Persona | Necesidad principal | Módulo |
|---|---|---|
| Cliente final | Ver carta, menú, reservar, parking | Web pública |
| Camarero/a | Pedir, enviar cocina, cobrar, notas | TPV |
| Cocina | Ver solo comida, marcar Listo | KDS (+ PWA) |
| Personal reservas | Agenda del día | Reservas staff |
| Dueñas / admin | Caja, top ventas, fiscal, RRHH, docs | ERP + Fichaje |

---

## 3. Alcance funcional (MUST)

### 3.1 Web pública
- Carta con precios alineados al TPV
- Menú del día automático: **entre semana XOR fin de semana/festivo** (nunca ambos)
- Hero, parking, Maps, WhatsApp, reserva web
- Tema claro de marca

### 3.2 Gestión interna
- Hub con PIN → TPV, Cocina, Reservas, ERP, Horas

### 3.3 TPV
- Mesas sincronizadas (móvil + PC)
- Carta por categorías; envío cocina solo comida
- Menús ES (2 tiempos) / CO (1 tiempo)
- Cobro (efectivo/tarjeta), parciales, ticket POS-58 (QZ Tray)
- Jornada + cierres → ERP
- Editar Carta (PIN) → Supabase + Storage fotos
- Notas de turno (proveedores / otras)
- Acceso rápido a reservas (badge + modal)
- Fichaje embebido
- Alerta reserva web
- Purge diario de estado operativo

### 3.4 Cocina (KDS)
- Monitor solo comida; Listo / deshacer; histórico del día
- Instalable como app (PWA standalone)

### 3.5 Reservas
- App staff + reserva pública → alerta TPV
- Persistencia Supabase `ops_kv` (sin Edge Config / Blob)

### 3.6 Fichaje
- Entrada/salida + horas (cumplimiento jornada ES)

### 3.7 ERP
- Caja TPV, top ventas, P&L, fiscal, RRHH, proveedores, documentos

### 3.8 Operación
- Backup diario GitHub 03:00 Madrid (retención 14 días)
- Secretos solo en Vercel

---

## 4. Fuera de alcance (NOW)

- App nativa iOS/Android (salvo PWA Cocina)
- Pasarela de pago online / TPV bancario cloud
- Facturación electrónica AEAT completa (hay borrador/PR histórico de factura ticket, no en prod)
- Multi-local / franquicia
- CSP estricto enforced (diferido)

---

## 5. Requisitos no funcionales

| Área | Requisito |
|---|---|
| Disponibilidad | Operación diaria sala/cocina sin downtime programado en servicio |
| Coste | Stack Hobby Vercel + Supabase free |
| Latencia ops | Sync mesas/cocina en ~1 s (poll) |
| Seguridad | PIN + cookies HttpOnly; RLS en ERP; sin secretos en Git |
| UX | Móvil camareros; paneles grandes en cocina/PC |
| Recuperación | Backup diario + script `restaurar-modulo.sh` |

---

## 6. Métricas de éxito (piloto)

- Servicio de terraza sin pérdida de pedidos
- Un solo origen de verdad de carta (web = TPV)
- Caja del día visible en ERP
- Reservas visibles en sala sin WhatsApp como sistema
- Coste infra ≈ 0 €/mes en régimen normal

---

## 7. Decisiones de producto vigentes

1. **Menú automático** — sin toggle en TPV; solo el menú del día.
2. **Datos ops en Supabase** — migrado desde Blob/Edge Config.
3. **Cocina instalable** — PWA; TPV sigue en navegador.
4. **`main` = producción lógica** — features viven en `main` tras PR; deploy web controlado (CLI / Actions con token).

---

## 8. Roadmap opcional (no comprometido)

- Cerrar/decidir PR histórico factura simplificada ticket
- Rate-limit PIN + PIN reservas solo en env
- CSP Report-Only
- Pack white-label para otros locales (misma base)

---

## 9. Glosario

| Término | Significado |
|---|---|
| TPV | Terminal punto de venta (sala) |
| KDS | Kitchen Display System |
| `ops_kv` | Tabla clave-valor Supabase compartida |
| Jornada | Turno de caja TPV abierto/cerrado |
| PWA | Progressive Web App (Cocina a pantalla completa) |

---

*PRD Casa Torino OS · actualizar cuando cambie alcance o decisiones de producto.*

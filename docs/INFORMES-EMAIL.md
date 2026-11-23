# Informes de ventas por email

Correo automático a **cafebartorino@gmail.com** con el resumen tipo ERP, legible en móvil.

## Qué incluye (semanal y mensual)

| Bloque | Semanal | Mensual |
|---|---|---|
| Total ventas, tickets, comida/bebida | Sí | Sí |
| Efectivo / tarjeta / propina | Sí | Sí |
| Productos más vendidos (top 15) | Sí | Sí |
| Desglose temporal | **Por día** (lun–dom) | **Por semana** del mes |
| Pico de mesas ocupadas | Hora con más mesas distintas cobradas **por día** | Mejor pico **por semana** (día + hora) |

Fuente: **cierres de jornada** TPV en Supabase `ops_kv` (`cierres`).

### Cómo se asigna cada día

1. Se cogen los **cierres de jornada** (uno por cada vez que cierran caja).
2. Ese cierre cuenta en el **día operativo en que abrieron** la jornada (08:00–08:00 Madrid).
3. Ejemplo: abren el **domingo** y cierran el **lunes a las 00:30** → **jornada del domingo**.
4. La semana del informe es **lunes → domingo** (7 filas).
5. Si el domingo aún no se ha cerrado, el informe también puede sumar la **jornada viva**.

## Cuándo se envía

1. **Semanal (principal):** al **cerrar la caja de la jornada abierta el domingo**
   (TPV → fin de jornada; `startedAt` con opsDay domingo).
   - Sirve si cierran domingo noche o lunes madrugada.
   - Idempotente: no reenvía si ya salió.
2. **Semanal (backup):** lunes **~10:00 Madrid** (`/api/ops-daily-purge`, ventana 9–14)
   si aún no se envió al cerrar.
3. **Mensual:** día **1** del mes ~08:00 Madrid.

Diagnóstico: `GET /api/ops-health?informe=1`  
Reenviar (lunes): `GET /api/ops-health?informeCatchup=1&force=1`

## Configurar envío (Vercel · proyecto `casa-torino-web`)

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | API key de [resend.com](https://resend.com) |
| `REPORT_EMAIL_TO` | `cafebartorino@gmail.com` |
| `REPORT_EMAIL_FROM` | Dominio verificado, p. ej. `Casa Torino <informes@tudominio.com>` |

## Checklist próximos lanzamientos

1. No tocar el gate de versión de `/api/kitchen` create (TPV→cocina).
2. Informe = suma de **cierres de jornada**; día = apertura (00:30 lunes = domingo ops).
3. Semanal al cerrar jornada domingo + backup lunes ~10:00.
4. Cuidado con cuota CDN Hobby.

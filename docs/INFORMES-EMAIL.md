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
3. Ejemplo: abren el sábado y cierran a las **00:30** → **jornada del sábado** (no del domingo).
4. Sábado y domingo son filas distintas: cada uno suma solo sus cierres de jornada.

## Cuándo se envía

1. **Semanal (principal):** al **cerrar caja el domingo** (`action: end` en `/api/tpv-jornada`).
   - Con `force`: el **último** cierre del domingo manda el mail completo (lun–dom).
2. **Backup semanal:** lunes ~08:00 Madrid (`/api/ops-daily-purge`).
   - Envía si no se envió, o reenvía si el previo tenía menos tickets/total.
3. **Mensual:** día **1** del mes ~08:00 Madrid (mes calendario anterior).

Log: `informe-log` en ops_kv (guarda `totals`).

## Configurar envío (Vercel · proyecto `casa-torino-web`)

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | API key de [resend.com](https://resend.com) |
| `REPORT_EMAIL_TO` | `cafebartorino@gmail.com` |
| `REPORT_EMAIL_FROM` | Dominio verificado, p. ej. `Casa Torino <informes@tudominio.com>` |

Sin `RESEND_API_KEY` se guarda el HTML en ops_kv y no rompe el cierre de caja.

## Probar sin enviar

```bash
curl -sS "https://casa-torino-web.vercel.app/api/ops-daily-purge?informe=semanal&dryRun=1" \
  -H "Authorization: Bearer $TPV_SYNC_KEY"
```

Forzar reenvío: `force=1`.

## Checklist próximos lanzamientos

1. No tocar el gate de versión de `/api/kitchen` create (TPV→cocina).
2. Informe = suma de **cierres de jornada**; día = apertura (00:30 = día anterior ops).
3. Domingo al cerrar → mail automático; lunes reenvía si faltaba total.
4. Cuidado con cuota CDN Hobby (polls de estáticos lentos).

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

Fuente: cierres TPV en Supabase `ops_kv` (`cierres`), misma base que Top ventas / Caja del ERP.

### Día operativo (importante)

Cada fila del informe es un **día operativo 08:00–08:00 Europe/Madrid** (`opsDayId`):

- La noche del sábado (00:00–07:59 domingo) cuenta como **sábado**.
- Sábado y domingo **nunca** se suman en la misma fila.
- Al cerrar caja, las ventas se archivan **partidas por día ops** (no por la hora del botón «cerrar»).

## Cuándo se envía

1. **Semanal (principal):** al **cerrar caja el domingo** (`action: end` en `/api/tpv-jornada`).
   - Siempre con `force`: el **último** cierre del domingo manda el mail completo (lun–dom).
   - Si hubo un envío a mediodía, el cierre de noche lo pisa con el domingo entero.
2. **Backup semanal:** lunes ~08:00 Madrid (`/api/ops-daily-purge`).
   - Envía si no se envió, o **reenvía** si el envío previo tenía menos tickets/total.
3. **Mensual:** día **1** del mes ~08:00 Madrid (mes calendario anterior).

Log de envíos: clave `informe-log` en ops_kv (guarda `totals` para detectar incompletos).

## Configurar envío (Vercel · proyecto `casa-torino-web`)

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | API key de [resend.com](https://resend.com) (plan gratis) |
| `REPORT_EMAIL_TO` | `cafebartorino@gmail.com` |
| `REPORT_EMAIL_FROM` | Dominio verificado, p. ej. `Casa Torino <informes@tudominio.com>`. Para pruebas: `Casa Torino <onboarding@resend.dev>` (solo entrega a la cuenta Resend) |

Sin `RESEND_API_KEY` el sistema **guarda el HTML** en `ops_kv` (`informe-html:semana-…` / `informe-html:mes-…`) y no rompe el cierre de caja.

## Probar sin enviar

Con sesión TPV o header `Authorization: Bearer <CRON_SECRET|TPV_SYNC_KEY>`  
(Hobby: sin rutas API nuevas — va por el purge):

```bash
curl -sS "https://casa-torino-web.vercel.app/api/ops-daily-purge?informe=semanal&dryRun=1" \
  -H "Authorization: Bearer $TPV_SYNC_KEY"

curl -sS "https://casa-torino-web.vercel.app/api/ops-daily-purge?informe=mensual&dryRun=1" \
  -H "Authorization: Bearer $TPV_SYNC_KEY"
```

La respuesta JSON incluye `html` (ábrelo en el móvil) y `report` con totales por día (sáb/dom aparte).

Forzar reenvío: `force=1`.

## Checklist próximos lanzamientos (semanal)

1. No tocar el gate de versión de `/api/kitchen` create (TPV→cocina).
2. Tras cerrar caja el domingo, el mail debe salir solo (último cierre = semana completa).
3. En el HTML: sábado y domingo en **filas distintas**; total semana = suma de los 7 días.
4. Probar con `dryRun=1` si se cambia la lógica de cierres / ops day.
5. Cuidado con la cuota CDN Hobby: no añadir polls agresivos de estáticos.

## Si no puedes usar correo

1. **HTML en ops_kv** — generado siempre; consulta con `?informe=semanal&dryRun=1`.
2. **Misma API a mano** — bookmark del dry-run tras el domingo / día 1.
3. **WhatsApp / Telegram** — se puede enganchar al mismo HTML más adelante.

Lo más barato y fiable con el stack actual: **Resend gratis + cierre domingo + cron lunes**.

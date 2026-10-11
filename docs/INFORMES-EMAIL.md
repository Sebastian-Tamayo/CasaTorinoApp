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

Fuente: cierres TPV en Supabase `ops_kv` (`cierres`), misma base que Top ventas / Caja del ERP. Cada cierre guarda `activityByHour` al archivar.

## Cuándo se envía

1. **Semanal:** al **cerrar caja el domingo** (`action: end` en `/api/tpv-jornada`).
2. **Backup semanal:** lunes ~08:00 Madrid (dentro de `/api/ops-daily-purge`) si aún no se envió.
3. **Mensual:** día **1** del mes ~08:00 Madrid (mes calendario anterior).

Idempotencia: clave `informe-log` en ops_kv (no duplica el mismo periodo).

## Configurar envío (Vercel · proyecto `casa-torino-web`)

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | API key de [resend.com](https://resend.com) (plan gratis) |
| `REPORT_EMAIL_TO` | `cafebartorino@gmail.com` |
| `REPORT_EMAIL_FROM` | Dominio verificado, p. ej. `Casa Torino <informes@tudominio.com>`. Para pruebas: `Casa Torino <onboarding@resend.dev>` (solo entrega a la cuenta Resend) |

Sin `RESEND_API_KEY` el sistema **guarda el HTML** en `ops_kv` (`informe-html:semana-…` / `informe-html:mes-…`) y no rompe el cierre de caja.

## Probar sin enviar

Con sesión TPV o header `Authorization: Bearer <CRON_SECRET|TPV_SYNC_KEY>`:

```bash
curl -sS "https://casa-torino-web.vercel.app/api/informes-semanal?dryRun=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

La respuesta JSON incluye `html` (ábrelo en el móvil) y `report` con totales.

Forzar reenvío: `force=1`.

## Si no puedes usar correo

Opciones ya cableadas o fáciles:

1. **HTML en ops_kv** — generado siempre; consulta con `dryRun=1` o lee la clave `informe-html:…` en Supabase.
2. **Misma API a mano** — bookmark del dry-run tras el domingo / día 1.
3. **WhatsApp Business / Telegram bot** — se puede enganchar al mismo HTML (mismo cron) si más adelante se prefiere chat a email.
4. **Google Drive** — subir el HTML con una service account (requiere credenciales nuevas).

Lo más barato y fiable con el stack actual: **Resend gratis + este cron**.

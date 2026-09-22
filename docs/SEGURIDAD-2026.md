# Seguridad Casa Torino — auditoría 2026

Documento de revisión frente a **OWASP Top 10:2025**, cabeceras HTTP 2026 y obligaciones prácticas **RGPD / LOPDGDD** para un SaaS de hostelería en España.

| | |
|---|---|
| **Fecha** | 22 sep 2026 |
| **Alcance** | web (TPV/KDS/fichaje), reservas, ERP |
| **Objetivo** | Cumplir baseline de seguridad **sin romper producción** |

---

## 1. Resumen ejecutivo

| Área | Estado | Notas |
|---|---|---|
| HTTPS / Vercel TLS | ✅ | Forzado por plataforma |
| Cookies de sesión TPV/ERP | ✅ | `HttpOnly; Secure; SameSite=Lax` |
| Secretos en Git | ✅ | `.gitignore` + env Vercel; no subir `.env` |
| PIN en servidor (TPV) | ✅ | `TPV_PIN` en env |
| RLS Supabase (ERP) | ✅ | Migraciones con policies |
| Cabeceras HTTP baseline | ✅ *mejorado* | nosniff, Referrer-Policy, XFO, HSTS, Permissions-Policy |
| Backup automático | ✅ *nuevo* | Diario 03:00 Madrid, retención 14 días |
| CSP estricto | ⚠️ diferido | Rompería Font Awesome / Google Fonts / QZ Tray; plan faseado |
| PINs en front reservas | ⚠️ | `3212` en `reservas/src/config.ts` — mover a env en siguiente iteración |
| CORS `*` en APIs públicas | ⚠️ aceptable | Carta/health; mutaciones siguen con sesión/PIN |
| Rate limiting PIN | ⚠️ | No hay lockout; riesgo fuerza bruta bajo (4 dígitos + no público) |
| Logging de seguridad | ⚠️ | Logs de error; falta alerta centralizada |

**Veredicto:** apto para operación real de un local con PIN. No es banca ni ENS alto; es **proporcional al riesgo** (RGPD art. 32). Las mejoras de esta entrega no cambian flujos de sala/cocina.

---

## 2. OWASP Top 10:2025 — mapa

| ID | Riesgo | Cómo lo cubrimos | Gap residual |
|---|---|---|---|
| A01 Broken Access Control | PIN + cookie sesión; APIs mutadoras `authorized()` | Sesión es flag `=1` (sin token aleatorio) |
| A02 Security Misconfiguration | Headers + Vercel + `.gitignore` | CSP aún no enforced |
| A03 Software Supply Chain | Dependencias npm en lockfiles; deploy desde GitHub | Auditar `npm audit` en CI (pendiente) |
| A04 Cryptographic Failures | TLS Vercel; cookies Secure | PIN corto (operativo hostelería) |
| A05 Injection | APIs JSON; Supabase parametrizado vía REST | Validar inputs string en fichaje (ya lista blanca staff) |
| A06 Insecure Design | Separación pública / interna; comida≠bebida KDS | Multi-tenant no aplica (1 local) |
| A07 Authentication Failures | PIN env; cookie HttpOnly | Sin rate-limit / MFA |
| A08 Integrity Failures | Deploy GitHub Actions con secretos | Artifact signing no aplica |
| A09 Logging & Alerting | `console.error` en APIs | Sin SIEM; health `/api/ops-health` |
| A10 Exceptional Conditions | Try/catch + JSON de error genérico | Evitar filtrar stack al cliente (revisar) |

---

## 3. Cabeceras HTTP (checklist 2026)

Aplicadas en `web/vercel.json` (todas las rutas) y ERP (`next.config.ts`):

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN` (web) / APIs `DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

**No aplicado aún (a propósito):**
- CSP enforced — requiere inventariar CDNs (`cdnjs`, `fonts.googleapis`, `jsdelivr` QZ).
- COOP/COEP — pueden romper impresión QZ Tray.

---

## 4. RGPD / datos personales (hostelería)

| Dato | Base / uso | Dónde vive |
|---|---|---|
| Reservas (nombre, teléfono) | Interés legítimo / contrato hostelería | Edge Config reservas |
| Fichajes (nombre + hora) | Obligación legal registro jornada (RD-ley 8/2019) | Supabase `time_logs` / ops_kv |
| Ticket / mesa | Operativa (no identifica cliente salvo notas) | ops_kv |
| Empleados / nóminas ERP | Relación laboral | Supabase + RLS |

**Medidas:** acceso por PIN, HTTPS, retención fichajes ≥ 4 años (diseño), backups sin secretos, minimización (no se pide DNI en TPV).

**Pendiente operativo (dueñas):** texto de privacidad en web pública + encargados (Vercel/Supabase) en registro de actividades.

---

## 5. Respaldo y continuidad (no rompe prod)

Workflow: `.github/workflows/daily-backup.yml`

- Disparo ~**03:00 Europe/Madrid** (crons UTC 01:00 y 02:00; idempotente por día).
- Crea rama `backup/daily-YYYY-MM-DD` + tag `backup-YYYY-MM-DD` desde **main**.
- Borra backups con más de **14 días**.
- **No** hace deploy, **no** force-push a `main`, **no** toca Vercel.

Manual: `bash scripts/daily-backup.sh`

---

## 6. Plan de endurecimiento (siguiente oleada, sin urgencia)

1. Mover PIN reservas / ERP fallback a **solo env** (sin literales en JS del cliente).
2. Cookie de sesión con valor aleatorio firmado (no solo `=1`).
3. Rate-limit 5 intentos PIN / 15 min (Edge middleware).
4. CSP Report-Only → enforced por ruta (pública vs TPV).
5. `npm audit` + Dependabot en GitHub.
6. Reducir CORS `*` en mutadores a orígenes conocidos.

---

## 7. Cómo verificar que prod no se rompió

1. https://casa-torino-web.vercel.app/tpv.html — login PIN, carta, cobro.  
2. https://casa-torino-web.vercel.app/cocina.html — comandas.  
3. `curl -sI https://casa-torino-web.vercel.app/ | rg -i 'strict-transport|x-content-type|referrer-policy'`  
4. GitHub → Actions → “Daily project backup” → Run workflow (manual).

---

*Auditoría proporcional a un TPV de bar familiar en 2026. No sustituye pentest formal ni certificación ENS.*

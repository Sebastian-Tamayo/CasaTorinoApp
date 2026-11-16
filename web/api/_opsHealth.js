/**
 * Health check operativo — Supabase ops_kv
 * GET /api/ops-health
 *
 * Nota Hobby: helper montado en ops-daily-purge vía rewrite
 * /api/ops-health → /api/ops-daily-purge?__mod=health
 *
 * ?informe=1 → estado del informe semanal (sin HTML ni secretos)
 * ?informeCatchup=1 → si es lunes, intenta enviar (idempotente)
 * ?informeCatchup=1&force=1 → reenvía aunque ya estuviera marcado
 */
const { getJson, getBackend, hasSupabase } = require('./_opsStore')
const { applySecurityHeaders } = require('./_securityHeaders')
const {
  getInformeStatus,
  runInforme,
  madridWeekday,
} = require('./_informeReports')

module.exports = async function handler(req, res) {
  applySecurityHeaders(res)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'GET') {
    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  }

  const url = new URL(req.url || '/', 'http://local')
  const wantInforme =
    url.searchParams.get('informe') === '1' ||
    url.searchParams.get('informeCatchup') === '1' ||
    String(req.query?.informe || '') === '1' ||
    String(req.query?.informeCatchup || '') === '1'
  const wantCatchup =
    url.searchParams.get('informeCatchup') === '1' ||
    String(req.query?.informeCatchup || '') === '1'
  const forceCatchup =
    url.searchParams.get('force') === '1' ||
    String(req.query?.force || '') === '1'

  const report = {
    ok: true,
    ts: new Date().toISOString(),
    backend: typeof getBackend === 'function' ? getBackend() : 'unknown',
    supabase: typeof hasSupabase === 'function' ? hasSupabase() : false,
    keys: {},
  }

  try {
    for (const key of ['kitchen', 'tpv', 'jornada', 'cierres', 'carta']) {
      try {
        const v = await getJson(key, null, { fresh: true })
        report.keys[key] = {
          ok: true,
          hasData: v != null,
          updatedAt: v && v.updatedAt ? Number(v.updatedAt) : 0,
        }
      } catch (err) {
        report.ok = false
        report.keys[key] = {
          ok: false,
          error: String(err && err.message ? err.message : err),
        }
      }
    }
  } catch (err) {
    report.ok = false
    report.error = String(err && err.message ? err.message : err)
  }

  if (wantInforme) {
    try {
      report.informe = await getInformeStatus(new Date())
    } catch (err) {
      report.informe = {
        error: String(err && err.message ? err.message : err),
      }
    }
  }

  if (wantCatchup) {
    const now = new Date()
    const wd = madridWeekday(now)
    try {
      if (wd !== 'Mon') {
        report.informeCatchup = {
          ok: true,
          skipped: true,
          reason: 'not_monday',
          wd,
        }
      } else {
        // Catch-up manual: cualquier hora del lunes (cron ~10:00)
        report.informeCatchup = await runInforme('semanal', {
          force: forceCatchup,
          now,
        })
      }
      // refrescar status tras intento
      try {
        report.informe = await getInformeStatus(now)
      } catch (_) {
        /* ignore */
      }
    } catch (err) {
      report.informeCatchup = {
        ok: false,
        error: String(err && err.message ? err.message : err),
      }
    }
  }

  res.statusCode = report.ok ? 200 : 503
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify(report))
}

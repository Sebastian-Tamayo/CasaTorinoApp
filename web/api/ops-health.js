/**
 * Health check operativo — Supabase ops_kv
 * GET /api/ops-health
 */
const { getJson, getBackend, hasSupabase } = require('./_opsStore')

module.exports = async function handler(req, res) {
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

  const report = {
    ok: true,
    ts: new Date().toISOString(),
    backend: typeof getBackend === 'function' ? getBackend() : 'unknown',
    supabase: typeof hasSupabase === 'function' ? hasSupabase() : false,
    keys: {},
  }

  try {
    for (const key of ['kitchen', 'tpv', 'jornada', 'cierres']) {
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

  res.statusCode = report.ok ? 200 : 503
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify(report))
}

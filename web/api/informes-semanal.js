/**
 * Informe semanal de ventas → email (Resend) a REPORT_EMAIL_TO.
 *
 * GET|POST /api/informes-semanal
 * Auth: x-vercel-cron | Bearer CRON_SECRET | X-Tpv-Key | cookie TPV
 *
 * Query/body:
 *   dryRun=1  → HTML + JSON sin enviar
 *   force=1   → reenviar aunque ya exista en informe-log
 */
const { runInforme } = require('./_informeReports')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const CRON_SECRET = process.env.CRON_SECRET || SYNC_KEY || ''

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Tpv-Key, Cache-Control',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
}

function authorized(req) {
  if (req.headers['x-vercel-cron'] === '1') return true
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  if (SYNC_KEY && key && key === SYNC_KEY) return true
  if (CRON_SECRET) {
    const auth = String(req.headers.authorization || '')
    if (auth === `Bearer ${CRON_SECRET}`) return true
  }
  return false
}

function flag(req, name) {
  const url = new URL(req.url || '/', 'http://local')
  if (url.searchParams.get(name) === '1') return true
  const body =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body || '{}')
          } catch {
            return {}
          }
        })()
      : req.body || {}
  return body[name] === true || body[name] === 1 || body[name] === '1'
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  }
  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'unauthorized' }))
  }

  try {
    const dryRun = flag(req, 'dryRun')
    const force = flag(req, 'force')
    const result = await runInforme('semanal', { dryRun, force })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    // En dryRun el HTML puede ser grande; lo dejamos (pensado para móvil)
    return res.end(JSON.stringify(result))
  } catch (err) {
    console.error('[informes-semanal]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
      }),
    )
  }
}

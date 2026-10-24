/**
 * Casa Torino TPV — login por PIN (sin exponer el PIN en el frontend).
 *
 * POST /api/tpv-auth  { "pin": "...." }
 * GET  /api/tpv-auth  → { ok }  (además renueva cookie si hay sesión = sliding)
 * DELETE /api/tpv-auth → cierra sesión
 * POST /api/tpv-auth  { "refresh": true } → renueva si cookie válida
 *
 * También enruta /api/qz-sign (rewrite) para no gastar una función Hobby.
 */

const PIN = process.env.TPV_PIN || ''
const { applySecurityHeaders } = require('./_securityHeaders')
const {
  hasTpvSession,
  setSessionCookie,
  MAX_AGE_SEC,
  sessionSecret,
} = require('./_tpvSession')
const handleQzSign = require('./_qzSign')

function wantsQzSign(req) {
  const q = req.query || {}
  if (String(q.__mod || '') === 'qz-sign') return true
  const url = String(req.url || '')
  return /qz-sign/i.test(url) || /[?&]__mod=qz-sign\b/i.test(url)
}

function cors(res) {
  applySecurityHeaders(res)
  res.setHeader('Access-Control-Allow-Origin', res.req?.headers?.origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control')
  res.setHeader('Cache-Control', 'no-store')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body
}

module.exports = async function handler(req, res) {
  if (wantsQzSign(req)) return handleQzSign(req, res)

  res.req = req
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  try {
    if (req.method === 'GET') {
      const ok = hasTpvSession(req)
      if (ok) setSessionCookie(res, true) // sliding renewal
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({ ok, maxAgeHours: Math.round(MAX_AGE_SEC / 3600) }),
      )
    }

    if (req.method === 'DELETE') {
      setSessionCookie(res, false)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: true }))
    }

    if (req.method === 'POST') {
      const body = parseBody(req)

      if (body.refresh) {
        if (!hasTpvSession(req)) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ ok: false, error: 'Sesión caducada' }))
        }
        setSessionCookie(res, true)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, refreshed: true }))
      }

      if (!PIN) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({
            ok: false,
            error: 'TPV_PIN no configurado en el servidor',
          }),
        )
      }
      if (!sessionSecret()) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({
            ok: false,
            error: 'Falta secreto de sesión (TPV_SYNC_KEY o TPV_PIN)',
          }),
        )
      }
      const pin = String(body.pin || '').trim()
      if (pin && pin === PIN) {
        setSessionCookie(res, true)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true }))
      }
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: false, error: 'PIN incorrecto' }))
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[tpv-auth]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'auth error' }))
  }
}

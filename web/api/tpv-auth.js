/**
 * Casa Torino TPV — login por PIN (sin exponer el PIN en el frontend).
 *
 * POST /api/tpv-auth  { "pin": "...." }
 * GET  /api/tpv-auth  → { ok }  (además renueva cookie si hay sesión = sliding)
 * DELETE /api/tpv-auth → cierra sesión
 * POST /api/tpv-auth  { "refresh": true } → renueva si cookie válida
 */

const PIN = process.env.TPV_PIN || ''
const COOKIE = 'ct_tpv_session'
// Cookie 24h + sliding renewal (heartbeat cliente cada 15 min)
const MAX_AGE = 60 * 60 * 24 // 24 h

function cors(res) {
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

function hasSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === COOKIE + '=1')
}

function setSession(res, on) {
  if (on) {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax; Secure`,
    )
  } else {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
    )
  }
}

module.exports = async function handler(req, res) {
  res.req = req
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  try {
    if (req.method === 'GET') {
      const ok = hasSession(req)
      if (ok) setSession(res, true) // sliding renewal
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok, maxAgeHours: 24 }))
    }

    if (req.method === 'DELETE') {
      setSession(res, false)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: true }))
    }

    if (req.method === 'POST') {
      const body = parseBody(req)

      // Renovar sesión existente (heartbeat 24h)
      if (body.refresh) {
        if (!hasSession(req)) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ ok: false, error: 'Sesión caducada' }))
        }
        setSession(res, true)
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
      const pin = String(body.pin || '').trim()
      if (pin && pin === PIN) {
        setSession(res, true)
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

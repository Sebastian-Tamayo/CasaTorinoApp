/**
 * Casa Torino TPV — login por PIN de usuario (sin exponer PINs al frontend).
 *
 * POST /api/tpv-auth  { "pin": "...." } → login
 * POST /api/tpv-auth  { "action": "pendingUsers" } → nombres sin PIN (primer acceso)
 * POST /api/tpv-auth  { "action": "gateUsers" } → id/name/pinSet (login: elegir usuario)
 * POST /api/tpv-auth  { "action": "setPin", userId, pin } → primer acceso
 * POST /api/tpv-auth  { "action": "createUser", adminPin, name, userPin } → alta
 * POST /api/tpv-auth  { "action": "listUsers" } → nombres (sesión OK)
 * POST /api/tpv-auth  { "action": "switchUser", userId, pin } → cambio de usuario
 * POST /api/tpv-auth  { "action": "getAudit", adminPin } → monitor TPV
 * POST /api/tpv-auth  { "userId", "pin", "gate":"tpv" } → login de ese usuario
 * GET  /api/tpv-auth  → { ok, user }  (sliding cookie)
 * DELETE /api/tpv-auth → cierra sesión
 * POST /api/tpv-auth  { "refresh": true } → renueva si cookie válida
 *
 * También enruta /api/qz-sign (rewrite) — 0 función Hobby extra.
 */

const { applySecurityHeaders } = require('./_securityHeaders')
const {
  hasTpvSession,
  getSessionUser,
  getSessionEpochFromReq,
  setSessionCookie,
  MAX_AGE_SEC,
  sessionSecret,
} = require('./_tpvSession')
const {
  loadUsersStore,
  pendingUsers,
  gateUsers,
  setUserPin,
  createUser,
  authenticatePin,
  authenticateUserPin,
  allowTpvLogin,
  bootstrapLoginDeniedMessage,
  getSessionEpoch,
  adminPinOk,
  publicUser,
} = require('./_tpvUsers')
const { appendLogin, getAudit } = require('./_tpvAudit')
const handleQzSign = require('./_qzSign')

async function issueSession(res, user) {
  const epoch = await getSessionEpoch()
  setSessionCookie(res, true, user, epoch)
  return epoch
}

/**
 * Epoch inválido → echa a todos (reset).
 * Jornada cerrada → echa a quien no sea Lore/Sebas.
 */
async function enforceBootstrapSession(req, res, user) {
  if (!user) return { ok: false, user: null }
  const needEpoch = await getSessionEpoch()
  const gotEpoch = getSessionEpochFromReq(req)
  if (needEpoch && gotEpoch !== needEpoch) {
    setSessionCookie(res, false)
    return {
      ok: false,
      user: null,
      kicked: true,
      error: 'Sesión reiniciada — introduce el PIN',
    }
  }
  const allowed = await allowTpvLogin(user)
  if (!allowed) {
    setSessionCookie(res, false)
    return {
      ok: false,
      user: null,
      kicked: true,
      error: bootstrapLoginDeniedMessage(),
    }
  }
  return { ok: true, user: allowed }
}

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

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify(body))
}

function auditLoginSafe(type, user, note) {
  void appendLogin({
    type,
    t: Date.now(),
    userId: user?.id || '',
    userName: user?.name || '',
    note: note || '',
  }).catch((err) => console.warn('[tpv-auth] audit', err))
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
      const user = ok ? getSessionUser(req) : null
      if (!ok || !user) {
        return json(res, 200, {
          ok: false,
          user: null,
          maxAgeHours: Math.round(MAX_AGE_SEC / 3600),
        })
      }
      const gate = await enforceBootstrapSession(req, res, user)
      if (!gate.ok) {
        return json(res, 200, {
          ok: false,
          user: null,
          kicked: Boolean(gate.kicked),
          error: gate.error || '',
          maxAgeHours: Math.round(MAX_AGE_SEC / 3600),
        })
      }
      await issueSession(res, gate.user) // sliding renewal
      return json(res, 200, {
        ok: true,
        user: gate.user,
        maxAgeHours: Math.round(MAX_AGE_SEC / 3600),
      })
    }

    if (req.method === 'DELETE') {
      const user = getSessionUser(req)
      if (user) auditLoginSafe('logout', user)
      setSessionCookie(res, false)
      return json(res, 200, { ok: true })
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      const action = String(body.action || '').trim()

      if (body.refresh) {
        if (!hasTpvSession(req)) {
          return json(res, 401, { ok: false, error: 'Sesión caducada' })
        }
        const user = getSessionUser(req)
        const gate = await enforceBootstrapSession(req, res, user)
        if (!gate.ok) {
          return json(res, 401, {
            ok: false,
            kicked: Boolean(gate.kicked),
            error: gate.error || 'Sesión caducada',
          })
        }
        await issueSession(res, gate.user)
        return json(res, 200, { ok: true, refreshed: true, user: gate.user })
      }

      if (!sessionSecret()) {
        return json(res, 500, {
          ok: false,
          error: 'Falta secreto de sesión (TPV_SYNC_KEY o TPV_PIN)',
        })
      }

      if (action === 'pendingUsers') {
        const store = await loadUsersStore()
        return json(res, 200, {
          ok: true,
          action: 'pendingUsers',
          users: pendingUsers(store),
        })
      }

      if (action === 'gateUsers') {
        const store = await loadUsersStore()
        return json(res, 200, {
          ok: true,
          action: 'gateUsers',
          users: gateUsers(store),
        })
      }

      if (action === 'setPin') {
        const userId = String(body.userId || '').trim()
        const pin = String(body.pin || '').trim()
        const pin2 = String(body.pinConfirm || body.pin2 || pin).trim()
        if (pin !== pin2) {
          return json(res, 400, { ok: false, error: 'Los PIN no coinciden' })
        }
        try {
          // Siempre guarda el PIN (primer acceso). Entrar solo si allowTpvLogin.
          const user = await setUserPin(userId, pin)
          const allowed = await allowTpvLogin(user)
          if (allowed) {
            await issueSession(res, user)
            auditLoginSafe('set_pin', user, 'primer acceso')
            return json(res, 200, {
              ok: true,
              action: 'setPin',
              user,
              entered: true,
            })
          }
          auditLoginSafe('set_pin', user, 'primer acceso (sin entrar)')
          return json(res, 200, {
            ok: true,
            action: 'setPin',
            user,
            entered: false,
            message: bootstrapLoginDeniedMessage(),
          })
        } catch (err) {
          return json(res, 400, {
            ok: false,
            error: String(err && err.message ? err.message : err),
          })
        }
      }

      if (action === 'createUser') {
        try {
          const user = await createUser(
            body.name,
            body.adminPin,
            body.userPin || body.newUserPin,
          )
          return json(res, 200, { ok: true, action: 'createUser', user })
        } catch (err) {
          const msg = String(err && err.message ? err.message : err)
          const status = /^PIN incorrecto$/i.test(msg) ? 401 : 400
          return json(res, status, { ok: false, error: msg })
        }
      }

      if (action === 'listUsers') {
        if (!hasTpvSession(req)) {
          return json(res, 401, { ok: false, error: 'unauthorized' })
        }
        const store = await loadUsersStore()
        return json(res, 200, {
          ok: true,
          action: 'listUsers',
          users: (store.users || []).map(publicUser),
        })
      }

      if (action === 'switchUser') {
        if (!hasTpvSession(req)) {
          return json(res, 401, { ok: false, error: 'unauthorized' })
        }
        const from = getSessionUser(req)
        const userId = String(body.userId || '').trim()
        const pin = String(body.pin || '').trim()
        if (!userId || !pin) {
          return json(res, 401, { ok: false, error: 'PIN incorrecto' })
        }
        const user = await authenticateUserPin(userId, pin)
        if (!user) {
          return json(res, 401, { ok: false, error: 'PIN incorrecto' })
        }
        const allowed = await allowTpvLogin(user)
        if (!allowed) {
          return json(res, 403, {
            ok: false,
            error: bootstrapLoginDeniedMessage(),
          })
        }
        await issueSession(res, user)
        auditLoginSafe(
          'switch',
          user,
          from?.name ? `desde ${from.name}` : 'cambio de usuario',
        )
        return json(res, 200, { ok: true, action: 'switchUser', user })
      }

      if (action === 'getAudit') {
        if (!(await adminPinOk(body.adminPin || body.pin))) {
          return json(res, 401, { ok: false, error: 'PIN incorrecto' })
        }
        const data = await getAudit()
        return json(res, 200, {
          ok: true,
          action: 'getAudit',
          logins: data.logins,
          events: data.events,
          updatedAt: data.updatedAt,
        })
      }

      // Login: con userId (TPV elige persona) o solo PIN (cocina/interno)
      // gate:'tpv' → antes de jornada solo Lore/Sebas
      const pin = String(body.pin || '').trim()
      if (!pin) {
        return json(res, 401, { ok: false, error: 'PIN incorrecto' })
      }
      const wantUserId = String(body.userId || '').trim()
      const user = wantUserId
        ? await authenticateUserPin(wantUserId, pin)
        : await authenticatePin(pin)
      if (!user) {
        return json(res, 401, { ok: false, error: 'PIN incorrecto' })
      }
      const gate = String(body.gate || '').trim().toLowerCase()
      if (gate === 'tpv') {
        const allowed = await allowTpvLogin(user)
        if (!allowed) {
          return json(res, 403, {
            ok: false,
            error: bootstrapLoginDeniedMessage(),
          })
        }
      }
      await issueSession(res, user)
      auditLoginSafe('login', user, gate === 'tpv' ? 'tpv' : '')
      return json(res, 200, { ok: true, user })
    }

    return json(res, 405, { error: 'method not allowed' })
  } catch (err) {
    console.error('[tpv-auth]', err)
    return json(res, 500, { error: 'auth error' })
  }
}

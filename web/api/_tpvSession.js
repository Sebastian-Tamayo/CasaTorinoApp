/**
 * Sesión TPV firmada (HMAC) — cookie ct_tpv_session.
 * v4: usuario + sessionEpoch + issuedAt + estado jornada (abre/cierre día siguiente).
 * v3: usuario + sessionEpoch (invalidación global al resetear usuarios).
 * v2/v1: compat; el auth puede invalidar v3/v4 con epoch o jornada.
 * Secret: TPV_SESSION_SECRET || TPV_SYNC_KEY || TPV_PIN
 */
const crypto = require('crypto')

const COOKIE = 'ct_tpv_session'
const MAX_AGE_SEC = 60 * 60 * 24 // 24 h

function sessionSecret() {
  return String(
    process.env.TPV_SESSION_SECRET ||
      process.env.TPV_SYNC_KEY ||
      process.env.TPV_PIN ||
      '',
  ).trim()
}

function b64url(s) {
  return Buffer.from(String(s || ''), 'utf8').toString('base64url')
}

function fromB64url(s) {
  try {
    return Buffer.from(String(s || ''), 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

/** Payload v3: v3.{exp}.{userId}.{nameB64}.{epoch} */
function signToken(expMs, user, epoch) {
  const secret = sessionSecret()
  if (!secret) return ''
  const uid =
    String(user?.id || 'anon')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40) || 'anon'
  const nameB64 = b64url(String(user?.name || '').slice(0, 40))
  const ep = String(Math.trunc(Number(epoch) || 0))
  const payload = `v3.${expMs}.${uid}.${nameB64}.${ep}`
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** v4: epoch (usuarios) + issuedAt (día operativo siguiente al cierre pide PIN) */
function signTokenV4(expMs, user, meta) {
  const secret = sessionSecret()
  if (!secret) return ''
  const uid =
    String(user?.id || 'anon')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40) || 'anon'
  const nameB64 = b64url(String(user?.name || '').slice(0, 40))
  const ep = String(Math.trunc(Number(meta?.epoch) || 0))
  const issued = String(Math.trunc(Number(meta?.issuedAt) || Date.now()))
  const payload = `v4.${expMs}.${uid}.${nameB64}.${ep}.${issued}`
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** Compat lectura v2 (sin epoch). */
function signTokenV2(expMs, user) {
  const secret = sessionSecret()
  if (!secret) return ''
  const uid =
    String(user?.id || 'anon')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40) || 'anon'
  const nameB64 = b64url(String(user?.name || '').slice(0, 40))
  const payload = `v2.${expMs}.${uid}.${nameB64}`
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function signTokenV1(expMs) {
  const secret = sessionSecret()
  if (!secret) return ''
  const payload = `v1.${expMs}`
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function readCookieValue(req) {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq)
    if (k !== COOKIE) continue
    try {
      return decodeURIComponent(trimmed.slice(eq + 1))
    } catch {
      return trimmed.slice(eq + 1)
    }
  }
  return ''
}

function parseSession(req) {
  const secret = sessionSecret()
  if (!secret) return null
  const val = readCookieValue(req)
  if (!val) return null
  const parts = val.split('.')
  if (parts.length === 3 && parts[0] === 'v1') {
    const exp = Number(parts[1])
    if (!Number.isFinite(exp) || Date.now() > exp) return null
    const expect = signTokenV1(exp)
    if (!expect || expect.length !== val.length) return null
    try {
      if (!crypto.timingSafeEqual(Buffer.from(val), Buffer.from(expect))) return null
    } catch {
      return null
    }
    return { ok: true, version: 1, user: null, exp, epoch: 0 }
  }
  if (parts.length === 5 && parts[0] === 'v2') {
    const exp = Number(parts[1])
    const userId = parts[2]
    const nameB64 = parts[3]
    if (!Number.isFinite(exp) || Date.now() > exp) return null
    const name = fromB64url(nameB64)
    const expect = signTokenV2(exp, { id: userId, name })
    if (!expect || expect.length !== val.length) return null
    try {
      if (!crypto.timingSafeEqual(Buffer.from(val), Buffer.from(expect))) return null
    } catch {
      return null
    }
    return {
      ok: true,
      version: 2,
      user: {
        id: userId,
        name: name || userId,
        role: userId === 'u-tpv-fisico' ? 'central' : 'staff',
      },
      exp,
      epoch: 0,
      issuedAt: 0,
    }
  }
  if (parts.length === 6 && parts[0] === 'v3') {
    const exp = Number(parts[1])
    const userId = parts[2]
    const nameB64 = parts[3]
    const epoch = Number(parts[4])
    if (!Number.isFinite(exp) || Date.now() > exp) return null
    if (!Number.isFinite(epoch)) return null
    const name = fromB64url(nameB64)
    const expect = signToken(exp, { id: userId, name }, epoch)
    if (!expect || expect.length !== val.length) return null
    try {
      if (!crypto.timingSafeEqual(Buffer.from(val), Buffer.from(expect))) return null
    } catch {
      return null
    }
    return {
      ok: true,
      version: 3,
      user: {
        id: userId,
        name: name || userId,
        role: userId === 'u-tpv-fisico' ? 'central' : 'staff',
      },
      exp,
      epoch,
      issuedAt: 0,
    }
  }
  if (parts.length === 7 && parts[0] === 'v4') {
    const exp = Number(parts[1])
    const userId = parts[2]
    const nameB64 = parts[3]
    const epoch = Number(parts[4])
    const issuedAt = Number(parts[5])
    if (!Number.isFinite(exp) || Date.now() > exp) return null
    if (!Number.isFinite(epoch) || !Number.isFinite(issuedAt)) return null
    const name = fromB64url(nameB64)
    const expect = signTokenV4(exp, { id: userId, name }, {
      epoch,
      issuedAt,
    })
    if (!expect || expect.length !== val.length) return null
    try {
      if (!crypto.timingSafeEqual(Buffer.from(val), Buffer.from(expect))) return null
    } catch {
      return null
    }
    return {
      ok: true,
      version: 4,
      user: {
        id: userId,
        name: name || userId,
        role: userId === 'u-tpv-fisico' ? 'central' : 'staff',
      },
      exp,
      epoch,
      issuedAt,
    }
  }
  return null
}

function hasTpvSession(req) {
  return Boolean(parseSession(req))
}

function getSessionUser(req) {
  const s = parseSession(req)
  return s?.user || null
}

function getSessionEpochFromReq(req) {
  const s = parseSession(req)
  return Number(s?.epoch) || 0
}

function getSessionIssuedAtFromReq(req) {
  const s = parseSession(req)
  return Number(s?.issuedAt) || 0
}

/**
 * opts:
 * - número → epoch v3 (legacy)
 * - objeto → v4 { epoch, issuedAt }
 */
function setSessionCookie(res, on, user, opts) {
  if (on) {
    const exp = Date.now() + MAX_AGE_SEC * 1000
    let token = ''
    if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
      token = signTokenV4(exp, user || null, {
        epoch: Number(opts.epoch) || 0,
        issuedAt: Number(opts.issuedAt) || Date.now(),
      })
    } else {
      const epoch = Number(opts) || 0
      token = signToken(exp, user || null, epoch)
    }
    if (!token) {
      return false
    }
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SEC}; HttpOnly; SameSite=Lax; Secure`,
    )
    return true
  }
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
  )
  return true
}

module.exports = {
  COOKIE,
  MAX_AGE_SEC,
  hasTpvSession,
  getSessionUser,
  getSessionEpochFromReq,
  getSessionIssuedAtFromReq,
  parseSession,
  setSessionCookie,
  sessionSecret,
  signToken,
  signTokenV4,
}

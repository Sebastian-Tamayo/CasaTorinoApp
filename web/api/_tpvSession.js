/**
 * Sesión TPV firmada (HMAC) — cookie ct_tpv_session.
 * v3: usuario + sessionEpoch (invalidación global al resetear usuarios).
 * v2/v1: se aceptan en parse pero el auth las echa si hay epoch nuevo.
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

/** Payload firmado v3: v3.{exp}.{userId}.{nameB64}.{epoch} */
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

function setSessionCookie(res, on, user, epoch) {
  if (on) {
    const exp = Date.now() + MAX_AGE_SEC * 1000
    const token = signToken(exp, user || null, epoch)
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
  parseSession,
  setSessionCookie,
  sessionSecret,
  signToken,
}

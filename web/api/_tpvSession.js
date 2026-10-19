/**
 * Sesión TPV firmada (HMAC) — cookie ct_tpv_session.
 * Sustituye el valor forjable "=1".
 *
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

function signToken(expMs) {
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

function hasTpvSession(req) {
  const secret = sessionSecret()
  if (!secret) return false
  const val = readCookieValue(req)
  if (!val) return false
  const parts = val.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const exp = Number(parts[1])
  if (!Number.isFinite(exp) || Date.now() > exp) return false
  const expect = signToken(exp)
  if (!expect || expect.length !== val.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(val), Buffer.from(expect))
  } catch {
    return false
  }
}

function setSessionCookie(res, on) {
  if (on) {
    const exp = Date.now() + MAX_AGE_SEC * 1000
    const token = signToken(exp)
    if (!token) {
      // Sin secreto no se puede firmar — no poner cookie forjable
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
  setSessionCookie,
  sessionSecret,
}

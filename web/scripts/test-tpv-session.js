#!/usr/bin/env node
/** Firma/verificación cookie TPV (v3 epoch legacy + v4 issuedAt) */
process.env.TPV_PIN = process.env.TPV_PIN || '1234'
process.env.TPV_SYNC_KEY = process.env.TPV_SYNC_KEY || 'test-sync-key'
const assert = require('assert')
const {
  hasTpvSession,
  getSessionUser,
  getSessionEpochFromReq,
  getSessionIssuedAtFromReq,
  setSessionCookie,
  sessionSecret,
} = require('../api/_tpvSession')

assert.ok(sessionSecret(), 'secret')

function readCookieToken(res) {
  const setCookie = String((res.headers && res.headers['Set-Cookie']) || '')
  const m = setCookie.match(/ct_tpv_session=([^;]+)/)
  assert.ok(m, 'cookie')
  return decodeURIComponent(m[1])
}

// v4
{
  const headers = {}
  const res = {
    headers,
    setHeader(k, v) {
      headers[k] = v
    },
  }
  const epoch = 1700000000000
  const issuedAt = 1700001000000
  assert.strictEqual(
    setSessionCookie(res, true, { id: 'u-sebas', name: 'Sebas' }, { epoch, issuedAt }),
    true,
  )
  const token = readCookieToken(res)
  assert.ok(token.startsWith('v4.'), 'v4 prefix')

  const req = { headers: { cookie: `ct_tpv_session=${encodeURIComponent(token)}` } }
  assert.strictEqual(hasTpvSession(req), true)
  assert.strictEqual(getSessionUser(req).id, 'u-sebas')
  assert.strictEqual(getSessionEpochFromReq(req), epoch)
  assert.strictEqual(getSessionIssuedAtFromReq(req), issuedAt)
}

// v3 (número epoch)
{
  const headers = {}
  const res = {
    headers,
    setHeader(k, v) {
      headers[k] = v
    },
  }
  const epoch = 1700002000000
  assert.strictEqual(
    setSessionCookie(res, true, { id: 'u-ali', name: 'Ali' }, epoch),
    true,
  )
  const token = readCookieToken(res)
  assert.ok(token.startsWith('v3.'), 'v3 prefix')

  const req = { headers: { cookie: `ct_tpv_session=${encodeURIComponent(token)}` } }
  assert.strictEqual(hasTpvSession(req), true)
  assert.strictEqual(getSessionEpochFromReq(req), epoch)
  assert.strictEqual(getSessionIssuedAtFromReq(req), 0)
}

assert.strictEqual(
  hasTpvSession({ headers: { cookie: 'ct_tpv_session=1' } }),
  false,
)
assert.strictEqual(
  hasTpvSession({ headers: { cookie: 'ct_tpv_session=v1.1.fakesig' } }),
  false,
)

console.log('OK test-tpv-session')

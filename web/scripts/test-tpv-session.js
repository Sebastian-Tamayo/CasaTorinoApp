#!/usr/bin/env node
/** Firma/verificación cookie TPV (v3 con usuario + epoch) */
process.env.TPV_PIN = process.env.TPV_PIN || '1234'
process.env.TPV_SYNC_KEY = process.env.TPV_SYNC_KEY || 'test-sync-key'
const assert = require('assert')
const {
  hasTpvSession,
  getSessionUser,
  getSessionEpochFromReq,
  setSessionCookie,
  sessionSecret,
} = require('../api/_tpvSession')

assert.ok(sessionSecret(), 'secret')

const headers = {}
const res = {
  setHeader(k, v) {
    headers[k] = v
  },
}
const epoch = 1700000000000
assert.strictEqual(
  setSessionCookie(res, true, { id: 'u-sebas', name: 'Sebas' }, epoch),
  true,
)
const setCookie = String(headers['Set-Cookie'] || '')
assert.ok(setCookie.includes('ct_tpv_session='), 'set cookie')
const m = setCookie.match(/ct_tpv_session=([^;]+)/)
assert.ok(m, 'cookie value')
const token = decodeURIComponent(m[1])
assert.ok(token.startsWith('v3.'), 'v3 token')

const req = {
  headers: { cookie: `ct_tpv_session=${encodeURIComponent(token)}` },
}
assert.strictEqual(hasTpvSession(req), true, 'valid session')
const user = getSessionUser(req)
assert.ok(user && user.id === 'u-sebas', 'user id')
assert.ok(user && user.name === 'Sebas', 'user name')
assert.strictEqual(getSessionEpochFromReq(req), epoch, 'epoch')

assert.strictEqual(
  hasTpvSession({ headers: { cookie: 'ct_tpv_session=1' } }),
  false,
  'legacy forge rejected',
)
assert.strictEqual(
  hasTpvSession({ headers: { cookie: 'ct_tpv_session=v1.1.fakesig' } }),
  false,
  'bad sig rejected',
)

console.log('OK test-tpv-session')

#!/usr/bin/env node
/** Firma/verificación cookie TPV */
process.env.TPV_PIN = process.env.TPV_PIN || '1234'
process.env.TPV_SYNC_KEY = process.env.TPV_SYNC_KEY || 'test-sync-key'
const assert = require('assert')
const {
  hasTpvSession,
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
assert.strictEqual(setSessionCookie(res, true), true)
const setCookie = String(headers['Set-Cookie'] || '')
assert.ok(setCookie.includes('ct_tpv_session='), 'set cookie')
const m = setCookie.match(/ct_tpv_session=([^;]+)/)
assert.ok(m, 'cookie value')
const token = decodeURIComponent(m[1])

assert.strictEqual(
  hasTpvSession({ headers: { cookie: `ct_tpv_session=${encodeURIComponent(token)}` } }),
  true,
  'valid session',
)
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

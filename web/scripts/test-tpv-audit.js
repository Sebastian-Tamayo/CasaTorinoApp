#!/usr/bin/env node
/** Anillo audit TPV (memoria local sin Supabase) */
process.env.TPV_PIN = process.env.TPV_PIN || '9999'
process.env.TPV_SYNC_KEY = process.env.TPV_SYNC_KEY || 'test-sync-key'
const assert = require('assert')
const {
  appendLogin,
  appendEvent,
  getAudit,
  sanitizeEvent,
} = require('../api/_tpvAudit')
const { adminPinOk, CREATE_USER_PIN } = require('../api/_tpvUsers')

const bad = sanitizeEvent({ type: '', userName: 'x' })
assert.strictEqual(bad, null)

async function main() {
  assert.strictEqual(await adminPinOk(CREATE_USER_PIN), true)
  assert.strictEqual(await adminPinOk('0000'), false)

  await appendLogin({ type: 'login', userId: 'u-tpv-fisico', userName: 'TPV FÍSICO' })
  await appendEvent({
    type: 'cart_add',
    userId: 'u-tpv-fisico',
    userName: 'TPV FÍSICO',
    mesa: '5',
    item: 'Café',
    qtyBefore: 0,
    qtyAfter: 1,
  })
  const data = await getAudit()
  assert.ok(data.logins.some((r) => r.type === 'login' && r.userId === 'u-tpv-fisico'))
  assert.ok(data.events.some((r) => r.type === 'cart_add' && r.mesa === '5'))
  console.log('OK test-tpv-audit')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

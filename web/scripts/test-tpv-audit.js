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
const { setUserPin, pendingUsers, loadUsersStore, adminPinOk } = require('../api/_tpvUsers')

const bad = sanitizeEvent({ type: '', userName: 'x' })
assert.strictEqual(bad, null)

async function main() {
  const store = await loadUsersStore()
  const sebas = pendingUsers(store).find((u) => u.name === 'Sebas')
  assert.ok(sebas, 'sebas pending')
  await setUserPin(sebas.id, '3212')
  assert.strictEqual(await adminPinOk('3212'), true)
  assert.strictEqual(await adminPinOk('0000'), false)

  await appendLogin({ type: 'login', userId: 'u-sebas', userName: 'Sebas' })
  await appendEvent({
    type: 'cart_add',
    userId: 'u-sebas',
    userName: 'Sebas',
    mesa: '5',
    item: 'Café',
    qtyBefore: 0,
    qtyAfter: 1,
  })
  const data = await getAudit()
  assert.ok(data.logins.some((r) => r.type === 'login' && r.userName === 'Sebas'))
  assert.ok(data.events.some((r) => r.type === 'cart_add' && r.mesa === '5'))
  console.log('OK test-tpv-audit')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

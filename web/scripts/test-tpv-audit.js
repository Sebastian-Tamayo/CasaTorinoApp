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
    price: 1.5,
    amount: 1.5,
    category: 'barra',
  })
  await appendEvent({
    type: 'cobro',
    userId: 'u-tpv-fisico',
    userName: 'TPV FÍSICO',
    mesa: '5',
    amount: 12.5,
    tip: 1,
    payMethod: 'tarjeta',
    scope: 'completo',
    linesCount: 2,
    item: '1× Café, 1× Bocata',
  })
  const data = await getAudit()
  assert.ok(data.logins.some((r) => r.type === 'login' && r.userId === 'u-tpv-fisico'))
  const add = data.events.find((r) => r.type === 'cart_add' && r.mesa === '5')
  assert.ok(add && add.category === 'barra' && add.price === 1.5)
  const cobro = data.events.find((r) => r.type === 'cobro')
  assert.ok(cobro && cobro.payMethod === 'tarjeta' && cobro.scope === 'completo')
  console.log('OK test-tpv-audit')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

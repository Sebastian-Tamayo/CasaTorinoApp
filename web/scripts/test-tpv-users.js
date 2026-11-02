#!/usr/bin/env node
/** Hash / auth local de usuarios TPV (sin Supabase) */
process.env.TPV_PIN = process.env.TPV_PIN || '9999'
process.env.TPV_SYNC_KEY = process.env.TPV_SYNC_KEY || 'test-sync-key'
const assert = require('assert')
const {
  hashPin,
  authenticatePin,
  authenticateUserPin,
  allowTpvLogin,
  loadUsersStore,
  createUser,
  pendingUsers,
  gateUsers,
  BOOTSTRAP_USER_IDS,
  isBootstrapUser,
  adminPinOk,
  USERS_STORE_VERSION,
  CREATE_USER_PIN,
  getSessionEpoch,
} = require('../api/_tpvUsers')

assert.ok(hashPin('2908').length === 64, 'hash length')

async function main() {
  const store = await loadUsersStore()
  assert.ok(store.storeVersion >= USERS_STORE_VERSION, 'store version')
  assert.ok(store.sessionEpoch > 0, 'session epoch')
  assert.ok(store.storeVersion >= 6 || store.users.some((u) => u.id === 'u-tpv-fisico' && u.pinSet))
  assert.ok(store.users.some((u) => u.id === 'u-tpv-fisico' && u.pinSet), 'fisico con PIN')
  assert.ok(
    store.users.filter((u) => u.id === 'u-tpv-fisico').length === 1,
    'un solo fisico',
  )

  assert.strictEqual(pendingUsers(store).length, 0, 'nadie pendiente')
  const gate = gateUsers(store)
  assert.ok(gate.some((u) => u.id === 'u-tpv-fisico' && u.pinSet))

  const fisico = await authenticatePin('2908')
  assert.ok(fisico && fisico.id === 'u-tpv-fisico', 'pin 2908 → fisico')
  const byId = await authenticateUserPin('u-tpv-fisico', '2908')
  assert.ok(byId && byId.id === 'u-tpv-fisico')
  assert.ok(await allowTpvLogin(fisico), 'fisico siempre permitido')
  assert.ok(BOOTSTRAP_USER_IDS.has('u-tpv-fisico'))
  assert.ok(isBootstrapUser(fisico))
  assert.ok(await adminPinOk('2908'))
  assert.ok(!(await adminPinOk('0000')))

  const neu = await createUser('Sebas', CREATE_USER_PIN, '3212')
  assert.ok(neu && neu.name === 'Sebas')
  assert.strictEqual(await allowTpvLogin(neu), null, 'staff bloqueado sin jornada')

  assert.ok((await getSessionEpoch()) > 0)
  console.log('OK test-tpv-users')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

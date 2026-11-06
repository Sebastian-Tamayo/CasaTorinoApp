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
  setUserPin,
  createUser,
  pendingUsers,
  gateUsers,
  BOOTSTRAP_USER_IDS,
  isBootstrapUser,
  adminPinOk,
  USERS_STORE_VERSION,
  CREATE_USER_PIN,
  HUB_ACCESS_PIN,
  getSessionEpoch,
} = require('../api/_tpvUsers')

assert.ok(hashPin('2908').length === 64, 'hash length')
assert.strictEqual(HUB_ACCESS_PIN, '0912', 'hub interno')

async function main() {
  const store = await loadUsersStore()
  assert.ok(store.storeVersion >= USERS_STORE_VERSION, 'store version')
  assert.ok(store.sessionEpoch > 0, 'session epoch')
  assert.ok(store.users.length >= 9, 'fisico + staff seed')
  // v8: NADIE tiene PIN al seed (incluido TPV FÍSICO)
  assert.ok(
    store.users.every((u) => !u.pinSet),
    'seed sin PINs',
  )
  assert.ok(store.users.some((u) => u.id === 'u-tpv-fisico' && !u.pinSet))

  const pending = pendingUsers(store)
  assert.ok(pending.some((u) => u.id === 'u-tpv-fisico'), 'fisico primer acceso')
  assert.ok(pending.some((u) => u.name === 'Sebas'), 'sebas primer acceso')
  assert.ok(pending.some((u) => u.name === 'Lore'), 'lore primer acceso')
  assert.ok(pending.some((u) => u.name === 'Ali'), 'ali primer acceso')

  const gate = gateUsers(store)
  assert.ok(gate.some((u) => u.id === 'u-tpv-fisico' && !u.pinSet))
  assert.ok(gate.some((u) => u.name === 'Sebas' && !u.pinSet))

  // Hub Gestión interna (0912) funciona sin primer acceso TPV
  const hub = await authenticatePin(HUB_ACCESS_PIN)
  assert.ok(hub && hub.id === 'u-tpv-fisico', 'hub 0912 sin pin personal')

  // PIN personal aún no: no autentica como usuario
  assert.strictEqual(await authenticatePin('2908'), null)
  assert.strictEqual(await authenticateUserPin('u-tpv-fisico', '2908'), null)

  // CREATE_USER_PIN sigue valiendo para alta (no es login de caja)
  assert.ok(await adminPinOk(CREATE_USER_PIN))

  const fisicoP = pending.find((u) => u.id === 'u-tpv-fisico')
  const fisico = await setUserPin(fisicoP.id, '2908')
  assert.ok(fisico.pinSet)
  assert.ok(await authenticatePin('2908'))
  assert.ok(await authenticateUserPin('u-tpv-fisico', '2908'))
  assert.ok(await allowTpvLogin(fisico))
  assert.ok(BOOTSTRAP_USER_IDS.has('u-tpv-fisico'))
  assert.ok(BOOTSTRAP_USER_IDS.has('u-lore') && BOOTSTRAP_USER_IDS.has('u-sebas'))
  assert.ok(await adminPinOk('2908'))

  const sebasP = pendingUsers(await loadUsersStore()).find((u) => u.name === 'Sebas')
  const sebas = await setUserPin(sebasP.id, '3212')
  assert.ok(sebas.pinSet)
  assert.ok(await allowTpvLogin(sebas))
  assert.ok(await authenticateUserPin('u-sebas', '3212'))
  assert.strictEqual(await authenticateUserPin('u-sebas', '2908'), null)

  const aliP = pendingUsers(await loadUsersStore()).find((u) => u.name === 'Ali')
  const ali = await setUserPin(aliP.id, '1111')
  assert.ok(await allowTpvLogin(ali), 'staff con PIN puede login TPV')
  // Cookie de sesión no lleva pinSet — debe resolver por id en store
  const fromCookie = await allowTpvLogin({ id: ali.id, name: ali.name, role: 'staff' })
  assert.ok(fromCookie && fromCookie.pinSet, 'allowTpvLogin sin pinSet en cookie')

  const neu = await createUser('Nueva', CREATE_USER_PIN)
  assert.ok(neu && neu.name === 'Nueva')
  assert.strictEqual(neu.pinSet, false, 'nuevo sin PIN')
  assert.ok(
    pendingUsers(await loadUsersStore()).some((u) => u.name === 'Nueva'),
    'nuevo en primer acceso',
  )
  assert.strictEqual(await authenticateUserPin(neu.id, '5555'), null)
  assert.ok(isBootstrapUser(fisico) && isBootstrapUser(sebas) && !isBootstrapUser(ali))
  assert.ok((await getSessionEpoch()) > 0)

  console.log('OK test-tpv-users')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

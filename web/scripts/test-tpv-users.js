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
  getSessionEpoch,
} = require('../api/_tpvUsers')

assert.ok(hashPin('2908').length === 64, 'hash length')
assert.notStrictEqual(hashPin('2908'), hashPin('3212'), 'distinct pins')

async function main() {
  const store = await loadUsersStore()
  assert.ok(store.storeVersion >= USERS_STORE_VERSION, 'store version')
  assert.ok(store.sessionEpoch > 0, 'session epoch')
  assert.ok(store.users.length >= 9, 'seed staff + fisico')

  // Sin PINs de fábrica (excepto caja si hay TPV_PIN env)
  const pending = pendingUsers(store)
  assert.ok(pending.some((u) => u.name === 'Sebas'), 'sebas en primer acceso')
  assert.ok(pending.some((u) => u.name === 'Lore'), 'lore en primer acceso')
  assert.ok(pending.some((u) => u.name === 'Ali'), 'ali en primer acceso')

  const gate = gateUsers(store)
  assert.ok(gate.every((u) => u.id !== 'u-tpv-fisico'), 'gate sin caja')
  assert.ok(gate.some((u) => u.name === 'Sebas' && !u.pinSet))

  // Antes de setPin, admin no vale (nadie bootstrap con PIN)
  assert.strictEqual(await adminPinOk('3212'), false, 'admin sin pins aún')

  const sebasPending = pending.find((u) => u.name === 'Sebas')
  const sebasSet = await setUserPin(sebasPending.id, '3212')
  assert.ok(sebasSet.pinSet && sebasSet.role === 'admin', 'sebas pin set')
  const lorePending = pendingUsers(await loadUsersStore()).find((u) => u.name === 'Lore')
  await setUserPin(lorePending.id, '2908')

  assert.ok(await adminPinOk('3212'), 'sebas pin es admin')
  assert.ok(await adminPinOk('2908'), 'lore pin es admin')
  assert.ok(!(await adminPinOk('0000')), 'bad admin')

  const sebas = await authenticatePin('3212')
  assert.ok(sebas && sebas.name === 'Sebas', 'sebas login')
  const asSebas = await authenticateUserPin('u-sebas', '3212')
  assert.ok(asSebas && asSebas.name === 'Sebas', 'login por userId')
  assert.strictEqual(await authenticateUserPin('u-sebas', '2908'), null, 'pin ajeno no')

  const lore = await authenticatePin('2908')
  assert.ok(await allowTpvLogin(lore))
  assert.ok(await allowTpvLogin(sebas))

  const ali = pendingUsers(await loadUsersStore()).find((u) => u.name === 'Ali')
  const aliSet = await setUserPin(ali.id, '1111')
  assert.strictEqual(await allowTpvLogin(aliSet), null, 'staff blocked before jornada')

  try {
    await createUser('Hack', '0000', '5555')
    assert.fail('should reject')
  } catch (err) {
    assert.ok(/PIN incorrecto/i.test(err.message))
  }
  const neu = await createUser('Nueva', '3212', '5555')
  assert.ok(neu && neu.name === 'Nueva')

  assert.ok(BOOTSTRAP_USER_IDS.has('u-lore') && BOOTSTRAP_USER_IDS.has('u-sebas'))
  assert.ok(isBootstrapUser(sebas) && !isBootstrapUser(aliSet))
  assert.ok((await getSessionEpoch()) > 0)
  const fisico = await authenticatePin('9999')
  assert.ok(fisico && fisico.id === 'u-tpv-fisico')

  console.log('OK test-tpv-users')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

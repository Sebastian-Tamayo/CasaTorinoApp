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
  CREATE_USER_PIN,
  BOOTSTRAP_USER_IDS,
  isBootstrapUser,
  adminPinOk,
  USERS_STORE_VERSION,
  getSessionEpoch,
} = require('../api/_tpvUsers')

assert.ok(hashPin('2908').length === 64, 'hash length')
assert.notStrictEqual(hashPin('2908'), hashPin('3212'), 'distinct pins')
assert.ok(adminPinOk('2908') && adminPinOk('3212'), 'admin pins lore+sebas')
assert.ok(!adminPinOk('0000'), 'bad admin pin')

async function main() {
  const store = await loadUsersStore()
  assert.ok(store.storeVersion >= USERS_STORE_VERSION, 'store version')
  assert.ok(store.sessionEpoch > 0, 'session epoch')
  assert.strictEqual(store.users.length, 3, 'solo fisico+lore+sebas')
  assert.ok(store.users.every((u) => ['u-tpv-fisico', 'u-lore', 'u-sebas'].includes(u.id)))

  const lore = await authenticatePin('2908')
  assert.ok(lore && lore.name === 'Lore', 'lore pin')
  const sebas = await authenticatePin('3212')
  assert.ok(sebas && sebas.name === 'Sebas' && sebas.role === 'admin', 'sebas pin admin')
  const fisico = await authenticatePin('9999')
  assert.ok(fisico && fisico.id === 'u-tpv-fisico', 'env pin → TPV FÍSICO')

  const pending = pendingUsers(store)
  assert.strictEqual(pending.length, 0, 'nadie pendiente tras reset')

  try {
    await createUser('Hack', '0000', '5555')
    assert.fail('should reject bad admin pin')
  } catch (err) {
    assert.ok(/^PIN incorrecto$/i.test(err.message), 'admin pin guard')
  }
  const neu = await createUser('Nueva', '3212', '5555')
  assert.ok(neu && neu.name === 'Nueva' && neu.pinSet, 'create with sebas pin')
  const neu2 = await createUser('Otra', CREATE_USER_PIN, '6666')
  assert.ok(neu2 && neu2.name === 'Otra', 'create with lore pin')
  const neuLogin = await authenticatePin('5555')
  assert.ok(neuLogin && neuLogin.name === 'Nueva', 'new user login')

  const asLore = await authenticateUserPin('u-lore', '2908')
  assert.ok(asLore && asLore.name === 'Lore', 'switch lore ok')
  const wrong = await authenticateUserPin('u-lore', '3212')
  assert.strictEqual(wrong, null, 'sebas pin no vale para lore')
  const asSebas = await authenticateUserPin('u-sebas', '3212')
  assert.ok(asSebas && asSebas.name === 'Sebas', 'switch sebas ok')
  const asFisico = await authenticateUserPin('u-tpv-fisico', '9999')
  assert.ok(asFisico && asFisico.id === 'u-tpv-fisico', 'switch fisico env pin')

  assert.ok(BOOTSTRAP_USER_IDS.has('u-lore') && BOOTSTRAP_USER_IDS.has('u-sebas'))
  const loreOk = await allowTpvLogin(lore)
  assert.ok(loreOk && loreOk.name === 'Lore', 'lore always allowed')
  const sebasOk = await allowTpvLogin(sebas)
  assert.ok(sebasOk && sebasOk.name === 'Sebas', 'sebas always allowed')
  const aliBlocked = await allowTpvLogin(neuLogin)
  assert.strictEqual(aliBlocked, null, 'staff blocked before jornada')
  assert.ok(isBootstrapUser(lore) && isBootstrapUser(sebas))
  assert.ok(!isBootstrapUser(neuLogin) && !isBootstrapUser(asFisico))
  assert.ok((await getSessionEpoch()) > 0)

  console.log('OK test-tpv-users')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

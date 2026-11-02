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
} = require('../api/_tpvUsers')

assert.ok(hashPin('2908').length === 64, 'hash length')
assert.notStrictEqual(hashPin('2908'), hashPin('3212'), 'distinct pins')

async function main() {
  const store = await loadUsersStore()
  assert.ok(store.users.length >= 8, 'seed users')
  const lore = await authenticatePin('2908')
  assert.ok(lore && lore.name === 'Lore', 'lore pin')
  const sebas = await authenticatePin('3212')
  assert.ok(sebas && sebas.name === 'Sebas', 'sebas pin')
  const fisico = await authenticatePin('9999')
  assert.ok(fisico && fisico.id === 'u-tpv-fisico', 'env pin → TPV FÍSICO')

  const pending = pendingUsers(store)
  assert.ok(pending.some((u) => u.name === 'Ali'), 'ali pending')

  const ali = pending.find((u) => u.name === 'Ali')
  const set = await setUserPin(ali.id, '1111')
  assert.ok(set.pinSet, 'ali pin set')
  const aliLogin = await authenticatePin('1111')
  assert.ok(aliLogin && aliLogin.name === 'Ali', 'ali login')

  try {
    await createUser('Hack', '0000', '5555')
    assert.fail('should reject bad admin pin')
  } catch (err) {
    assert.ok(/^PIN incorrecto$/i.test(err.message), 'admin pin guard')
  }
  const neu = await createUser('Nueva', CREATE_USER_PIN, '5555')
  assert.ok(neu && neu.name === 'Nueva' && neu.pinSet, 'create user with pin')
  const neuLogin = await authenticatePin('5555')
  assert.ok(neuLogin && neuLogin.name === 'Nueva', 'new user login')

  // Cambio de usuario: PIN debe ser del elegido (no el de otra persona)
  const asLore = await authenticateUserPin('u-lore', '2908')
  assert.ok(asLore && asLore.name === 'Lore', 'switch lore ok')
  const wrong = await authenticateUserPin('u-lore', '3212')
  assert.strictEqual(wrong, null, 'sebas pin no vale para lore')
  const asSebas = await authenticateUserPin('u-sebas', '3212')
  assert.ok(asSebas && asSebas.name === 'Sebas', 'switch sebas ok')
  const asFisico = await authenticateUserPin('u-tpv-fisico', '9999')
  assert.ok(asFisico && asFisico.id === 'u-tpv-fisico', 'switch fisico env pin')

  assert.ok(BOOTSTRAP_USER_IDS.has('u-lore') && BOOTSTRAP_USER_IDS.has('u-sebas'))
  // Sin jornada abierta (memoria local): solo bootstrap
  const loreOk = await allowTpvLogin(lore)
  assert.ok(loreOk && loreOk.name === 'Lore', 'lore always allowed')
  const sebasOk = await allowTpvLogin(sebas)
  assert.ok(sebasOk && sebasOk.name === 'Sebas', 'sebas always allowed')
  const aliBlocked = await allowTpvLogin(aliLogin)
  assert.strictEqual(aliBlocked, null, 'ali blocked before jornada')

  console.log('OK test-tpv-users')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Usuarios TPV (PIN por persona) — solo servidor vía ops_kv.
 * Clave: tpv_users  (hashes; nunca al cliente anon)
 * Espejo nombres → floor_plan.waiters (plano, sin PINs)
 *
 * Sin función Vercel extra: lo usa tpv-auth.js
 */
const crypto = require('crypto')
const { getJson, setJson, hasSupabase } = require('./_opsStore')
const { sessionSecret } = require('./_tpvSession')

const USERS_KEY = 'tpv_users'
const FLOOR_KEY = 'floor_plan'
/** PIN admin para crear usuarios. No exponer en UI. */
const CREATE_USER_PIN = '2908'

const SEED_USERS = [
  { id: 'u-tpv-fisico', name: 'TPV FÍSICO', role: 'central' },
  { id: 'u-lore', name: 'Lore', role: 'staff', pin: '2908' },
  { id: 'u-ali', name: 'Ali', role: 'staff' },
  { id: 'u-shari', name: 'Shari', role: 'staff' },
  { id: 'u-aleja', name: 'Aleja', role: 'staff' },
  { id: 'u-yuli', name: 'Yuli', role: 'staff' },
  { id: 'u-carol', name: 'Carol', role: 'staff' },
  { id: 'u-clara', name: 'Clara', role: 'staff' },
  { id: 'u-sebas', name: 'Sebas', role: 'staff', pin: '3212' },
]

function hashPin(pin) {
  const secret = sessionSecret()
  if (!secret) return ''
  return crypto
    .createHmac('sha256', secret)
    .update('tpv-user-pin:' + String(pin || '').trim())
    .digest('hex')
}

function publicUser(u) {
  if (!u) return null
  return {
    id: String(u.id),
    name: String(u.name || ''),
    role: u.role === 'central' ? 'central' : 'staff',
    pinSet: Boolean(u.pinSet && u.pinHash),
  }
}

function normalizeStore(raw) {
  const users = Array.isArray(raw?.users) ? raw.users : []
  return {
    version: 1,
    users: users
      .filter((u) => u && u.id && u.name)
      .map((u) => ({
        id: String(u.id),
        name: String(u.name).trim().slice(0, 40),
        role: u.role === 'central' ? 'central' : 'staff',
        pinHash: u.pinHash ? String(u.pinHash) : '',
        pinSet: Boolean(u.pinSet && u.pinHash),
      })),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
  }
}

function seedFromDefaults() {
  const envPin = String(process.env.TPV_PIN || '').trim()
  const users = SEED_USERS.map((s) => {
    let pin = s.pin ? String(s.pin) : ''
    // Caja física: si aún no tiene PIN propio, hereda TPV_PIN del entorno (sigue funcionando)
    if (!pin && s.id === 'u-tpv-fisico' && envPin) pin = envPin
    const pinHash = pin ? hashPin(pin) : ''
    return {
      id: s.id,
      name: s.name,
      role: s.role === 'central' ? 'central' : 'staff',
      pinHash,
      pinSet: Boolean(pinHash),
    }
  })
  return { version: 1, users, updatedAt: Date.now(), seeded: true }
}

/** Memoria local si no hay Supabase (tests / boot sin env). */
let memoryStore = null

async function loadUsersStore() {
  if (!hasSupabase()) {
    if (!memoryStore) memoryStore = seedFromDefaults()
    return memoryStore
  }
  const raw = await getJson(USERS_KEY, null)
  if (!raw || !Array.isArray(raw.users) || raw.users.length === 0) {
    const seeded = seedFromDefaults()
    try {
      await setJson(USERS_KEY, seeded)
      await syncFloorWaiters(seeded.users)
    } catch (err) {
      console.warn('[tpv-users] seed', err)
    }
    return seeded
  }
  return normalizeStore(raw)
}

async function saveUsersStore(store) {
  const next = normalizeStore(store)
  next.updatedAt = Date.now()
  if (!hasSupabase()) {
    memoryStore = next
    return next
  }
  await setJson(USERS_KEY, next)
  await syncFloorWaiters(next.users)
  return next
}

/** Espejo id+name al plano (sin hashes). 0 funciones extra. */
async function syncFloorWaiters(users) {
  if (!hasSupabase()) return
  try {
    const prev = (await getJson(FLOOR_KEY, null)) || {}
    const waiters = (users || []).map((u) => ({
      id: String(u.id),
      name: String(u.name),
    }))
    const value = {
      ...(prev && typeof prev === 'object' ? prev : {}),
      kind: prev?.kind || 'casa-torino-plano-mesas',
      source: prev?.source || 'ops_kv_overlay',
      tables: Array.isArray(prev?.tables) ? prev.tables : [],
      waiters,
      updatedAt: Date.now(),
    }
    await setJson(FLOOR_KEY, value)
  } catch (err) {
    console.warn('[tpv-users] sync floor waiters', err)
  }
}

function findByPin(store, pin) {
  const h = hashPin(pin)
  if (!h) return null
  return (store.users || []).find((u) => u.pinSet && u.pinHash === h) || null
}

function findById(store, id) {
  return (store.users || []).find((u) => u.id === String(id || '')) || null
}

function pendingUsers(store) {
  return (store.users || [])
    .filter((u) => !u.pinSet)
    .map((u) => ({ id: u.id, name: u.name }))
}

async function setUserPin(userId, pin) {
  const p = String(pin || '').trim()
  if (!/^\d{4}$/.test(p)) throw new Error('El PIN debe ser 4 dígitos')
  const store = await loadUsersStore()
  const u = findById(store, userId)
  if (!u) throw new Error('Usuario no encontrado')
  if (u.pinSet) throw new Error('Este usuario ya tiene PIN. Entra con tu PIN.')
  // Unicidad
  if (findByPin(store, p) && findByPin(store, p).id !== u.id) {
    throw new Error('Ese PIN ya está en uso')
  }
  u.pinHash = hashPin(p)
  u.pinSet = true
  await saveUsersStore(store)
  return publicUser(u)
}

function slugUserId(name) {
  return (
    'u-' +
    String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28)
  )
}

async function createUser(name, adminPin, userPin) {
  if (String(adminPin || '').trim() !== CREATE_USER_PIN) {
    throw new Error('PIN incorrecto')
  }
  const n = String(name || '').trim().slice(0, 40)
  if (!n) throw new Error('Escribe un nombre')
  const p = String(userPin || '').trim()
  if (!/^\d{4}$/.test(p)) {
    throw new Error('El PIN del nuevo usuario debe ser 4 dígitos')
  }
  const store = await loadUsersStore()
  if (
    store.users.some((u) => u.name.toLowerCase() === n.toLowerCase())
  ) {
    throw new Error('Ya existe ese usuario')
  }
  if (findByPin(store, p)) {
    throw new Error('Ese PIN ya está en uso')
  }
  let id = slugUserId(n)
  if (!id || store.users.some((u) => u.id === id)) {
    id = id + '-' + Date.now().toString(36).slice(-4)
  }
  const u = {
    id,
    name: n,
    role: 'staff',
    pinHash: hashPin(p),
    pinSet: true,
  }
  store.users.push(u)
  await saveUsersStore(store)
  return publicUser(u)
}

/**
 * Login: PIN de usuario, o TPV_PIN de entorno → TPV FÍSICO (compat cocina/interno).
 */
async function authenticatePin(pin) {
  const p = String(pin || '').trim()
  if (!p) return null
  const store = await loadUsersStore()
  const byUser = findByPin(store, p)
  if (byUser) return publicUser(byUser)

  const envPin = String(process.env.TPV_PIN || '').trim()
  if (envPin && p === envPin) {
    const fisico = findById(store, 'u-tpv-fisico')
    if (fisico) {
      // Si la caja aún no eligió PIN propio, el env PIN la identifica
      if (!fisico.pinSet) return publicUser(fisico)
      // Si ya tiene PIN propio distinto, env PIN sigue valiendo como caja (ops)
      return publicUser(fisico)
    }
    return { id: 'u-tpv-fisico', name: 'TPV FÍSICO', role: 'central', pinSet: true }
  }
  return null
}

module.exports = {
  USERS_KEY,
  CREATE_USER_PIN,
  hashPin,
  publicUser,
  loadUsersStore,
  saveUsersStore,
  pendingUsers,
  setUserPin,
  createUser,
  authenticatePin,
  findById,
  syncFloorWaiters,
}

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
const JORNADA_KEY = 'jornada'
/**
 * Subir esto fuerza reseedar usuarios + nuevo sessionEpoch
 * (invalida cookies; NO toca mesas/jornada/cocina).
 */
const USERS_STORE_VERSION = 6
/** PIN del TPV físico / admin de alta. No exponer en UI. */
const CREATE_USER_PIN = '2908'
/** Acceso a cualquier hora (sin jornada abierta): caja física. */
const BOOTSTRAP_USER_IDS = new Set(['u-tpv-fisico'])

/**
 * Solo TPV FÍSICO con PIN 2908. El resto se crea luego (Nuevo usuario).
 * No borra mesas ni jornada en ops_kv — solo tpv_users + epoch.
 */
const SEED_USERS = [
  { id: 'u-tpv-fisico', name: 'TPV FÍSICO', role: 'central', pin: '2908' },
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
  const role =
    u.role === 'central' ? 'central' : u.role === 'admin' ? 'admin' : 'staff'
  return {
    id: String(u.id),
    name: String(u.name || ''),
    role,
    pinSet: Boolean(u.pinSet && u.pinHash),
  }
}

function normalizeRole(role) {
  if (role === 'central') return 'central'
  if (role === 'admin') return 'admin'
  return 'staff'
}

function normalizeStore(raw) {
  const users = Array.isArray(raw?.users) ? raw.users : []
  return {
    version: 1,
    storeVersion: Number(raw?.storeVersion) || 0,
    sessionEpoch: Number(raw?.sessionEpoch) || 0,
    users: users
      .filter((u) => u && u.id && u.name)
      .map((u) => ({
        id: String(u.id),
        name: String(u.name).trim().slice(0, 40),
        role: normalizeRole(u.role),
        pinHash: u.pinHash ? String(u.pinHash) : '',
        pinSet: Boolean(u.pinSet && u.pinHash),
      })),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
  }
}

function seedFromDefaults() {
  const users = SEED_USERS.map((s) => {
    const pin = s.pin ? String(s.pin) : ''
    const pinHash = pin ? hashPin(pin) : ''
    return {
      id: s.id,
      name: s.name,
      role: normalizeRole(s.role),
      pinHash,
      pinSet: Boolean(pinHash),
    }
  })
  return {
    version: 1,
    storeVersion: USERS_STORE_VERSION,
    sessionEpoch: Date.now(),
    users,
    updatedAt: Date.now(),
    seeded: true,
  }
}

/** Memoria local si no hay Supabase (tests / boot sin env). */
let memoryStore = null

/** Garantiza caja física con PIN admin (por si un seed viejo la dejó sin PIN). */
async function ensureFisicoBootstrap(store) {
  let list = Array.isArray(store?.users) ? store.users.slice() : []
  let f = list.find((u) => u && u.id === 'u-tpv-fisico')
  let changed = false
  if (!f) {
    f = {
      id: 'u-tpv-fisico',
      name: 'TPV FÍSICO',
      role: 'central',
      pinHash: '',
      pinSet: false,
    }
    list.unshift(f)
    changed = true
  }
  if (!f.pinSet || !f.pinHash) {
    const pinHash = hashPin(CREATE_USER_PIN)
    if (pinHash) {
      f.pinHash = pinHash
      f.pinSet = true
      f.role = 'central'
      f.name = f.name || 'TPV FÍSICO'
      changed = true
    }
  }
  if (!changed) return store
  const next = {
    ...store,
    users: list.map((u) =>
      u.id === 'u-tpv-fisico' ? f : u,
    ),
    storeVersion: Math.max(Number(store.storeVersion) || 0, USERS_STORE_VERSION),
    sessionEpoch: Number(store.sessionEpoch) || Date.now(),
  }
  return saveUsersStore(next)
}

async function loadUsersStore() {
  if (!hasSupabase()) {
    if (!memoryStore || memoryStore.storeVersion < USERS_STORE_VERSION) {
      memoryStore = seedFromDefaults()
    }
    return ensureFisicoBootstrap(memoryStore)
  }
  const raw = await getJson(USERS_KEY, null)
  const normalized = raw && Array.isArray(raw.users) ? normalizeStore(raw) : null
  if (
    !normalized ||
    normalized.users.length === 0 ||
    normalized.storeVersion < USERS_STORE_VERSION
  ) {
    const seeded = seedFromDefaults()
    try {
      await setJson(USERS_KEY, seeded)
      await syncFloorWaiters(seeded.users)
      console.warn(
        '[tpv-users] reseed storeVersion',
        USERS_STORE_VERSION,
        'epoch',
        seeded.sessionEpoch,
      )
    } catch (err) {
      console.warn('[tpv-users] seed', err)
    }
    return ensureFisicoBootstrap(seeded)
  }
  return ensureFisicoBootstrap(normalized)
}

async function saveUsersStore(store) {
  const next = normalizeStore(store)
  if (!next.storeVersion) next.storeVersion = USERS_STORE_VERSION
  if (!next.sessionEpoch) next.sessionEpoch = Date.now()
  next.updatedAt = Date.now()
  if (!hasSupabase()) {
    memoryStore = next
    return next
  }
  await setJson(USERS_KEY, next)
  await syncFloorWaiters(next.users)
  return next
}

async function getSessionEpoch() {
  const store = await loadUsersStore()
  return Number(store.sessionEpoch) || 0
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
    .filter((u) => !u.pinSet && u.role !== 'central')
    .map((u) => ({ id: u.id, name: u.name }))
}

/** Lista pública para el gate (sin hashes): elegir usuario y luego PIN. */
function gateUsers(store) {
  return (store.users || [])
    .filter((u) => u && u.id && u.name)
    .map((u) => ({
      id: String(u.id),
      name: String(u.name),
      pinSet: Boolean(u.pinSet && u.pinHash),
      role: normalizeRole(u.role),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Admin = PIN de usuarios bootstrap (ahora TPV FÍSICO = 2908). */
async function adminPinOk(pin) {
  const p = String(pin || '').trim()
  if (!p) return false
  if (p === CREATE_USER_PIN) return true
  const store = await loadUsersStore()
  const h = hashPin(p)
  if (!h) return false
  return (store.users || []).some(
    (u) =>
      BOOTSTRAP_USER_IDS.has(String(u.id)) &&
      u.pinSet &&
      u.pinHash &&
      u.pinHash === h,
  )
}

async function setUserPin(userId, pin) {
  const p = String(pin || '').trim()
  if (!/^\d{4}$/.test(p)) throw new Error('El PIN debe ser 4 dígitos')
  const store = await loadUsersStore()
  const u = findById(store, userId)
  if (!u) throw new Error('Usuario no encontrado')
  if (u.pinSet) throw new Error('Este usuario ya tiene PIN. Entra con tu PIN.')
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
  if (!(await adminPinOk(adminPin))) {
    throw new Error('PIN incorrecto')
  }
  const n = String(name || '').trim().slice(0, 40)
  if (!n) throw new Error('Escribe un nombre')
  const p = String(userPin || '').trim()
  if (!/^\d{4}$/.test(p)) {
    throw new Error('El PIN del nuevo usuario debe ser 4 dígitos')
  }
  const store = await loadUsersStore()
  if (store.users.some((u) => u.name.toLowerCase() === n.toLowerCase())) {
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
    if (fisico) return publicUser(fisico)
    return { id: 'u-tpv-fisico', name: 'TPV FÍSICO', role: 'central', pinSet: true }
  }
  return null
}

/**
 * Cambio de usuario: el PIN debe pertenecer exactamente a userId.
 * TPV FÍSICO también acepta TPV_PIN env.
 */
async function authenticateUserPin(userId, pin) {
  const id = String(userId || '').trim()
  const p = String(pin || '').trim()
  if (!id || !p) return null
  const store = await loadUsersStore()
  const u = findById(store, id)
  if (!u) return null
  const h = hashPin(p)
  if (u.pinSet && u.pinHash && h && u.pinHash === h) {
    return publicUser(u)
  }
  if (u.id === 'u-tpv-fisico') {
    const envPin = String(process.env.TPV_PIN || '').trim()
    if (envPin && p === envPin) return publicUser(u)
  }
  return null
}

async function isJornadaOpen() {
  try {
    if (!hasSupabase()) return false
    const j = await getJson(JORNADA_KEY, null)
    return Boolean(j && j.status === 'open')
  } catch {
    return false
  }
}

/**
 * Antes de abrir jornada / tras fin: solo TPV FÍSICO.
 * Con jornada abierta: cualquier usuario con PIN válido.
 */
async function allowTpvLogin(user) {
  if (!user || !user.id) return null
  if (BOOTSTRAP_USER_IDS.has(String(user.id))) return user
  if (await isJornadaOpen()) return user
  return null
}

function bootstrapLoginDeniedMessage() {
  return 'Sin jornada abierta solo puede entrar el TPV físico'
}

function isBootstrapUser(user) {
  return Boolean(user && BOOTSTRAP_USER_IDS.has(String(user.id || '')))
}

module.exports = {
  USERS_KEY,
  USERS_STORE_VERSION,
  CREATE_USER_PIN,
  BOOTSTRAP_USER_IDS,
  hashPin,
  publicUser,
  loadUsersStore,
  saveUsersStore,
  getSessionEpoch,
  pendingUsers,
  gateUsers,
  setUserPin,
  createUser,
  authenticatePin,
  authenticateUserPin,
  allowTpvLogin,
  bootstrapLoginDeniedMessage,
  isBootstrapUser,
  isJornadaOpen,
  adminPinOk,
  findById,
  syncFloorWaiters,
}

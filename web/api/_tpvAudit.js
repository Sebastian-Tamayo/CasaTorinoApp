/**
 * Audit TPV — anillos en ops_kv (clave tpv_audit).
 * Logins + movimientos. Sin función Vercel propia: lo usa tpv-auth / cliente.
 */
const { getJson, setJson, updateJson, hasSupabase } = require('./_opsStore')

const AUDIT_KEY = 'tpv_audit'
const MAX_LOGINS = 200
const MAX_EVENTS = 500
/** Mismo PIN que createUser / monitor. */
const ADMIN_PIN = '2908'

function emptyStore() {
  return {
    version: 1,
    logins: [],
    events: [],
    updatedAt: Date.now(),
  }
}

function normalizeStore(raw) {
  const base = raw && typeof raw === 'object' ? raw : {}
  return {
    version: 1,
    logins: Array.isArray(base.logins) ? base.logins : [],
    events: Array.isArray(base.events) ? base.events : [],
    updatedAt: Number(base.updatedAt) || Date.now(),
  }
}

function trimRing(arr, max) {
  if (!Array.isArray(arr)) return []
  if (arr.length <= max) return arr
  return arr.slice(arr.length - max)
}

function sanitizeEvent(ev, kind) {
  if (!ev || typeof ev !== 'object') return null
  const type = String(ev.type || kind || '').trim().slice(0, 40)
  if (!type) return null
  const out = {
    t: Number(ev.t) || Date.now(),
    type,
    userId: String(ev.userId || '').trim().slice(0, 40),
    userName: String(ev.userName || '').trim().slice(0, 40),
  }
  if (ev.mesa != null && String(ev.mesa).trim()) {
    out.mesa = String(ev.mesa).trim().slice(0, 8)
  }
  if (ev.item != null && String(ev.item).trim()) {
    out.item = String(ev.item).trim().slice(0, 80)
  }
  if (ev.qtyBefore != null && Number.isFinite(Number(ev.qtyBefore))) {
    out.qtyBefore = Number(ev.qtyBefore)
  }
  if (ev.qtyAfter != null && Number.isFinite(Number(ev.qtyAfter))) {
    out.qtyAfter = Number(ev.qtyAfter)
  }
  if (ev.note != null && String(ev.note).trim()) {
    out.note = String(ev.note).trim().slice(0, 120)
  }
  if (ev.amount != null && Number.isFinite(Number(ev.amount))) {
    out.amount = Math.round(Number(ev.amount) * 100) / 100
  }
  return out
}

let memoryStore = null

async function loadAuditStore() {
  if (!hasSupabase()) {
    if (!memoryStore) memoryStore = emptyStore()
    return memoryStore
  }
  const raw = await getJson(AUDIT_KEY, null, { fresh: true })
  if (!raw) return emptyStore()
  return normalizeStore(raw)
}

async function saveAuditStore(store) {
  const next = normalizeStore(store)
  next.logins = trimRing(next.logins, MAX_LOGINS)
  next.events = trimRing(next.events, MAX_EVENTS)
  next.updatedAt = Date.now()
  if (!hasSupabase()) {
    memoryStore = next
    return next
  }
  await setJson(AUDIT_KEY, next)
  return next
}

async function appendLogin(ev) {
  const row = sanitizeEvent(ev, 'login')
  if (!row) return null
  if (!hasSupabase()) {
    const store = await loadAuditStore()
    store.logins.push(row)
    return saveAuditStore(store)
  }
  try {
    return await updateJson(AUDIT_KEY, emptyStore, (base) => {
      const s = normalizeStore(base)
      s.logins = trimRing([...s.logins, row], MAX_LOGINS)
      return s
    })
  } catch (err) {
    console.warn('[tpv-audit] appendLogin', err)
    return null
  }
}

async function appendEvent(ev) {
  const row = sanitizeEvent(ev, '')
  if (!row) return null
  if (!hasSupabase()) {
    const store = await loadAuditStore()
    store.events.push(row)
    return saveAuditStore(store)
  }
  try {
    return await updateJson(AUDIT_KEY, emptyStore, (base) => {
      const s = normalizeStore(base)
      s.events = trimRing([...s.events, row], MAX_EVENTS)
      return s
    })
  } catch (err) {
    console.warn('[tpv-audit] appendEvent', err)
    return null
  }
}

/** Merge batch from client (cart/mesa writes via anon may race — server getAudit is source for UI). */
async function appendEventsBatch(list) {
  const rows = (Array.isArray(list) ? list : [])
    .map((e) => sanitizeEvent(e, ''))
    .filter(Boolean)
  if (!rows.length) return null
  if (!hasSupabase()) {
    const store = await loadAuditStore()
    store.events = trimRing([...store.events, ...rows], MAX_EVENTS)
    return saveAuditStore(store)
  }
  try {
    return await updateJson(AUDIT_KEY, emptyStore, (base) => {
      const s = normalizeStore(base)
      s.events = trimRing([...s.events, ...rows], MAX_EVENTS)
      return s
    })
  } catch (err) {
    console.warn('[tpv-audit] appendEventsBatch', err)
    return null
  }
}

async function getAudit() {
  const store = await loadAuditStore()
  return {
    logins: trimRing(store.logins, MAX_LOGINS).slice().reverse(),
    events: trimRing(store.events, MAX_EVENTS).slice().reverse(),
    updatedAt: store.updatedAt || null,
  }
}

function adminPinOk(pin) {
  return String(pin || '').trim() === ADMIN_PIN
}

module.exports = {
  AUDIT_KEY,
  MAX_LOGINS,
  MAX_EVENTS,
  ADMIN_PIN,
  appendLogin,
  appendEvent,
  appendEventsBatch,
  getAudit,
  adminPinOk,
  emptyStore,
  sanitizeEvent,
}

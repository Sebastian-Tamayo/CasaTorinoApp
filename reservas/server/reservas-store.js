/**
 * Persistencia de reservas — Supabase ops_kv (plan gratis).
 * Sustituye Vercel Edge Config (cuota writes agotada).
 *
 * Env (proyecto Vercel reservas-casatorino):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (o SUPABASE_SECRET_KEY / SUPABASE_ANON_KEY)
 *
 * Claves ops_kv: `reservas` · `tpvReservaAlerts`
 */
function cleanToken(raw) {
  let t = String(raw || '').trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1)
  }
  return t.trim()
}

const SUPABASE_URL = cleanToken(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
).replace(/\/$/, '')
const SUPABASE_KEY = cleanToken(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '',
)

const ITEM_KEY = 'reservas'
const ALERTS_KEY = 'tpvReservaAlerts'
const ALERTS_MAX = 30
const ALERT_TTL_MS = 24 * 60 * 60 * 1000

/** @type {null | { items: any[], updatedAt: number }} */
let memory = null

export function cors(res, methods = 'GET,POST,PUT,OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control')
  res.setHeader('Cache-Control', 'no-store')
}

export function mapItem(raw) {
  if (!raw) return raw
  const { _id, ...rest } = raw
  return { ...rest, id: rest.id || _id }
}

function assertConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o ANON) en Vercel (reservas)',
    )
  }
}

function restHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Prefer: 'return=representation',
    ...extra,
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sbFetch(path, options = {}) {
  assertConfig()
  const url = `${SUPABASE_URL}/rest/v1/${path.replace(/^\//, '')}`
  let lastErr = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, {
        ...options,
        headers: restHeaders(options.headers || {}),
        cache: 'no-store',
      })
      const text = await r.text()
      let data = null
      if (text && text.trim()) {
        try {
          data = JSON.parse(text)
        } catch {
          data = text
        }
      }
      if (!r.ok) {
        const msg =
          (data && data.message) ||
          (data && data.error) ||
          (typeof data === 'string' ? data : '') ||
          `supabase ${r.status}`
        const err = new Error(msg)
        err.status = r.status
        err.body = data
        throw err
      }
      return data
    } catch (err) {
      lastErr = err
      if (
        err &&
        err.status &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 429
      ) {
        throw err
      }
      await sleep(80 * attempt * attempt)
    }
  }
  throw lastErr || new Error('supabase fetch failed')
}

async function readOpsKey(key) {
  const rows = await sbFetch(
    `ops_kv?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at`,
    { method: 'GET' },
  )
  if (!Array.isArray(rows) || !rows.length) return null
  return rows[0].value
}

async function writeOpsKey(key, value) {
  const payload = {
    key: String(key),
    value,
    updated_at: new Date().toISOString(),
  }
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sbFetch('ops_kv?on_conflict=key', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      })
      return
    } catch (err) {
      lastErr = err
      const status = err && err.status
      if (status !== 409 && status !== 429 && !(status >= 500)) break
      await sleep(120 * attempt)
    }
  }
  throw lastErr || new Error('ops_kv write failed')
}

async function readItems() {
  const value = await readOpsKey(ITEM_KEY)
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.items)) return value.items
  return []
}

async function writeItems(items) {
  await writeOpsKey(ITEM_KEY, { items, updatedAt: Date.now() })
}

function normalizeAlerts(value) {
  const raw = Array.isArray(value?.alerts)
    ? value.alerts
    : Array.isArray(value)
      ? value
      : []
  const now = Date.now()
  const alerts = raw
    .filter((a) => a && a.id)
    .filter((a) => {
      const created = Date.parse(String(a.createdAt || '')) || 0
      return !created || now - created < ALERT_TTL_MS
    })
    .slice(0, ALERTS_MAX)
  return {
    alerts,
    updatedAt: Number(value?.updatedAt) || now,
  }
}

async function loadItems() {
  const items = await readItems()
  memory = { items, updatedAt: Date.now() }
  return items
}

async function saveItems(items) {
  memory = { items, updatedAt: Date.now() }
  await writeItems(items)
  return items
}

export async function listReservas() {
  const items = await loadItems()
  return items.map(mapItem)
}

export async function createReserva(item) {
  const items = await loadItems()
  const next = [item, ...items]
  await saveItems(next)
  return mapItem(item)
}

export async function updateReserva(id, patch) {
  const items = await loadItems()
  const idx = items.findIndex((r) => r.id === id || r._id === id)
  if (idx < 0) return null
  const current = items[idx]
  const clean = Object.fromEntries(
    Object.entries(patch || {}).filter(([, v]) => v !== undefined),
  )
  const nextItem = {
    ...current,
    ...clean,
    id: current.id || id,
    codigo: current.codigo,
    createdAt: current.createdAt,
    creadoPor: current.creadoPor,
    updatedAt: new Date().toISOString(),
  }
  const next = items.slice()
  next[idx] = nextItem
  await saveItems(next)
  return mapItem(nextItem)
}

async function loadAlerts() {
  const value = await readOpsKey(ALERTS_KEY)
  return normalizeAlerts(value)
}

async function saveAlerts(alerts) {
  const payload = {
    alerts: alerts.slice(0, ALERTS_MAX),
    updatedAt: Date.now(),
  }
  await writeOpsKey(ALERTS_KEY, payload)
  return payload
}

/** Avisos TPV: reserva hecha desde la web */
export async function listTpvReservaAlerts() {
  const { alerts, updatedAt } = await loadAlerts()
  return { alerts, updatedAt }
}

export async function pushTpvReservaAlert(alert) {
  if (!alert || !alert.id) throw new Error('alert.id requerido')
  const { alerts } = await loadAlerts()
  const next = [alert, ...alerts.filter((a) => a && a.id !== alert.id)].slice(
    0,
    ALERTS_MAX,
  )
  const saved = await saveAlerts(next)
  return { alert, ...saved }
}

export async function ackTpvReservaAlert(id) {
  const alertId = String(id || '').trim()
  const { alerts } = await loadAlerts()
  if (!alertId) {
    const saved = await saveAlerts([])
    return { ok: true, removed: alerts.length, ...saved }
  }
  const next = alerts.filter((a) => a && a.id !== alertId)
  const saved = await saveAlerts(next)
  return { ok: true, removed: alerts.length - next.length, ...saved }
}

/** Compat: algunos scripts antiguos importaban STORE */
export const STORE = ''

export function getStoreBackend() {
  return SUPABASE_URL && SUPABASE_KEY ? 'supabase-ops_kv' : 'none'
}

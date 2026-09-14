/**
 * Persistencia de reservas — Vercel Edge Config (estable).
 * Sustituye CrudCrud (límite ~100 req/día → 500 en producción).
 *
 * Env (en el proyecto Vercel de reservas):
 *   RESERVAS_EDGE_CONFIG_ID  (o TPV_EDGE_CONFIG_ID)
 *   RESERVAS_TEAM_ID         (o TPV_TEAM_ID)
 *   RESERVAS_VERCEL_TOKEN    (o TPV_VERCEL_TOKEN)
 */
const EDGE_ID =
  process.env.RESERVAS_EDGE_CONFIG_ID || process.env.TPV_EDGE_CONFIG_ID || ''
const TEAM_ID = process.env.RESERVAS_TEAM_ID || process.env.TPV_TEAM_ID || ''
const VERCEL_TOKEN =
  process.env.RESERVAS_VERCEL_TOKEN || process.env.TPV_VERCEL_TOKEN || ''
const ITEM_KEY = 'reservas'

/** @type {null | { items: any[], updatedAt: number }} */
let memory = null

export function cors(res, methods = 'GET,POST,PUT,OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

export function mapItem(raw) {
  if (!raw) return raw
  const { _id, ...rest } = raw
  return { ...rest, id: rest.id || _id }
}

function assertConfig() {
  if (!EDGE_ID || !VERCEL_TOKEN) {
    throw new Error(
      'Falta configuración Edge Config (RESERVAS_EDGE_CONFIG_ID / RESERVAS_VERCEL_TOKEN)',
    )
  }
}

async function readEdge() {
  assertConfig()
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/item/${ITEM_KEY}` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    cache: 'no-store',
  })
  if (r.status === 404) return []
  if (!r.ok) throw new Error('edge GET ' + r.status)
  const data = await r.json()
  // API may return value directly or { key, value }
  const value =
    data && typeof data === 'object' && 'value' in data && data.key === ITEM_KEY
      ? data.value
      : data
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.items)) return value.items
  return []
}

async function writeEdge(items) {
  assertConfig()
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/items` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  const payload = {
    items: [
      {
        operation: 'upsert',
        key: ITEM_KEY,
        value: { items, updatedAt: Date.now() },
      },
    ],
  }

  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (r.ok) return
    const text = await r.text().catch(() => '')
    lastErr = new Error('edge PATCH ' + r.status + ' ' + text.slice(0, 180))
    // Reintentar solo ante conflictos/transitorios
    if (r.status !== 409 && r.status !== 429 && r.status < 500) break
    await new Promise((resolve) => setTimeout(resolve, 120 * attempt))
  }
  throw lastErr || new Error('edge PATCH failed')
}

async function loadItems() {
  // Siempre leer de Edge Config para no servir datos viejos entre instancias
  const items = await readEdge()
  memory = { items, updatedAt: Date.now() }
  return items
}

async function saveItems(items) {
  memory = { items, updatedAt: Date.now() }
  await writeEdge(items)
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

/** Compat: algunos scripts antiguos importaban STORE */
export const STORE = ''

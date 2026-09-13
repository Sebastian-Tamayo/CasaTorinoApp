/**
 * Casa Torino TPV — sync de mesas entre dispositivos.
 * GET  /api/tpv-sync  → estado actual
 * POST /api/tpv-sync  → guarda estado (body JSON)
 *
 * Persistencia: Vercel Edge Config (compartido entre instancias).
 * Caché en memoria para lecturas inmediatas tras un write.
 */

const EDGE_ID = process.env.TPV_EDGE_CONFIG_ID
const TEAM_ID = process.env.TPV_TEAM_ID
const VERCEL_TOKEN = process.env.TPV_VERCEL_TOKEN
const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'tpv'

/** @type {null | { tables: object, mesa: string, updatedAt: number, clientId?: string }} */
let memory = null

function cors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Tpv-Key, Cache-Control'
  )
  res.setHeader('Cache-Control', 'no-store')
}

function emptyState() {
  return { tables: {}, mesa: '', updatedAt: 0, clientId: null }
}

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
}

function authorized(req) {
  // GET/OPTIONS públicos (solo lectura del estado de mesas)
  if (req.method === 'GET' || req.method === 'OPTIONS') return true
  // POST: cookie de sesión tras PIN, o clave de servidor (no se documenta en el cliente)
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  return Boolean(SYNC_KEY && key && key === SYNC_KEY)
}

async function readEdge() {
  if (!EDGE_ID || !VERCEL_TOKEN) return null
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/item/${ITEM_KEY}` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    cache: 'no-store',
  })
  if (r.status === 404) return emptyState()
  if (!r.ok) throw new Error('edge GET ' + r.status)
  const data = await r.json()
  // API may return the value directly or wrapped
  if (data && typeof data === 'object' && 'value' in data && data.key === ITEM_KEY) {
    return data.value || emptyState()
  }
  return data && typeof data === 'object' ? data : emptyState()
}

async function writeEdge(state) {
  if (!EDGE_ID || !VERCEL_TOKEN) {
    throw new Error('missing Edge Config env')
  }
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/items` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ operation: 'upsert', key: ITEM_KEY, value: state }],
    }),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error('edge PATCH ' + r.status + ' ' + text.slice(0, 200))
  }
}

async function getState() {
  if (memory && memory.updatedAt) return memory
  try {
    const remote = await readEdge()
    if (remote && Number(remote.updatedAt || 0) > 0) {
      memory = remote
      return memory
    }
  } catch (err) {
    console.warn('[tpv-sync] readEdge', err)
  }
  return memory || emptyState()
}

module.exports = async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (!authorized(req)) {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: 'unauthorized' }))
  }

  try {
    if (req.method === 'GET') {
      const state = await getState()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(state))
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {}
      const incomingAt = Number(body.updatedAt || Date.now())
      const current = await getState()
      // Evitar pisar un estado más nuevo (condiciones de carrera)
      if (Number(current.updatedAt || 0) > incomingAt) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(current))
      }
      const next = {
        kind: 'casa-torino-tpv',
        tables: body.tables && typeof body.tables === 'object' ? body.tables : {},
        mesa: typeof body.mesa === 'string' ? body.mesa : '',
        updatedAt: incomingAt,
        clientId: body.clientId || null,
      }
      memory = next
      await writeEdge(next)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(next))
    }

    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[tpv-sync]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }))
  }
}

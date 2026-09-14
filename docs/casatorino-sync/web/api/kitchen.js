/**
 * Casa Torino — Kitchen Display (KDS)
 * Persistencia: Vercel Edge Config (misma que TPV), clave `kitchen`.
 *
 * GET  /api/kitchen  → { orders, history, historyDay, lastCompleted, canUndo, updatedAt }
 * POST /api/kitchen  → { action: 'create'|'complete'|'undo', ... }
 *
 * Histórico del día:
 *   - Cada pedido marcado como Listo entra en `history`
 *   - Día de cocina: 09:00 → 09:00 (Europe/Madrid)
 *   - Al cruzar las 09:00 se vacía automáticamente
 */
const EDGE_ID = process.env.TPV_EDGE_CONFIG_ID
const TEAM_ID = process.env.TPV_TEAM_ID
const VERCEL_TOKEN = process.env.TPV_VERCEL_TOKEN
const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'kitchen'
const HISTORY_MAX = 300

/** @type {null | object} */
let memory = null

function cors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Tpv-Key, Cache-Control',
  )
  res.setHeader('Cache-Control', 'no-store')
}

/** Día de cocina: de 09:00 a 09:00 (Europe/Madrid). */
function kitchenDayId(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    fmt
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  let y = Number(parts.year)
  let m = Number(parts.month)
  let d = Number(parts.day)
  const hour = Number(parts.hour)
  if (hour < 9) {
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    y = dt.getUTCFullYear()
    m = dt.getUTCMonth() + 1
    d = dt.getUTCDate()
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function emptyState() {
  return {
    orders: [],
    lastCompleted: null,
    history: [],
    historyDay: kitchenDayId(),
    updatedAt: 0,
  }
}

function applyDayRollover(state) {
  const day = kitchenDayId()
  const historyDay = state.historyDay || day
  const history = Array.isArray(state.history) ? state.history : []
  if (historyDay !== day) {
    return {
      ...state,
      history: [],
      historyDay: day,
      updatedAt: Date.now(),
      _rolled: true,
    }
  }
  return {
    ...state,
    history,
    historyDay: day,
    _rolled: false,
  }
}

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
}

function authorized(req) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return true
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  return Boolean(SYNC_KEY && key && key === SYNC_KEY)
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body
}

async function readEdge() {
  if (!EDGE_ID || !VERCEL_TOKEN) return emptyState()
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/item/${ITEM_KEY}` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    cache: 'no-store',
  })
  if (r.status === 404 || r.status === 204) return emptyState()
  if (!r.ok) throw new Error('edge GET ' + r.status)
  const text = await r.text()
  if (!text || !text.trim()) return emptyState()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return emptyState()
  }
  const value =
    data && typeof data === 'object' && 'value' in data && data.key === ITEM_KEY
      ? data.value
      : data
  if (!value || typeof value !== 'object') return emptyState()
  return applyDayRollover({
    orders: Array.isArray(value.orders) ? value.orders : [],
    lastCompleted: value.lastCompleted || null,
    history: Array.isArray(value.history) ? value.history : [],
    historyDay: value.historyDay || kitchenDayId(),
    updatedAt: Number(value.updatedAt || 0),
  })
}

async function writeEdge(state) {
  if (!EDGE_ID || !VERCEL_TOKEN) throw new Error('missing Edge Config env')
  const payload = {
    orders: state.orders || [],
    lastCompleted: state.lastCompleted || null,
    history: state.history || [],
    historyDay: state.historyDay || kitchenDayId(),
    updatedAt: state.updatedAt || Date.now(),
  }
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/items` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ operation: 'upsert', key: ITEM_KEY, value: payload }],
      }),
    })
    if (r.ok) return
    const text = await r.text().catch(() => '')
    lastErr = new Error('edge PATCH ' + r.status + ' ' + text.slice(0, 180))
    if (r.status !== 409 && r.status !== 429 && r.status < 500) break
    await new Promise((resolve) => setTimeout(resolve, 100 * attempt))
  }
  throw lastErr || new Error('edge PATCH failed')
}

async function loadFresh() {
  const remote = await readEdge()
  if (remote._rolled) {
    const next = { ...remote }
    delete next._rolled
    memory = next
    try {
      await writeEdge(next)
    } catch (err) {
      console.warn('[kitchen] rollover persist', err)
    }
    return next
  }
  delete remote._rolled
  memory = remote
  return remote
}

function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((it) => {
      const name = String(it?.name || '').trim()
      if (!name) return false
      const t = String(it?.categoryType || '').trim().toLowerCase()
      const catId = String(it?.catId || '').trim().toLowerCase()
      if (t === 'bebida' || t === 'drink' || catId === 'bebidas') return false
      return true
    })
    .map((it) => ({
      id: String(it.id || ''),
      name: String(it.name || '').trim(),
      qty: Math.max(1, Math.min(99, Number(it.qty) || 1)),
      categoryType: 'comida',
      catId: String(it.catId || ''),
      note: String(it.note || '').trim(),
    }))
}

function publicPayload(state) {
  const pending = (state.orders || []).filter(
    (o) => o && o.status === 'pending_kitchen',
  )
  const history = Array.isArray(state.history) ? state.history : []
  return {
    orders: pending,
    history,
    historyDay: state.historyDay || kitchenDayId(),
    historyCount: history.length,
    lastCompleted: state.lastCompleted || null,
    updatedAt: state.updatedAt || 0,
    canUndo: Boolean(state.lastCompleted),
    purgeAt: '09:00 Europe/Madrid',
  }
}

function pushHistory(history, order) {
  const next = [order, ...(history || []).filter((h) => h && h.id !== order.id)]
  return next.slice(0, HISTORY_MAX)
}

function removeFromHistory(history, id) {
  return (history || []).filter((h) => h && h.id !== id)
}

module.exports = async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'unauthorized' }))
  }

  try {
    if (req.method === 'GET') {
      const state = await loadFresh()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(publicPayload(state)))
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      const action = String(body.action || '').trim()
      const state = await loadFresh()
      let orders = Array.isArray(state.orders) ? state.orders.slice() : []
      let lastCompleted = state.lastCompleted || null
      let history = Array.isArray(state.history) ? state.history.slice() : []
      const historyDay = state.historyDay || kitchenDayId()

      if (action === 'create') {
        const incoming = body.order || body
        const items = sanitizeItems(incoming.items)
        if (!items.length) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ error: 'Sin productos de comida para cocina' }),
          )
        }
        const mesa = String(incoming.mesa || '').trim()
        if (!mesa) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Falta mesa' }))
        }
        const now = new Date().toISOString()
        const order = {
          id:
            String(incoming.id || '').trim() ||
            `k-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          mesa,
          status: 'pending_kitchen',
          createdAt: now,
          completedAt: null,
          notes: String(incoming.notes || '').trim(),
          items,
        }
        orders = [order, ...orders].slice(0, 80)
        const next = {
          orders,
          lastCompleted,
          history,
          historyDay,
          updatedAt: Date.now(),
        }
        memory = next
        await writeEdge(next)
        res.statusCode = 201
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, order, ...publicPayload(next) }))
      }

      if (action === 'complete') {
        const id = String(body.id || '').trim()
        const idx = orders.findIndex((o) => o && o.id === id)
        if (idx < 0) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Pedido no encontrado' }))
        }
        const done = {
          ...orders[idx],
          status: 'ready',
          completedAt: new Date().toISOString(),
        }
        orders.splice(idx, 1)
        lastCompleted = done
        history = pushHistory(history, done)
        const next = {
          orders,
          lastCompleted,
          history,
          historyDay,
          updatedAt: Date.now(),
        }
        memory = next
        await writeEdge(next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({ ok: true, order: done, ...publicPayload(next) }),
        )
      }

      if (action === 'undo') {
        if (!lastCompleted || lastCompleted.status !== 'ready') {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Nada que deshacer' }))
        }
        const restored = {
          ...lastCompleted,
          status: 'pending_kitchen',
          completedAt: null,
          restoredAt: new Date().toISOString(),
        }
        orders = orders.filter((o) => o.id !== restored.id)
        orders = [restored, ...orders]
        history = removeFromHistory(history, restored.id)
        lastCompleted = null
        const next = {
          orders,
          lastCompleted,
          history,
          historyDay,
          updatedAt: Date.now(),
        }
        memory = next
        await writeEdge(next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({ ok: true, order: restored, ...publicPayload(next) }),
        )
      }

      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'action inválida' }))
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[kitchen]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: String(err && err.message ? err.message : err),
      }),
    )
  }
}

/**
 * Casa Torino TPV — Jornada / sesión de caja
 * Persistencia: Vercel Edge Config (misma que TPV), clave `jornada`.
 *
 * GET  /api/tpv-jornada → estado actual + totales
 * POST /api/tpv-jornada → { action: 'start'|'end'|'sale'|'reset' }
 *
 * - start: abre jornada (limpia ventas previas)
 * - end: cierra sesión y congela totales
 * - sale: registra un cobro (solo si status === 'open')
 * - reset: borra jornada (tras confirmación en cliente)
 */
const EDGE_ID = process.env.TPV_EDGE_CONFIG_ID
const TEAM_ID = process.env.TPV_TEAM_ID
const VERCEL_TOKEN = process.env.TPV_VERCEL_TOKEN
const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'jornada'
const SALES_MAX = 500

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

function emptyState() {
  return {
    kind: 'casa-torino-jornada',
    status: 'closed', // closed | open | ended
    startedAt: null,
    endedAt: null,
    sales: [],
    updatedAt: 0,
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
    if (remote && typeof remote === 'object') {
      memory = {
        ...emptyState(),
        ...remote,
        sales: Array.isArray(remote.sales) ? remote.sales : [],
      }
      return memory
    }
  } catch (err) {
    console.warn('[tpv-jornada] readEdge', err)
  }
  return memory || emptyState()
}

function round2(n) {
  return Math.round((+n + Number.EPSILON) * 100) / 100
}

function normalizeSale(raw) {
  if (!raw || typeof raw !== 'object') return null
  const linesIn = Array.isArray(raw.lines) ? raw.lines : []
  const lines = linesIn
    .map((l) => {
      if (!l || typeof l !== 'object') return null
      const qty = Math.max(0, Number(l.qty) || 0)
      const price = Number(l.price) || 0
      if (!qty || !Number.isFinite(price)) return null
      const categoryType =
        l.categoryType === 'bebida' || l.categoryType === 'comida'
          ? l.categoryType
          : l.catId === 'bebidas'
            ? 'bebida'
            : 'comida'
      return {
        id: String(l.id || '').slice(0, 80),
        name: String(l.name || 'Producto').slice(0, 120),
        qty,
        price: round2(price),
        categoryType,
        catId: String(l.catId || '').slice(0, 40),
        catName: String(l.catName || '').slice(0, 60),
      }
    })
    .filter(Boolean)

  if (!lines.length) return null
  const total = round2(
    Number.isFinite(Number(raw.total))
      ? Number(raw.total)
      : lines.reduce((a, l) => a + l.qty * l.price, 0),
  )
  return {
    id:
      String(raw.id || '').slice(0, 64) ||
      's-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8),
    at: Number(raw.at) || Date.now(),
    mesa: String(raw.mesa || '').slice(0, 8),
    total,
    base: Number.isFinite(Number(raw.base)) ? round2(Number(raw.base)) : undefined,
    iva: Number.isFinite(Number(raw.iva)) ? round2(Number(raw.iva)) : undefined,
    lines,
  }
}

function buildTotals(state) {
  const sales = Array.isArray(state.sales) ? state.sales : []
  const byType = {
    comida: { qty: 0, total: 0 },
    bebida: { qty: 0, total: 0 },
  }
  const byCategory = {}
  const byProduct = {}
  let tickets = 0
  let grand = 0

  for (const sale of sales) {
    tickets += 1
    grand = round2(grand + (Number(sale.total) || 0))
    for (const l of sale.lines || []) {
      const ctype = l.categoryType === 'bebida' ? 'bebida' : 'comida'
      const lineTotal = round2((Number(l.qty) || 0) * (Number(l.price) || 0))
      byType[ctype].qty += Number(l.qty) || 0
      byType[ctype].total = round2(byType[ctype].total + lineTotal)

      const catKey = l.catId || (ctype === 'bebida' ? 'bebidas' : 'otros')
      const catName = l.catName || catKey
      if (!byCategory[catKey]) {
        byCategory[catKey] = { id: catKey, name: catName, qty: 0, total: 0, categoryType: ctype }
      }
      byCategory[catKey].qty += Number(l.qty) || 0
      byCategory[catKey].total = round2(byCategory[catKey].total + lineTotal)

      const pKey = l.id || l.name
      if (!byProduct[pKey]) {
        byProduct[pKey] = {
          id: l.id || pKey,
          name: l.name,
          qty: 0,
          total: 0,
          categoryType: ctype,
          catId: catKey,
        }
      }
      byProduct[pKey].qty += Number(l.qty) || 0
      byProduct[pKey].total = round2(byProduct[pKey].total + lineTotal)
    }
  }

  return {
    tickets,
    total: grand,
    byType,
    byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    byProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
  }
}

function withTotals(state) {
  return { ...state, totals: buildTotals(state) }
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
      const state = await getState()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(withTotals(state)))
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {}
      const action = String(body.action || '').toLowerCase()
      let state = await getState()
      const now = Date.now()

      if (action === 'start') {
        if (state.status === 'open') {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              error: 'Ya hay una jornada abierta',
              ...withTotals(state),
            }),
          )
        }
        state = {
          kind: 'casa-torino-jornada',
          status: 'open',
          startedAt: now,
          endedAt: null,
          sales: [],
          updatedAt: now,
        }
      } else if (action === 'end') {
        if (state.status !== 'open') {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              error: 'No hay jornada abierta para cerrar',
              ...withTotals(state),
            }),
          )
        }
        state = {
          ...state,
          status: 'ended',
          endedAt: now,
          updatedAt: now,
          sales: Array.isArray(state.sales) ? state.sales : [],
        }
      } else if (action === 'sale') {
        if (state.status !== 'open') {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              error: 'Abre la jornada antes de registrar cobros',
              ...withTotals(state),
            }),
          )
        }
        const sale = normalizeSale(body.sale)
        if (!sale) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'sale inválida' }))
        }
        const sales = Array.isArray(state.sales) ? state.sales.slice() : []
        if (!sales.some((s) => s && s.id === sale.id)) {
          sales.push(sale)
        }
        while (sales.length > SALES_MAX) sales.shift()
        state = {
          ...state,
          sales,
          updatedAt: now,
        }
      } else if (action === 'reset') {
        state = { ...emptyState(), updatedAt: now }
      } else {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'action inválida' }))
      }

      memory = state
      await writeEdge(state)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(withTotals(state)))
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[tpv-jornada]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: String(err && err.message ? err.message : err),
      }),
    )
  }
}

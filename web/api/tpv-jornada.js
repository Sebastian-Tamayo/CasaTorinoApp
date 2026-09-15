/**
 * Casa Torino TPV — Jornada / sesión de caja
 * Persistencia: Vercel Edge Config (misma que TPV), clave `jornada`.
 *
 * GET  /api/tpv-jornada → estado actual + totales
 * POST /api/tpv-jornada → { action: 'start'|'end'|'sale'|'updateSale'|'updateLine'|'deleteSale'|'reset' }
 *
 * - start: abre jornada (limpia ventas previas)
 * - end: cierra sesión y congela totales
 * - sale: registra un cobro (solo si status === 'open')
 * - updateSale / updateLine / deleteSale: corregir errores (open u ended)
 * - reset: borra jornada (tras confirmación en cliente)
 */
const EDGE_ID = process.env.TPV_EDGE_CONFIG_ID
const TEAM_ID = process.env.TPV_TEAM_ID
const VERCEL_TOKEN = process.env.TPV_VERCEL_TOKEN
const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'jornada'
const SALES_MAX = 500
const { getJson, setJson, updateJson } = require('./_opsStore')

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
  return getJson(ITEM_KEY, emptyState, { fresh: true })
}

async function writeEdge(state) {
  await setJson(ITEM_KEY, state)
}

function madridMonthDay(ts) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    fmt
      .formatToParts(new Date(ts))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    monthKey: `${parts.year}-${parts.month}`,
  }
}

/** Archiva / actualiza el cierre en Blob `cierres` para el ERP. */
async function archiveToCierres(stateWithTotals) {
  const startedAt = Number(stateWithTotals.startedAt) || null
  const endedAt = Number(stateWithTotals.endedAt) || Date.now()
  const { dayKey, monthKey } = madridMonthDay(endedAt)
  const totals = stateWithTotals.totals || buildTotals(stateWithTotals)
  const cierre = {
    id: `cierre-${startedAt || endedAt}`,
    source: 'tpv',
    startedAt,
    endedAt,
    dayKey,
    monthKey,
    totals,
    salesCount: Array.isArray(stateWithTotals.sales)
      ? stateWithTotals.sales.length
      : 0,
    salesPreview: Array.isArray(stateWithTotals.sales)
      ? stateWithTotals.sales.slice(-30).map((s) => ({
          id: s.id,
          at: s.at,
          mesa: s.mesa,
          total: s.total,
        }))
      : [],
    updatedAt: Date.now(),
  }

  await updateJson(
    'cierres',
    () => ({ kind: 'casa-torino-cierres', items: [], updatedAt: 0 }),
    (store) => {
      let items = Array.isArray(store.items) ? store.items.slice() : []
      const idx = items.findIndex((c) => c && c.id === cierre.id)
      if (idx >= 0) items[idx] = cierre
      else items.push(cierre)
      items.sort((a, b) => (Number(b.endedAt) || 0) - (Number(a.endedAt) || 0))
      while (items.length > 400) items.pop()
      return {
        kind: 'casa-torino-cierres',
        items,
        updatedAt: Date.now(),
      }
    },
  )
  return cierre
}

/** Alinea histórico KDS con inicio/fin de jornada (RMW, no pisa pedidos vivos). */
async function syncKitchenJornada(phase, state) {
  try {
    const jId = `j-${state.startedAt || Date.now()}`
    await updateJson(
      'kitchen',
      () => ({
        orders: [],
        lastCompleted: null,
        history: [],
        historyDay: null,
        jornadaId: null,
        jornadaStartedAt: null,
        updatedAt: 0,
      }),
      (kitchen) => {
        if (!Array.isArray(kitchen.orders)) kitchen.orders = []
        if (!Array.isArray(kitchen.history)) kitchen.history = []
        if (phase === 'start') {
          kitchen.history = []
          kitchen.lastCompleted = null
          kitchen.historyDay = new Date(state.startedAt || Date.now())
            .toISOString()
            .slice(0, 10)
          kitchen.jornadaId = jId
          kitchen.jornadaStartedAt = Number(state.startedAt) || Date.now()
        } else if (phase === 'end') {
          kitchen.jornadaId = jId
          kitchen.historyDay =
            kitchen.historyDay || new Date().toISOString().slice(0, 10)
        }
        kitchen.updatedAt = Date.now()
        return kitchen
      },
    )
  } catch (err) {
    console.warn('[tpv-jornada] syncKitchen', err)
  }
}

async function getState() {
  try {
    const remote = await readEdge()
    if (remote && typeof remote === 'object') {
      return {
        ...emptyState(),
        ...remote,
        sales: Array.isArray(remote.sales) ? remote.sales : [],
      }
    }
  } catch (err) {
    console.warn('[tpv-jornada] readEdge', err)
  }
  return emptyState()
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
      const catId = String(l.catId || '')
      const categoryType =
        catId === 'bebidas' || catId === 'cafes' || catId === 'postres' || catId === 'extras'
          ? 'bebida'
          : l.categoryType === 'bebida' || l.categoryType === 'comida'
            ? l.categoryType
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
        await syncKitchenJornada('start', state)
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
        await syncKitchenJornada('end', state)
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
      } else if (action === 'updatesale' || action === 'update_sale') {
        // Corrección al final del día: permitir editar con jornada abierta O cerrada
        if (state.status !== 'open' && state.status !== 'ended') {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              error: 'No hay jornada para corregir',
              ...withTotals(state),
            }),
          )
        }
        const sale = normalizeSale(body.sale)
        if (!sale || !sale.id) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'sale inválida' }))
        }
        const sales = Array.isArray(state.sales) ? state.sales.slice() : []
        const idx = sales.findIndex((s) => s && s.id === sale.id)
        if (idx < 0) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ error: 'Ticket no encontrado', ...withTotals(state) }),
          )
        }
        // Conservar hora original del ticket si no viene
        sale.at = Number(body.sale?.at) || sales[idx].at || sale.at
        sales[idx] = sale
        state = { ...state, sales, updatedAt: now }
      } else if (action === 'deletesale' || action === 'delete_sale') {
        if (state.status !== 'open' && state.status !== 'ended') {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              error: 'No hay jornada para corregir',
              ...withTotals(state),
            }),
          )
        }
        const saleId = String(body.saleId || body.id || '').slice(0, 64)
        if (!saleId) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'saleId requerido' }))
        }
        const sales = (Array.isArray(state.sales) ? state.sales : []).filter(
          (s) => s && s.id !== saleId,
        )
        state = { ...state, sales, updatedAt: now }
      } else if (action === 'updateline' || action === 'update_line') {
        // Cambiar cantidad/precio de un producto dentro de un ticket
        if (state.status !== 'open' && state.status !== 'ended') {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              error: 'No hay jornada para corregir',
              ...withTotals(state),
            }),
          )
        }
        const saleId = String(body.saleId || '').slice(0, 64)
        const lineId = String(body.lineId || body.productId || '').slice(0, 80)
        if (!saleId || !lineId) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'saleId y lineId requeridos' }))
        }
        const sales = Array.isArray(state.sales) ? state.sales.slice() : []
        const idx = sales.findIndex((s) => s && s.id === saleId)
        if (idx < 0) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ error: 'Ticket no encontrado', ...withTotals(state) }),
          )
        }
        const sale = { ...sales[idx], lines: (sales[idx].lines || []).slice() }
        const li = sale.lines.findIndex((l) => l && l.id === lineId)
        if (li < 0) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ error: 'Producto no encontrado en el ticket', ...withTotals(state) }),
          )
        }
        const hasQty = body.qty !== undefined && body.qty !== null && body.qty !== ''
        const hasPrice = body.price !== undefined && body.price !== null && body.price !== ''
        let qty = hasQty ? Number(body.qty) : Number(sale.lines[li].qty)
        let price = hasPrice ? Number(body.price) : Number(sale.lines[li].price)
        if (!Number.isFinite(qty) || qty < 0) qty = 0
        if (!Number.isFinite(price) || price < 0) price = 0
        if (qty <= 0) {
          sale.lines.splice(li, 1)
        } else {
          sale.lines[li] = {
            ...sale.lines[li],
            qty: Math.round(qty),
            price: round2(price),
          }
        }
        if (!sale.lines.length) {
          sales.splice(idx, 1)
        } else {
          sale.total = round2(sale.lines.reduce((a, l) => a + l.qty * l.price, 0))
          // Recalcular base/IVA 10% hostelería
          sale.base = round2(sale.total / 1.1)
          sale.iva = round2(sale.total - sale.base)
          sales[idx] = sale
        }
        state = { ...state, sales, updatedAt: now }
      } else if (action === 'reset') {
        state = { ...emptyState(), updatedAt: now }
      } else {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'action inválida' }))
      }

      await writeEdge(state)

      // Si la jornada está cerrada (fin de sesión o corrección), sincronizar al historial ERP
      let cierre = null
      if (state.status === 'ended') {
        try {
          const full = withTotals(state)
          cierre = await archiveToCierres(full)
        } catch (err) {
          console.warn('[tpv-jornada] archive', err)
        }
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ...withTotals(state), cierre }))
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

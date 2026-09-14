/**
 * Casa Torino — Historial de cierres de jornada (TPV → ERP)
 * Persistencia: Vercel Blob (opsStore), clave `cierres`.
 */
const { getJson, setJson } = require('./_opsStore')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'cierres'
const MAX_CIERRES = 400

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
  return { kind: 'casa-torino-cierres', items: [], updatedAt: 0 }
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

function madridParts(ts = Date.now()) {
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

function round2(n) {
  return Math.round((+n + Number.EPSILON) * 100) / 100
}

function buildMonthTotals(items) {
  let total = 0
  let tickets = 0
  let comida = 0
  let bebida = 0
  const byDay = {}
  for (const c of items) {
    const t = Number(c?.totals?.total) || 0
    total = round2(total + t)
    tickets += Number(c?.totals?.tickets) || 0
    comida = round2(comida + (Number(c?.totals?.byType?.comida?.total) || 0))
    bebida = round2(bebida + (Number(c?.totals?.byType?.bebida?.total) || 0))
    const day = c.dayKey || '—'
    if (!byDay[day]) byDay[day] = { dayKey: day, total: 0, tickets: 0, cierres: 0 }
    byDay[day].total = round2(byDay[day].total + t)
    byDay[day].tickets += Number(c?.totals?.tickets) || 0
    byDay[day].cierres += 1
  }
  return {
    total,
    tickets,
    byType: { comida: { total: comida }, bebida: { total: bebida } },
    byDay: Object.values(byDay).sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1)),
  }
}

function normalizeCierre(raw) {
  if (!raw || typeof raw !== 'object') return null
  const startedAt = Number(raw.startedAt) || null
  const endedAt = Number(raw.endedAt) || Date.now()
  const { dayKey, monthKey } = madridParts(endedAt)
  const id =
    String(raw.id || '').slice(0, 80) ||
    `cierre-${startedAt || endedAt}-${endedAt}`
  const totals = raw.totals && typeof raw.totals === 'object' ? raw.totals : {}
  return {
    id,
    source: 'tpv',
    startedAt,
    endedAt,
    dayKey: raw.dayKey || dayKey,
    monthKey: raw.monthKey || monthKey,
    totals: {
      tickets: Number(totals.tickets) || 0,
      total: round2(Number(totals.total) || 0),
      byType: totals.byType || {
        comida: { qty: 0, total: 0 },
        bebida: { qty: 0, total: 0 },
      },
      byCategory: Array.isArray(totals.byCategory) ? totals.byCategory : [],
      byProduct: Array.isArray(totals.byProduct) ? totals.byProduct : [],
    },
    salesCount: Array.isArray(raw.sales)
      ? raw.sales.length
      : Number(raw.salesCount) || 0,
    salesPreview: Array.isArray(raw.sales)
      ? raw.sales.slice(-30).map((s) => ({
          id: s.id,
          at: s.at,
          mesa: s.mesa,
          total: s.total,
        }))
      : Array.isArray(raw.salesPreview)
        ? raw.salesPreview
        : [],
    updatedAt: Date.now(),
  }
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
      const state = (await getJson(ITEM_KEY, emptyState)) || emptyState()
      const month = String(req.query?.month || '').trim()
      let items = Array.isArray(state.items) ? state.items.slice() : []
      items.sort((a, b) => (Number(b.endedAt) || 0) - (Number(a.endedAt) || 0))
      if (month) items = items.filter((c) => c.monthKey === month)
      const months = [
        ...new Set(
          (Array.isArray(state.items) ? state.items : [])
            .map((c) => c.monthKey)
            .filter(Boolean),
        ),
      ].sort((a, b) => (a < b ? 1 : -1))
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          kind: 'casa-torino-cierres',
          month: month || null,
          months,
          items,
          monthTotals: buildMonthTotals(items),
          updatedAt: state.updatedAt || 0,
        }),
      )
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {}
      const action = String(body.action || 'upsert').toLowerCase()
      const state = (await getJson(ITEM_KEY, emptyState)) || emptyState()
      const items = Array.isArray(state.items) ? state.items.slice() : []

      if (action === 'upsert') {
        const cierre = normalizeCierre(body.cierre)
        if (!cierre) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'cierre inválido' }))
        }
        const idx = items.findIndex((c) => c && c.id === cierre.id)
        if (idx >= 0) items[idx] = cierre
        else items.push(cierre)
        items.sort((a, b) => (Number(b.endedAt) || 0) - (Number(a.endedAt) || 0))
        while (items.length > MAX_CIERRES) items.pop()
        const next = { kind: 'casa-torino-cierres', items, updatedAt: Date.now() }
        await setJson(ITEM_KEY, next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(next))
      }

      if (action === 'delete') {
        const id = String(body.id || body.cierreId || '')
        const next = {
          kind: 'casa-torino-cierres',
          items: items.filter((c) => c && c.id !== id),
          updatedAt: Date.now(),
        }
        await setJson(ITEM_KEY, next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(next))
      }

      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'action inválida' }))
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[tpv-cierres]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({ error: String(err && err.message ? err.message : err) }),
    )
  }
}

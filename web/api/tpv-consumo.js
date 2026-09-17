/**
 * Casa Torino — Histórico mensual de consumo (TPV + cocina)
 * GET  /api/tpv-consumo?month=YYYY-MM
 * POST /api/tpv-consumo { action, ... }
 *
 * Acciones: updateDay | updateLine | deleteSale | setManualTotal | syncLive
 */
const { getJson, setJson } = require('./_opsStore')
const { businessDayId, monthKeyFromDay } = require('./_opsDay')
const { ensureMorningRollover } = require('./_opsRollover')
const {
  ITEM_KEY,
  emptyState,
  emptyDay,
  buildTotals,
  buildMonthTotals,
  dayEffectiveTotal,
  upsertFromJornada,
  round2,
} = require('./_opsConsumo')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''

function cors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Tpv-Key, X-Erp-Pin, Cache-Control',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
}

function authorized(req) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return true
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  if (SYNC_KEY && key && key === SYNC_KEY) return true
  // Escritura desde ERP (mismo PIN de gestión)
  const pin = String(req.headers['x-erp-pin'] || '').trim()
  const expected = String(
    process.env.ERP_PIN || process.env.TPV_PIN || '',
  ).trim()
  if (expected && pin && pin === expected) return true
  return false
}

function listDays(store, month) {
  const days = store.days && typeof store.days === 'object' ? store.days : {}
  let list = Object.values(days).filter(Boolean)
  if (month) list = list.filter((d) => d.monthKey === month)
  list.sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
  return list
}

async function syncLiveJornadaIntoConsumo() {
  const jornada = await getJson('jornada', null, { fresh: true })
  if (!jornada || typeof jornada !== 'object') return null
  if (jornada.status !== 'open' && jornada.status !== 'ended') return null
  return upsertFromJornada({
    ...jornada,
    totals: buildTotals(jornada.sales || []),
  })
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
    await ensureMorningRollover()

    if (req.method === 'GET') {
      // Incorporar cobros en vivo del TPV al histórico del día
      try {
        await syncLiveJornadaIntoConsumo()
      } catch (err) {
        console.warn('[tpv-consumo] syncLive', err)
      }

      const store = (await getJson(ITEM_KEY, emptyState, { fresh: true })) || emptyState()
      const month = String(req.query?.month || '').trim()
      const items = listDays(store, month)
      const months = [
        ...new Set(
          Object.values(store.days || {})
            .map((d) => d && d.monthKey)
            .filter(Boolean),
        ),
      ].sort((a, b) => (a < b ? 1 : -1))

      const liveDay = businessDayId()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          kind: 'casa-torino-consumo',
          month: month || null,
          months,
          liveDay,
          items,
          monthTotals: buildMonthTotals(items),
          updatedAt: store.updatedAt || 0,
        }),
      )
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {}
      const action = String(body.action || '').toLowerCase()
      const store = (await getJson(ITEM_KEY, emptyState, { fresh: true })) || emptyState()
      const days = { ...(store.days || {}) }

      if (action === 'synclive') {
        await syncLiveJornadaIntoConsumo()
        const next = (await getJson(ITEM_KEY, emptyState, { fresh: true })) || emptyState()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(next))
      }

      if (action === 'setmanualtotal' || action === 'set_manual_total') {
        const dayKey = String(body.dayKey || '').slice(0, 12)
        if (!dayKey) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'dayKey requerido' }))
        }
        const day = days[dayKey] || emptyDay(dayKey)
        const raw = body.manualTotal
        day.manualTotal =
          raw === null || raw === '' || raw === undefined
            ? null
            : round2(Number(raw))
        if (body.notes != null) day.notes = String(body.notes).slice(0, 500)
        day.updatedAt = Date.now()
        days[dayKey] = day
        const next = {
          kind: 'casa-torino-consumo',
          days,
          lastBusinessDay: store.lastBusinessDay || null,
          updatedAt: Date.now(),
        }
        await setJson(ITEM_KEY, next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, day, monthTotals: buildMonthTotals(listDays(next, day.monthKey)) }))
      }

      if (action === 'updateday' || action === 'update_day') {
        const dayKey = String(body.dayKey || body.day?.dayKey || '').slice(0, 12)
        if (!dayKey) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'dayKey requerido' }))
        }
        const incoming = body.day && typeof body.day === 'object' ? body.day : body
        const prev = days[dayKey] || emptyDay(dayKey)
        const sales = Array.isArray(incoming.sales) ? incoming.sales : prev.sales
        const totals = buildTotals(sales)
        const day = {
          ...prev,
          ...incoming,
          dayKey,
          monthKey: monthKeyFromDay(dayKey),
          sales,
          totals,
          kitchen: incoming.kitchen || prev.kitchen,
          manualTotal:
            incoming.manualTotal !== undefined
              ? incoming.manualTotal == null
                ? null
                : round2(Number(incoming.manualTotal))
              : prev.manualTotal,
          updatedAt: Date.now(),
        }
        days[dayKey] = day
        const next = {
          kind: 'casa-torino-consumo',
          days,
          lastBusinessDay: store.lastBusinessDay || null,
          updatedAt: Date.now(),
        }
        await setJson(ITEM_KEY, next)

        // Si es el día vivo, reflejar ventas en la jornada TPV
        const liveDay = businessDayId()
        if (dayKey === liveDay) {
          try {
            const jornada = (await getJson('jornada', null, { fresh: true })) || {}
            if (jornada.status === 'open' || jornada.status === 'ended') {
              await setJson('jornada', {
                ...jornada,
                sales,
                businessDay: liveDay,
                updatedAt: Date.now(),
              })
            }
          } catch (err) {
            console.warn('[tpv-consumo] mirror jornada', err)
          }
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, day }))
      }

      if (action === 'updateline' || action === 'update_line') {
        const dayKey = String(body.dayKey || '').slice(0, 12)
        const saleId = String(body.saleId || '').slice(0, 64)
        const lineId = String(body.lineId || body.productId || '').slice(0, 80)
        if (!dayKey || !saleId || !lineId) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'dayKey, saleId y lineId requeridos' }))
        }
        const day = days[dayKey] || emptyDay(dayKey)
        const sales = Array.isArray(day.sales) ? day.sales.slice() : []
        const idx = sales.findIndex((s) => s && s.id === saleId)
        if (idx < 0) {
          res.statusCode = 404
          return res.end(JSON.stringify({ error: 'Ticket no encontrado' }))
        }
        const sale = { ...sales[idx], lines: (sales[idx].lines || []).slice() }
        const li = sale.lines.findIndex((l) => l && l.id === lineId)
        if (li < 0) {
          res.statusCode = 404
          return res.end(JSON.stringify({ error: 'Producto no encontrado' }))
        }
        const hasQty = body.qty !== undefined && body.qty !== null && body.qty !== ''
        const hasPrice = body.price !== undefined && body.price !== null && body.price !== ''
        let qty = hasQty ? Number(body.qty) : Number(sale.lines[li].qty)
        let price = hasPrice ? Number(body.price) : Number(sale.lines[li].price)
        if (!Number.isFinite(qty) || qty < 0) qty = 0
        if (!Number.isFinite(price) || price < 0) price = 0
        if (qty <= 0) sale.lines.splice(li, 1)
        else {
          sale.lines[li] = {
            ...sale.lines[li],
            qty: Math.round(qty),
            price: round2(price),
          }
        }
        if (!sale.lines.length) sales.splice(idx, 1)
        else {
          sale.total = round2(sale.lines.reduce((a, l) => a + l.qty * l.price, 0))
          sale.base = round2(sale.total / 1.1)
          sale.iva = round2(sale.total - sale.base)
          sales[idx] = sale
        }
        day.sales = sales
        day.totals = buildTotals(sales)
        day.updatedAt = Date.now()
        days[dayKey] = day
        const next = {
          kind: 'casa-torino-consumo',
          days,
          lastBusinessDay: store.lastBusinessDay || null,
          updatedAt: Date.now(),
        }
        await setJson(ITEM_KEY, next)

        const liveDay = businessDayId()
        if (dayKey === liveDay) {
          try {
            const jornada = (await getJson('jornada', null, { fresh: true })) || {}
            if (jornada.status === 'open' || jornada.status === 'ended') {
              await setJson('jornada', {
                ...jornada,
                sales,
                businessDay: liveDay,
                updatedAt: Date.now(),
              })
            }
          } catch (err) {
            console.warn('[tpv-consumo] mirror jornada', err)
          }
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({
            ok: true,
            day,
            effectiveTotal: dayEffectiveTotal(day),
          }),
        )
      }

      if (action === 'deletesale' || action === 'delete_sale') {
        const dayKey = String(body.dayKey || '').slice(0, 12)
        const saleId = String(body.saleId || body.id || '').slice(0, 64)
        if (!dayKey || !saleId) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'dayKey y saleId requeridos' }))
        }
        const day = days[dayKey] || emptyDay(dayKey)
        day.sales = (Array.isArray(day.sales) ? day.sales : []).filter(
          (s) => s && s.id !== saleId,
        )
        day.totals = buildTotals(day.sales)
        day.updatedAt = Date.now()
        days[dayKey] = day
        const next = {
          kind: 'casa-torino-consumo',
          days,
          lastBusinessDay: store.lastBusinessDay || null,
          updatedAt: Date.now(),
        }
        await setJson(ITEM_KEY, next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, day }))
      }

      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'action inválida' }))
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[tpv-consumo]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: String(err && err.message ? err.message : err),
      }),
    )
  }
}

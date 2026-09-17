/**
 * Histórico mensual de consumo / cobros TPV+cocina.
 * Clave ops_kv: `consumo` — no toca el panel TPV.
 */
const { getJson, updateJson } = require('./_opsStore')
const { businessDayId, monthKeyFromDay } = require('./_opsDay')

const ITEM_KEY = 'consumo'
const DAYS_MAX = 400
const SALES_MAX = 500

function emptyState() {
  return {
    kind: 'casa-torino-consumo',
    days: {},
    lastBusinessDay: null,
    updatedAt: 0,
  }
}

function round2(n) {
  return Math.round((+n + Number.EPSILON) * 100) / 100
}

function buildTotals(sales) {
  const list = Array.isArray(sales) ? sales : []
  const byType = {
    comida: { qty: 0, total: 0 },
    bebida: { qty: 0, total: 0 },
  }
  const byCategory = {}
  const byProduct = {}
  let tickets = 0
  let grand = 0

  for (const sale of list) {
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
        byCategory[catKey] = {
          id: catKey,
          name: catName,
          qty: 0,
          total: 0,
          categoryType: ctype,
        }
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

function aggregateKitchen(history) {
  const byItem = {}
  for (const order of history || []) {
    for (const it of order.items || order.menuSecondItems || []) {
      const name = String(it.name || '').trim()
      if (!name) continue
      const key = String(it.id || name)
      if (!byItem[key]) {
        byItem[key] = {
          id: key,
          name,
          qty: 0,
          catId: String(it.catId || ''),
        }
      }
      byItem[key].qty += Math.max(0, Number(it.qty) || 0)
    }
  }
  const items = Object.values(byItem).sort((a, b) => b.qty - a.qty)
  return {
    items,
    ordersCount: Array.isArray(history) ? history.length : 0,
    qtyTotal: items.reduce((a, it) => a + (Number(it.qty) || 0), 0),
  }
}

function emptyDay(dayKey) {
  return {
    dayKey,
    monthKey: monthKeyFromDay(dayKey),
    status: 'live', // live | closed
    startedAt: null,
    endedAt: null,
    sales: [],
    totals: buildTotals([]),
    kitchen: { items: [], ordersCount: 0, qtyTotal: 0 },
    manualTotal: null,
    notes: '',
    updatedAt: 0,
  }
}

function pruneDays(days) {
  const keys = Object.keys(days || {}).sort((a, b) => (a < b ? 1 : -1))
  const next = { ...days }
  while (keys.length > DAYS_MAX) {
    const old = keys.pop()
    delete next[old]
  }
  return next
}

function dayEffectiveTotal(day) {
  if (day && day.manualTotal != null && Number.isFinite(Number(day.manualTotal))) {
    return round2(Number(day.manualTotal))
  }
  return round2(Number(day?.totals?.total) || 0)
}

function buildMonthTotals(dayList) {
  let total = 0
  let tickets = 0
  let comida = 0
  let bebida = 0
  let kitchenQty = 0
  const byDay = []
  for (const d of dayList) {
    const t = dayEffectiveTotal(d)
    total = round2(total + t)
    tickets += Number(d?.totals?.tickets) || 0
    comida = round2(comida + (Number(d?.totals?.byType?.comida?.total) || 0))
    bebida = round2(bebida + (Number(d?.totals?.byType?.bebida?.total) || 0))
    kitchenQty += Number(d?.kitchen?.qtyTotal) || 0
    byDay.push({
      dayKey: d.dayKey,
      total: t,
      tickets: Number(d?.totals?.tickets) || 0,
      status: d.status || 'closed',
      kitchenQty: Number(d?.kitchen?.qtyTotal) || 0,
      manual: d.manualTotal != null,
    })
  }
  byDay.sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
  return {
    total,
    tickets,
    byType: { comida: { total: comida }, bebida: { total: bebida } },
    kitchenQty,
    byDay,
  }
}

/**
 * Escribe/actualiza el día desde el estado de jornada (tiempo real).
 */
async function upsertFromJornada(jornadaState) {
  if (!jornadaState || typeof jornadaState !== 'object') return null
  const sales = Array.isArray(jornadaState.sales) ? jornadaState.sales.slice() : []
  while (sales.length > SALES_MAX) sales.shift()
  const dayKey =
    jornadaState.businessDay ||
    businessDayId(Number(jornadaState.startedAt) || Date.now())
  const totals =
    jornadaState.totals && typeof jornadaState.totals === 'object'
      ? jornadaState.totals
      : buildTotals(sales)
  const status =
    jornadaState.status === 'ended' || jornadaState.status === 'closed'
      ? 'closed'
      : 'live'

  return updateJson(ITEM_KEY, emptyState, (store) => {
    const days = { ...(store.days || {}) }
    const prev = days[dayKey] || emptyDay(dayKey)
    days[dayKey] = {
      ...prev,
      dayKey,
      monthKey: monthKeyFromDay(dayKey),
      status: status === 'closed' ? 'closed' : prev.status === 'closed' && !sales.length ? 'closed' : status,
      startedAt: Number(jornadaState.startedAt) || prev.startedAt,
      endedAt:
        status === 'closed'
          ? Number(jornadaState.endedAt) || Date.now()
          : prev.endedAt,
      sales,
      totals,
      updatedAt: Date.now(),
    }
    return {
      kind: 'casa-torino-consumo',
      days: pruneDays(days),
      lastBusinessDay: store.lastBusinessDay || null,
      updatedAt: Date.now(),
    }
  })
}

/** Archiva histórico de cocina del día (antes del purge 09:00). */
async function upsertKitchenHistory(dayKey, history) {
  const key = dayKey || businessDayId()
  const kitchen = aggregateKitchen(history)
  return updateJson(ITEM_KEY, emptyState, (store) => {
    const days = { ...(store.days || {}) }
    const prev = days[key] || emptyDay(key)
    // Conservar el mayor agregado si ya había datos
    const keepPrev =
      (Number(prev.kitchen?.qtyTotal) || 0) > kitchen.qtyTotal &&
      (!history || !history.length)
    days[key] = {
      ...prev,
      dayKey: key,
      monthKey: monthKeyFromDay(key),
      kitchen: keepPrev ? prev.kitchen : kitchen,
      updatedAt: Date.now(),
    }
    return {
      kind: 'casa-torino-consumo',
      days: pruneDays(days),
      lastBusinessDay: store.lastBusinessDay || null,
      updatedAt: Date.now(),
    }
  })
}

async function markLastBusinessDay(dayKey) {
  return updateJson(ITEM_KEY, emptyState, (store) => ({
    ...store,
    kind: 'casa-torino-consumo',
    days: store.days || {},
    lastBusinessDay: dayKey,
    updatedAt: Date.now(),
  }))
}

async function getConsumoState() {
  return (await getJson(ITEM_KEY, emptyState, { fresh: true })) || emptyState()
}

module.exports = {
  ITEM_KEY,
  emptyState,
  emptyDay,
  buildTotals,
  buildMonthTotals,
  aggregateKitchen,
  dayEffectiveTotal,
  upsertFromJornada,
  upsertKitchenHistory,
  markLastBusinessDay,
  getConsumoState,
  round2,
}

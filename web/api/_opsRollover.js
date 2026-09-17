/**
 * Renovación diaria 09:00 Europe/Madrid:
 * - Archiva jornada + cocina al histórico mensual (`consumo`)
 * - Vacía cocina (histórico, pedidos, avisos)
 * - Resetea mesas TPV
 * - Abre jornada limpia del nuevo día
 *
 * Lazy: se dispara en GET de jornada / kitchen / sync / consumo.
 */
const { getJson, setJson, updateJson } = require('./_opsStore')
const { businessDayId } = require('./_opsDay')
const {
  upsertFromJornada,
  upsertKitchenHistory,
  markLastBusinessDay,
  getConsumoState,
  buildTotals,
} = require('./_opsConsumo')

let rolling = null

function jornadaEmpty(businessDay) {
  const now = Date.now()
  return {
    kind: 'casa-torino-jornada',
    status: 'open',
    startedAt: now,
    endedAt: null,
    businessDay,
    sales: [],
    updatedAt: now,
  }
}

function kitchenEmpty(businessDay, jornadaStartedAt) {
  return {
    orders: [],
    lastCompleted: null,
    history: [],
    historyDay: businessDay,
    jornadaId: `j-${jornadaStartedAt}`,
    jornadaStartedAt,
    pickups: [],
    updatedAt: Date.now(),
  }
}

function tpvEmpty() {
  return {
    kind: 'casa-torino-tpv',
    tables: {},
    mesa: '',
    updatedAt: Date.now(),
    clientId: null,
  }
}

async function archiveCierreFromJornada(state) {
  if (!state || !Array.isArray(state.sales) || !state.sales.length) return null
  const endedAt = Number(state.endedAt) || Date.now()
  const startedAt = Number(state.startedAt) || null
  const dayKey = state.businessDay || businessDayId(endedAt)
  const monthKey = String(dayKey).slice(0, 7)
  const totals = state.totals || buildTotals(state.sales)
  const cierre = {
    id: `cierre-${startedAt || endedAt}`,
    source: 'tpv-rollover',
    startedAt,
    endedAt,
    dayKey,
    monthKey,
    totals,
    salesCount: state.sales.length,
    salesPreview: state.sales.slice(-30).map((s) => ({
      id: s.id,
      at: s.at,
      mesa: s.mesa,
      total: s.total,
    })),
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
      return { kind: 'casa-torino-cierres', items, updatedAt: Date.now() }
    },
  )
  return cierre
}

/**
 * @returns {{ rolled: boolean, businessDay: string, detail?: object }}
 */
async function ensureMorningRollover() {
  const day = businessDayId()
  const consumo = await getConsumoState()
  if (consumo.lastBusinessDay === day) {
    return { rolled: false, businessDay: day }
  }

  // Primera ejecución: solo marca el día, no borra nada operativo
  if (!consumo.lastBusinessDay) {
    await markLastBusinessDay(day)
    return { rolled: false, businessDay: day, seeded: true }
  }

  if (rolling) return rolling

  rolling = (async () => {
    try {
      // Re-check inside lock
      const again = await getConsumoState()
      if (again.lastBusinessDay === day) {
        return { rolled: false, businessDay: day }
      }
      if (!again.lastBusinessDay) {
        await markLastBusinessDay(day)
        return { rolled: false, businessDay: day, seeded: true }
      }

      const prevDay = again.lastBusinessDay || null
      const jornada =
        (await getJson('jornada', null, { fresh: true })) || {
          kind: 'casa-torino-jornada',
          status: 'closed',
          sales: [],
        }
      const kitchen =
        (await getJson('kitchen', null, { fresh: true })) || {
          orders: [],
          history: [],
        }

      const oldDay =
        jornada.businessDay ||
        prevDay ||
        (jornada.startedAt ? businessDayId(jornada.startedAt) : null)

      // 1) Archivar cocina del día que cierra
      if (Array.isArray(kitchen.history) && kitchen.history.length) {
        await upsertKitchenHistory(
          kitchen.historyDay || oldDay || prevDay,
          kitchen.history,
        )
      }

      // 2) Cerrar y archivar jornada si había movimiento
      if (
        (jornada.status === 'open' || jornada.status === 'ended') &&
        Array.isArray(jornada.sales) &&
        jornada.sales.length
      ) {
        const closed = {
          ...jornada,
          status: 'ended',
          endedAt: Number(jornada.endedAt) || Date.now(),
          businessDay: oldDay || jornada.businessDay,
          totals: buildTotals(jornada.sales),
        }
        await upsertFromJornada(closed)
        try {
          await archiveCierreFromJornada(closed)
        } catch (err) {
          console.warn('[rollover] archive cierre', err)
        }
      }

      // 3) Renovar cocina, TPV mesas y jornada
      const fresh = jornadaEmpty(day)
      await setJson('kitchen', kitchenEmpty(day, fresh.startedAt))
      await setJson('tpv', tpvEmpty())
      await setJson('jornada', fresh)
      await markLastBusinessDay(day)

      return {
        rolled: true,
        businessDay: day,
        detail: {
          archivedDay: oldDay,
          newJornadaStartedAt: fresh.startedAt,
        },
      }
    } finally {
      rolling = null
    }
  })()

  return rolling
}

module.exports = {
  ensureMorningRollover,
  jornadaEmpty,
  kitchenEmpty,
  tpvEmpty,
}

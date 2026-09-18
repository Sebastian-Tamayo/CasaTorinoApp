/**
 * Día operativo Casa Torino: 09:00 → 09:00 (Europe/Madrid).
 * Usado por cocina, TPV (mesas) y el cron /api/ops-daily-purge.
 */

function opsDayId(now = new Date()) {
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

/** Vacía histórico + cola de cocina al cruzar las 09:00. */
function applyKitchenDayRollover(state) {
  const day = opsDayId()
  const base =
    state && typeof state === 'object'
      ? state
      : {
          orders: [],
          history: [],
          lastCompleted: null,
          pickups: [],
          historyDay: null,
        }
  const historyDay = base.historyDay || null
  if (historyDay === day) {
    return {
      state: { ...base, historyDay: day },
      changed: false,
      day,
    }
  }
  // Primera vez (sin historyDay): sellar el día sin borrar datos en vivo
  if (!historyDay) {
    return {
      state: { ...base, historyDay: day },
      changed: true,
      day,
    }
  }
  return {
    state: {
      ...base,
      orders: [],
      history: [],
      lastCompleted: null,
      pickups: [],
      historyDay: day,
      updatedAt: Date.now(),
    },
    changed: true,
    day,
  }
}

/** Vacía mesas TPV (cuentas + hist) al cruzar las 09:00. */
function applyTpvDayRollover(state) {
  const day = opsDayId()
  const base =
    state && typeof state === 'object'
      ? state
      : { kind: 'casa-torino-tpv', tables: {}, mesa: '', updatedAt: 0 }
  const opsDay = base.opsDay || null
  if (opsDay === day) {
    return { state: { ...base, opsDay: day }, changed: false, day }
  }
  // Primera vez (sin opsDay): sellar el día actual sin borrar mesas en vivo
  if (!opsDay) {
    return {
      state: { ...base, kind: base.kind || 'casa-torino-tpv', opsDay: day },
      changed: true,
      day,
    }
  }
  return {
    state: {
      kind: 'casa-torino-tpv',
      tables: {},
      mesa: '',
      opsDay: day,
      updatedAt: Date.now(),
      clientId: null,
    },
    changed: true,
    day,
  }
}

module.exports = {
  opsDayId,
  applyKitchenDayRollover,
  applyTpvDayRollover,
}

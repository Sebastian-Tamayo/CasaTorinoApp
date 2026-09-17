/**
 * Día operativo Casa Torino: 09:00 → 09:00 (Europe/Madrid).
 * Antes de las 09:00 sigue contando el día anterior.
 */

function madridParts(ts = Date.now()) {
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
      .formatToParts(new Date(ts))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  }
}

/** Clave de día operativo YYYY-MM-DD (corte 09:00 Madrid). */
function businessDayId(ts = Date.now()) {
  const p = madridParts(ts)
  let y = p.year
  let m = p.month
  let d = p.day
  if (p.hour < 9) {
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    y = dt.getUTCFullYear()
    m = dt.getUTCMonth() + 1
    d = dt.getUTCDate()
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function monthKeyFromDay(dayKey) {
  return String(dayKey || '').slice(0, 7)
}

function calendarDayKey(ts = Date.now()) {
  const p = madridParts(ts)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

module.exports = {
  madridParts,
  businessDayId,
  monthKeyFromDay,
  calendarDayKey,
}

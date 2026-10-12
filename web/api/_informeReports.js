/**
 * Informes semanal / mensual Casa Torino — datos desde ops_kv `cierres`.
 * HTML móvil + envío Resend. Idempotencia en ops_kv `informe-log`.
 */
const { getJson, setJson, updateJson } = require('./_opsStore')
const { opsDayId } = require('./_opsDay')

const REPORT_TO =
  process.env.REPORT_EMAIL_TO || 'cafebartorino@gmail.com'
const REPORT_FROM =
  process.env.REPORT_EMAIL_FROM ||
  'Casa Torino <onboarding@resend.dev>'
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim()
const LOG_KEY = 'informe-log'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function madridParts(ts = Date.now()) {
  const d = ts instanceof Date ? ts : new Date(ts)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    fmt
      .formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    monthKey: `${parts.year}-${parts.month}`,
  }
}

function madridWeekday(ts = Date.now()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
  }).format(ts instanceof Date ? ts : new Date(ts))
}

/** Lunes (lun–dom) Europe/Madrid → dayKey. */
function startOfWeekDayKey(now = new Date()) {
  const { year, month, day } = madridParts(now)
  const noon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const offset = map[madridWeekday(noon)] ?? 0
  const monday = new Date(noon.getTime() - offset * 86400000)
  return madridParts(monday).dayKey
}

function addDaysKey(dayKey, delta) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12, 0, 0))
  return madridParts(dt).dayKey
}

function daysBetweenKeys(fromKey, toKey) {
  const out = []
  let cur = fromKey
  let guard = 0
  while (cur <= toKey && guard < 400) {
    out.push(cur)
    cur = addDaysKey(cur, 1)
    guard += 1
  }
  return out
}

function formatEuro(n) {
  return round2(n).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatQty(qty) {
  const n = Number(qty) || 0
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function weekdayLabelEs(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(noon)
}

/**
 * Ocupación por hora a partir de ventas cobradas.
 * mesas = mesas distintas con ticket en esa hora; tickets = cobros.
 */
function buildActivityByHour(sales) {
  const byHour = {}
  if (!Array.isArray(sales)) return []
  for (const sale of sales) {
    const at = Number(sale?.at) || 0
    if (!at) continue
    const hourStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hour12: false,
    }).format(new Date(at))
    const hour = Number(hourStr)
    if (!Number.isFinite(hour)) continue
    if (!byHour[hour]) {
      byHour[hour] = { hour, tickets: 0, total: 0, mesasSet: new Set() }
    }
    byHour[hour].tickets += 1
    byHour[hour].total = round2(
      byHour[hour].total + (Number(sale.total) || 0),
    )
    const mesa = String(sale.mesa || '').trim()
    if (mesa) byHour[hour].mesasSet.add(mesa)
  }
  return Object.values(byHour)
    .map((h) => ({
      hour: h.hour,
      tickets: h.tickets,
      total: h.total,
      mesas: h.mesasSet.size,
    }))
    .sort((a, b) => a.hour - b.hour)
}

function peakFromActivity(activityByHour) {
  if (!Array.isArray(activityByHour) || !activityByHour.length) return null
  let best = activityByHour[0]
  for (const row of activityByHour) {
    if (row.mesas > best.mesas) best = row
    else if (row.mesas === best.mesas && row.tickets > best.tickets) best = row
  }
  if (!(best.mesas > 0) && !(best.tickets > 0)) return null
  return best
}

function mergeProducts(map, rows) {
  if (!Array.isArray(rows)) return
  for (const row of rows) {
    if (!row) continue
    const qty = Number(row.qty) || 0
    if (!(qty > 0)) continue
    const name = String(row.name || '').trim() || 'Producto'
    const id = String(row.id || name).trim() || name
    let total = Number(row.total)
    if (!Number.isFinite(total)) total = 0
    else total = round2(total)
    const prev = map.get(id)
    if (prev) {
      prev.qty += qty
      prev.total = round2(prev.total + total)
      if (name) prev.name = name
    } else {
      map.set(id, { id, name, qty, total })
    }
  }
}

async function loadCierresItems() {
  const store = await getJson(
    'cierres',
    () => ({ kind: 'casa-torino-cierres', items: [], updatedAt: 0 }),
    { fresh: true },
  )
  return Array.isArray(store?.items) ? store.items : []
}

function emptyDayBucket(dayKey) {
  return {
    dayKey,
    tickets: 0,
    total: 0,
    comida: 0,
    bebida: 0,
    efectivo: 0,
    tarjeta: 0,
    tip: 0,
    activityByHour: [],
    peak: null,
    peakApprox: false,
  }
}

function mergeActivityRows(into, rows) {
  const merged = {}
  for (const row of [...into, ...(rows || [])]) {
    const h = Number(row.hour)
    if (!Number.isFinite(h)) continue
    if (!merged[h]) {
      merged[h] = { hour: h, mesas: 0, tickets: 0, total: 0 }
    }
    merged[h].mesas = Math.max(merged[h].mesas, Number(row.mesas) || 0)
    merged[h].tickets += Number(row.tickets) || 0
    merged[h].total = round2(merged[h].total + (Number(row.total) || 0))
  }
  return Object.values(merged).sort((a, b) => a.hour - b.hour)
}

/**
 * Actividad horaria del cierre: activityByHour oficial, o reconstrucción
 * desde salesPreview (cierres anteriores al deploy).
 */
function activityFromCierre(c) {
  if (Array.isArray(c.activityByHour) && c.activityByHour.length) {
    return { rows: c.activityByHour, approx: false }
  }
  const preview = Array.isArray(c.salesPreview) ? c.salesPreview : []
  if (!preview.length) return { rows: [], approx: false }
  const tickets = Number(c.totals?.tickets) || Number(c.salesCount) || 0
  const approx = tickets > 0 && preview.length < tickets
  return { rows: buildActivityByHour(preview), approx }
}

function foldCierreIntoDay(bucket, c) {
  bucket.tickets += Number(c.totals?.tickets) || Number(c.salesCount) || 0
  bucket.total = round2(bucket.total + (Number(c.totals?.total) || 0))
  bucket.comida = round2(
    bucket.comida + (Number(c.totals?.byType?.comida?.total) || 0),
  )
  bucket.bebida = round2(
    bucket.bebida + (Number(c.totals?.byType?.bebida?.total) || 0),
  )
  bucket.efectivo = round2(
    bucket.efectivo +
      (Number(c.totals?.byPayment?.efectivo?.total) || 0),
  )
  bucket.tarjeta = round2(
    bucket.tarjeta + (Number(c.totals?.byPayment?.tarjeta?.total) || 0),
  )
  bucket.tip = round2(bucket.tip + (Number(c.totals?.tipTotal) || 0))
  const act = activityFromCierre(c)
  if (act.rows.length) {
    bucket.activityByHour = mergeActivityRows(bucket.activityByHour, act.rows)
    bucket.peak = peakFromActivity(bucket.activityByHour)
    if (act.approx) bucket.peakApprox = true
  }
}

/** Totales mínimos desde ventas sueltas (para repartir sáb/dom). */
function totalsFromSales(sales) {
  const byType = { comida: { total: 0 }, bebida: { total: 0 } }
  const byPayment = {
    efectivo: { total: 0, tickets: 0 },
    tarjeta: { total: 0, tickets: 0 },
  }
  let tickets = 0
  let total = 0
  let tip = 0
  const byProduct = []
  const productMap = new Map()
  for (const sale of sales || []) {
    tickets += 1
    const saleTotal = Number(sale.total) || 0
    total = round2(total + saleTotal)
    tip = round2(tip + (Number(sale.tip) || 0))
    const payments = Array.isArray(sale.payments) ? sale.payments : []
    if (payments.length) {
      const seen = { efectivo: false, tarjeta: false }
      for (const p of payments) {
        const pm = p && p.method === 'tarjeta' ? 'tarjeta' : 'efectivo'
        byPayment[pm].total = round2(
          byPayment[pm].total + (Number(p.amount) || 0),
        )
        seen[pm] = true
      }
      if (seen.efectivo) byPayment.efectivo.tickets += 1
      if (seen.tarjeta) byPayment.tarjeta.tickets += 1
    } else {
      const pm = sale.paymentMethod === 'tarjeta' ? 'tarjeta' : 'efectivo'
      byPayment[pm].total = round2(byPayment[pm].total + saleTotal)
      byPayment[pm].tickets += 1
    }
    for (const l of sale.lines || []) {
      const ctype = l.categoryType === 'bebida' ? 'bebida' : 'comida'
      const lineTotal = round2((Number(l.qty) || 0) * (Number(l.price) || 0))
      byType[ctype].total = round2(byType[ctype].total + lineTotal)
      const pKey = l.id || l.name
      if (!pKey) continue
      if (!productMap.has(pKey)) {
        productMap.set(pKey, {
          id: l.id || pKey,
          name: l.name || pKey,
          qty: 0,
          total: 0,
        })
      }
      const p = productMap.get(pKey)
      p.qty += Number(l.qty) || 0
      p.total = round2(p.total + lineTotal)
    }
  }
  for (const p of productMap.values()) byProduct.push(p)
  return {
    tickets,
    total,
    tipTotal: tip,
    byType,
    byPayment,
    byProduct,
  }
}

function scaleTotals(totals, share, tickets, total) {
  const s = Number(share) || 0
  const t = totals || {}
  const scaleMoney = (n) => round2((Number(n) || 0) * s)
  return {
    tickets: Math.max(0, Number(tickets) || 0),
    total: round2(Number(total) || 0),
    tipTotal: scaleMoney(t.tipTotal),
    byType: {
      comida: { total: scaleMoney(t.byType?.comida?.total) },
      bebida: { total: scaleMoney(t.byType?.bebida?.total) },
    },
    byPayment: {
      efectivo: {
        total: scaleMoney(t.byPayment?.efectivo?.total),
        tickets: Math.round((Number(t.byPayment?.efectivo?.tickets) || 0) * s),
      },
      tarjeta: {
        total: scaleMoney(t.byPayment?.tarjeta?.total),
        tickets: Math.round((Number(t.byPayment?.tarjeta?.tickets) || 0) * s),
      },
    },
    byProduct: Array.isArray(t.byProduct)
      ? t.byProduct.map((p) => ({
          ...p,
          qty: round2((Number(p.qty) || 0) * s),
          total: scaleMoney(p.total),
        }))
      : [],
  }
}

/** activityByHour: horas 0–7 → día ops anterior; 8–23 → día del cierre. */
function splitActivityByOpsDay(activityByHour, cierreDayKey) {
  const out = new Map()
  for (const row of activityByHour || []) {
    const hour = Number(row.hour)
    if (!Number.isFinite(hour)) continue
    const dk = hour < 8 ? addDaysKey(cierreDayKey, -1) : cierreDayKey
    if (!out.has(dk)) out.set(dk, [])
    out.get(dk).push(row)
  }
  return out
}

/**
 * Reparte un cierre en días operativos (08:00 Madrid).
 * Evita mezclar sábado y domingo cuando la jornada cruza la madrugada.
 */
function expandCierreByOpsDay(c) {
  const fullSales =
    Array.isArray(c.sales) &&
    c.sales.length &&
    c.sales.some((s) => Array.isArray(s.lines) && s.lines.length)
      ? c.sales
      : null

  // Cierres nuevos: ventas completas con líneas → reparto exacto
  if (fullSales) {
    const byDay = new Map()
    for (const s of fullSales) {
      const at = Number(s && s.at) || Number(c.endedAt) || Date.now()
      const dk = opsDayId(new Date(at))
      if (!byDay.has(dk)) byDay.set(dk, [])
      byDay.get(dk).push(s)
    }
    const out = []
    for (const [dayKey, daySales] of byDay) {
      const totals = totalsFromSales(daySales)
      out.push({
        dayKey,
        cierre: {
          ...c,
          dayKey,
          totals,
          salesCount: daySales.length,
          sales: daySales,
          activityByHour: buildActivityByHour(daySales),
        },
        products: totals.byProduct,
      })
    }
    return out.length
      ? out
      : [{ dayKey: c.dayKey, cierre: c, products: c.totals?.byProduct }]
  }

  // Legado (solo preview): si hay varios días ops, reparte totales a prorrata
  const preview = Array.isArray(c.salesPreview) ? c.salesPreview : []
  const amtByDay = new Map()
  const tkByDay = new Map()
  for (const s of preview) {
    const at = Number(s && s.at) || Number(c.endedAt) || Date.now()
    const dk = opsDayId(new Date(at))
    amtByDay.set(dk, round2((amtByDay.get(dk) || 0) + (Number(s.total) || 0)))
    tkByDay.set(dk, (tkByDay.get(dk) || 0) + 1)
  }

  if (amtByDay.size <= 1) {
    return [{ dayKey: c.dayKey, cierre: c, products: c.totals?.byProduct }]
  }

  const previewSum =
    [...amtByDay.values()].reduce((a, b) => a + b, 0) || 1
  const totTickets = Number(c.totals?.tickets) || Number(c.salesCount) || 0
  const totTotal = Number(c.totals?.total) || previewSum
  const previewTk = preview.length
  const remTk = Math.max(0, totTickets - previewTk)
  if (remTk > 0) {
    tkByDay.set(c.dayKey, (tkByDay.get(c.dayKey) || 0) + remTk)
    // El resto del dinero (no cubierto por preview) al dayKey del cierre
    const previewAmt = previewSum
    const remAmt = Math.max(0, round2(totTotal - previewAmt))
    if (remAmt > 0) {
      amtByDay.set(
        c.dayKey,
        round2((amtByDay.get(c.dayKey) || 0) + remAmt),
      )
    }
  }

  const actByDay = splitActivityByOpsDay(c.activityByHour, c.dayKey)
  const denom =
    [...amtByDay.values()].reduce((a, b) => a + b, 0) || totTotal || 1
  const out = []
  let allocated = 0
  const entries = [...amtByDay.entries()]
  entries.forEach(([dayKey, amt], idx) => {
    const share = amt / denom
    const isLast = idx === entries.length - 1
    const dayTotal = isLast
      ? round2(totTotal - allocated)
      : round2(totTotal * share)
    allocated = round2(allocated + dayTotal)
    const totals = scaleTotals(
      c.totals,
      share,
      tkByDay.get(dayKey) || 0,
      dayTotal,
    )
    out.push({
      dayKey,
      cierre: {
        ...c,
        dayKey,
        totals,
        salesCount: totals.tickets,
        activityByHour: actByDay.get(dayKey) || [],
      },
      products: totals.byProduct,
    })
  })
  return out
}

/** Semana lun–dom que termina en el domingo de `ref` (Madrid). */
function weekRangeEndingSunday(ref = new Date()) {
  const sundayKey = madridParts(ref).dayKey
  // Si no es domingo, usar el domingo anterior (semana completa cerrada)
  let endKey = sundayKey
  const wd = madridWeekday(ref)
  if (wd !== 'Sun') {
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }
    endKey = addDaysKey(sundayKey, -(map[wd] || 0))
  }
  const startKey = addDaysKey(endKey, -6)
  return {
    startKey,
    endKey,
    dayKeys: daysBetweenKeys(startKey, endKey),
    periodKey: `semana-${startKey}_${endKey}`,
    label: `Semana ${startKey} → ${endKey}`,
  }
}

/** Mes calendario anterior en Madrid (para envío día 1). */
function previousMonthRange(ref = new Date()) {
  const { year, month } = madridParts(ref)
  let y = year
  let m = month - 1
  if (m < 1) {
    m = 12
    y -= 1
  }
  const monthKey = `${y}-${String(m).padStart(2, '0')}`
  const lastDay = new Date(Date.UTC(y, m, 0, 12, 0, 0)).getUTCDate()
  const startKey = `${monthKey}-01`
  const endKey = `${monthKey}-${String(lastDay).padStart(2, '0')}`
  const dayKeys = daysBetweenKeys(startKey, endKey)
  const monthLabel = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, 15, 12, 0, 0)))
  return {
    startKey,
    endKey,
    dayKeys,
    monthKey,
    periodKey: `mes-${monthKey}`,
    label: `Mes de ${monthLabel}`,
  }
}

function startOfWeekDayKeyFromDayKey(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return startOfWeekDayKey(noon)
}

function groupWeeksInMonth(dayKeys) {
  const byWeek = new Map()
  for (const dk of dayKeys) {
    const weekStart = startOfWeekDayKeyFromDayKey(dk)
    if (!byWeek.has(weekStart)) byWeek.set(weekStart, [])
    byWeek.get(weekStart).push(dk)
  }
  return [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekStart, keys]) => ({
      weekStart,
      weekEnd: keys[keys.length - 1],
      dayKeys: keys,
      label: `Semana ${weekStart} → ${keys[keys.length - 1]}`,
    }))
}

async function buildPeriodReport({ kind, range, now = new Date() }) {
  let items = await loadCierresItems()
  // Si ya hay cierres partidos por día, ignorar el legado sin sufijo (evita doblar).
  const legacySkip = new Set()
  for (const c of items) {
    const id = String(c && c.id || '')
    const m = id.match(/^(cierre-\d+)-\d{4}-\d{2}-\d{2}$/)
    if (m) legacySkip.add(m[1])
  }
  if (legacySkip.size) {
    items = items.filter((c) => c && !legacySkip.has(String(c.id || '')))
  }

  const dayKeySet = new Set(range.dayKeys)
  const productMap = new Map()
  const days = {}
  for (const dk of range.dayKeys) days[dk] = emptyDayBucket(dk)

  for (const c of items) {
    if (!c) continue
    const parts = expandCierreByOpsDay(c)
    for (const part of parts) {
      if (!part.dayKey || !dayKeySet.has(part.dayKey)) continue
      foldCierreIntoDay(days[part.dayKey], part.cierre)
      if (part.products) mergeProducts(productMap, part.products)
      else mergeProducts(productMap, part.cierre.totals?.byProduct)
    }
  }

  const dayList = range.dayKeys.map((dk) => days[dk])
  let tickets = 0
  let total = 0
  let comida = 0
  let bebida = 0
  let efectivo = 0
  let tarjeta = 0
  let tip = 0
  for (const d of dayList) {
    tickets += d.tickets
    total = round2(total + d.total)
    comida = round2(comida + d.comida)
    bebida = round2(bebida + d.bebida)
    efectivo = round2(efectivo + d.efectivo)
    tarjeta = round2(tarjeta + d.tarjeta)
    tip = round2(tip + d.tip)
  }

  const products = [...productMap.values()]
    .map((p) => ({
      ...p,
      qty: round2(p.qty),
      total: round2(p.total),
    }))
    .sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty
      return b.total - a.total
    })

  let buckets
  if (kind === 'mensual') {
    const weeks = groupWeeksInMonth(range.dayKeys)
    buckets = weeks.map((w) => {
      const b = {
        key: w.weekStart,
        label: w.label,
        tickets: 0,
        total: 0,
        comida: 0,
        bebida: 0,
        efectivo: 0,
        tarjeta: 0,
        tip: 0,
        peak: null,
        peaks: [],
      }
      let bestPeak = null
      for (const dk of w.dayKeys) {
        const day = days[dk]
        b.tickets += day.tickets
        b.total = round2(b.total + day.total)
        b.comida = round2(b.comida + day.comida)
        b.bebida = round2(b.bebida + day.bebida)
        b.efectivo = round2(b.efectivo + day.efectivo)
        b.tarjeta = round2(b.tarjeta + day.tarjeta)
        b.tip = round2(b.tip + day.tip)
        if (day.peak) {
          b.peaks.push({ dayKey: dk, ...day.peak })
          if (
            !bestPeak ||
            day.peak.mesas > bestPeak.mesas ||
            (day.peak.mesas === bestPeak.mesas &&
              day.peak.tickets > bestPeak.tickets)
          ) {
            bestPeak = { dayKey: dk, ...day.peak }
          }
        }
      }
      b.peak = bestPeak
      return b
    })
  } else {
    buckets = dayList.map((d) => ({
      key: d.dayKey,
      label: weekdayLabelEs(d.dayKey),
      tickets: d.tickets,
      total: d.total,
      comida: d.comida,
      bebida: d.bebida,
      efectivo: d.efectivo,
      tarjeta: d.tarjeta,
      tip: d.tip,
      peak: d.peak,
      peakApprox: Boolean(d.peakApprox),
      activityByHour: d.activityByHour,
    }))
  }

  return {
    kind,
    periodKey: range.periodKey,
    label: range.label,
    startKey: range.startKey,
    endKey: range.endKey,
    generatedAt: now.toISOString(),
    generatedAtMadrid: now.toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    totals: {
      tickets,
      total,
      comida,
      bebida,
      efectivo,
      tarjeta,
      tip,
      productsCount: products.length,
    },
    products: products.slice(0, 40),
    buckets,
    bucketMode: kind === 'mensual' ? 'semana' : 'dia',
  }
}

function buildMobileEmailHtml(report) {
  const t = report.totals
  const topRows = (report.products || [])
    .slice(0, 15)
    .map((p, i) => {
      return `<tr>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:center;font-weight:800;color:#b8860b">${i + 1}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;font-weight:700">${escapeHtml(p.name)}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(formatQty(p.qty))}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:800">${escapeHtml(formatEuro(p.total))}</td>
      </tr>`
    })
    .join('')

  const bucketTitle =
    report.bucketMode === 'semana' ? 'Por semana' : 'Por día'
  const bucketRows = (report.buckets || [])
    .map((b) => {
      let peakTxt = '—'
      if (b.peak) {
        peakTxt =
          report.bucketMode === 'semana'
            ? `${b.peak.dayKey} · ${String(b.peak.hour).padStart(2, '0')}:00 · ${b.peak.mesas} mesas`
            : `${String(b.peak.hour).padStart(2, '0')}:00 · ${b.peak.mesas} mesas`
        if (b.peakApprox || b.peak.approx) peakTxt += ' ~'
      }
      return `<tr>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;font-weight:700">${escapeHtml(b.label)}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${b.tickets}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:800">${escapeHtml(formatEuro(b.total))}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;font-size:12px;color:#444">${escapeHtml(peakTxt)}</td>
      </tr>`
    })
    .join('')

  const kindLabel =
    report.kind === 'mensual' ? 'Informe mensual' : 'Informe semanal'

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(kindLabel)} · Casa Torino</title>
</head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:520px;margin:0 auto;padding:16px 12px 32px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#b8860b">Casa Torino · ERP</p>
    <h1 style="margin:0 0 6px;font-size:22px;line-height:1.25">${escapeHtml(kindLabel)}</h1>
    <p style="margin:0 0 16px;font-size:13px;color:#555;line-height:1.45">
      <strong>${escapeHtml(report.label)}</strong><br/>
      Generado: ${escapeHtml(report.generatedAtMadrid)} (Madrid)
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:14px;border-collapse:separate;border-spacing:8px 0">
      <tr>
        <td style="width:50%;background:#fff;border:1px solid #e8d9a8;border-radius:12px;padding:12px;vertical-align:top">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777">Total ventas</div>
          <div style="font-size:20px;font-weight:800;margin-top:4px">${escapeHtml(formatEuro(t.total))}</div>
        </td>
        <td style="width:50%;background:#fff;border:1px solid #e8d9a8;border-radius:12px;padding:12px;vertical-align:top">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777">Tickets</div>
          <div style="font-size:20px;font-weight:800;margin-top:4px">${t.tickets}</div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px;border-collapse:separate;border-spacing:8px 0">
      <tr>
        <td style="width:50%;background:#fff;border:1px solid #e8d9a8;border-radius:12px;padding:12px;vertical-align:top">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777">Comida</div>
          <div style="font-size:16px;font-weight:800;margin-top:4px">${escapeHtml(formatEuro(t.comida))}</div>
        </td>
        <td style="width:50%;background:#fff;border:1px solid #e8d9a8;border-radius:12px;padding:12px;vertical-align:top">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777">Bebida</div>
          <div style="font-size:16px;font-weight:800;margin-top:4px">${escapeHtml(formatEuro(t.bebida))}</div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px;border-collapse:separate;border-spacing:8px 0">
      <tr>
        <td style="width:50%;background:#fff;border:1px solid #e8d9a8;border-radius:12px;padding:12px;vertical-align:top">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777">Efectivo</div>
          <div style="font-size:16px;font-weight:800;margin-top:4px">${escapeHtml(formatEuro(t.efectivo))}</div>
        </td>
        <td style="width:50%;background:#fff;border:1px solid #e8d9a8;border-radius:12px;padding:12px;vertical-align:top">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777">Tarjeta</div>
          <div style="font-size:16px;font-weight:800;margin-top:4px">${escapeHtml(formatEuro(t.tarjeta))}</div>
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 8px;font-size:16px">${escapeHtml(bucketTitle)}</h2>
    <p style="margin:0 0 10px;font-size:12px;color:#666">Cada día es el día operativo 08:00–08:00 (Madrid): sábado y domingo van aparte. Pico = hora con más mesas distintas cobradas${report.bucketMode === 'semana' ? ' (mejor día de la semana)' : ''}. El símbolo ~ indica reconstrucción parcial.</p>
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8d9a8;border-radius:12px;overflow:hidden;margin-bottom:20px;border-collapse:collapse">
      <thead>
        <tr style="background:#1a1a1a;color:#f5c518">
          <th style="padding:10px 6px;text-align:left;font-size:10px;text-transform:uppercase">Periodo</th>
          <th style="padding:10px 6px;text-align:right;font-size:10px;text-transform:uppercase">Tk</th>
          <th style="padding:10px 6px;text-align:right;font-size:10px;text-transform:uppercase">Total</th>
          <th style="padding:10px 6px;text-align:left;font-size:10px;text-transform:uppercase">Pico mesas</th>
        </tr>
      </thead>
      <tbody>
        ${bucketRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#888">Sin datos</td></tr>`}
      </tbody>
    </table>

    <h2 style="margin:0 0 8px;font-size:16px">Productos más vendidos</h2>
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8d9a8;border-radius:12px;overflow:hidden;margin-bottom:20px;border-collapse:collapse">
      <thead>
        <tr style="background:#1a1a1a;color:#f5c518">
          <th style="padding:10px 6px;text-align:center;font-size:10px;text-transform:uppercase;width:28px">#</th>
          <th style="padding:10px 6px;text-align:left;font-size:10px;text-transform:uppercase">Producto</th>
          <th style="padding:10px 6px;text-align:right;font-size:10px;text-transform:uppercase">Uds</th>
          <th style="padding:10px 6px;text-align:right;font-size:10px;text-transform:uppercase">Total</th>
        </tr>
      </thead>
      <tbody>
        ${topRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#888">Sin ventas</td></tr>`}
      </tbody>
    </table>

    <p style="margin:0;font-size:11px;color:#888;line-height:1.4">
      Informe automático Casa Torino · Propina periodo: ${escapeHtml(formatEuro(t.tip))} ·
      ${report.products.length} productos distintos (top 15 en tabla).
    </p>
  </div>
</body>
</html>`
}

async function readInformeLog() {
  const log = await getJson(
    LOG_KEY,
    () => ({ kind: 'casa-torino-informe-log', sent: {}, updatedAt: 0 }),
    { fresh: true },
  )
  if (!log || typeof log !== 'object') {
    return { kind: 'casa-torino-informe-log', sent: {}, updatedAt: 0 }
  }
  if (!log.sent || typeof log.sent !== 'object') log.sent = {}
  return log
}

async function markInformeSent(periodKey, meta) {
  await updateJson(
    LOG_KEY,
    () => ({ kind: 'casa-torino-informe-log', sent: {}, updatedAt: 0 }),
    (store) => {
      const sent =
        store.sent && typeof store.sent === 'object' ? { ...store.sent } : {}
      sent[periodKey] = {
        ...meta,
        at: Date.now(),
      }
      // Limitar historial
      const keys = Object.keys(sent).sort()
      while (keys.length > 80) {
        const k = keys.shift()
        delete sent[k]
      }
      return {
        kind: 'casa-torino-informe-log',
        sent,
        updatedAt: Date.now(),
      }
    },
  )
}

async function storeInformeHtml(periodKey, html) {
  const key = `informe-html:${periodKey}`
  await setJson(key, {
    kind: 'casa-torino-informe-html',
    periodKey,
    html,
    updatedAt: Date.now(),
  })
  return key
}

async function sendResendEmail({ subject, html, to = REPORT_TO }) {
  if (!RESEND_API_KEY) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_RESEND_API_KEY',
    }
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [to],
      subject,
      html,
    }),
  })
  const text = await r.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: (data && (data.message || data.error)) || text || 'resend_error',
      data,
    }
  }
  return { ok: true, id: data?.id || null, data }
}

/**
 * Genera y (opcionalmente) envía un informe.
 * @param {'semanal'|'mensual'} kind
 * @param {{ force?: boolean, dryRun?: boolean, now?: Date }} opts
 */
async function runInforme(kind, opts = {}) {
  const now = opts.now || new Date()
  const force = Boolean(opts.force)
  const dryRun = Boolean(opts.dryRun)

  const range =
    kind === 'mensual' ? previousMonthRange(now) : weekRangeEndingSunday(now)

  const log = await readInformeLog()
  if (!force && !dryRun && log.sent[range.periodKey]) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_sent',
      periodKey: range.periodKey,
      previous: log.sent[range.periodKey],
    }
  }

  const report = await buildPeriodReport({ kind, range, now })
  const html = buildMobileEmailHtml(report)
  const subject =
    kind === 'mensual'
      ? `Casa Torino · Informe mensual · ${report.label}`
      : `Casa Torino · Informe semanal · ${report.label}`

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      periodKey: range.periodKey,
      subject,
      report,
      html,
      emailConfigured: Boolean(RESEND_API_KEY),
      to: REPORT_TO,
    }
  }

  const storageKey = await storeInformeHtml(range.periodKey, html)
  const email = await sendResendEmail({ subject, html })

  if (email.ok) {
    await markInformeSent(range.periodKey, {
      kind,
      subject,
      to: REPORT_TO,
      resendId: email.id,
      storageKey,
      mode: 'email',
      totals: report.totals || null,
      endKey: range.endKey,
    })
    return {
      ok: true,
      sent: true,
      periodKey: range.periodKey,
      subject,
      to: REPORT_TO,
      resendId: email.id,
      storageKey,
      totals: report.totals,
    }
  }

  // Sin API key: archivar HTML y no reintentar en bucle.
  // Si Resend falla: NO marcar enviado → el cron del lunes / día 1 reintenta.
  if (email.skipped) {
    await markInformeSent(range.periodKey, {
      kind,
      subject,
      to: REPORT_TO,
      storageKey,
      mode: 'stored_only',
      error: email.reason || null,
      totals: report.totals || null,
      endKey: range.endKey,
    })
  }

  return {
    ok: Boolean(email.skipped),
    sent: false,
    stored: true,
    periodKey: range.periodKey,
    subject,
    to: REPORT_TO,
    storageKey,
    email,
    totals: report.totals,
    willRetry: !email.skipped,
    fallback:
      'HTML guardado en ops_kv. Configura RESEND_API_KEY en Vercel (proyecto web) para envío automático a ' +
      REPORT_TO +
      '. Alternativa: GET /api/informes-semanal?dryRun=1 (o mensual) con sesión TPV y abrir el HTML en el móvil.',
  }
}

/**
 * Disparo tras cerrar caja un domingo (no bloqueante).
 * Siempre force=true: el ÚLTIMO cierre del domingo manda el mail completo
 * (lun–dom). Si hubo un envío a mediodía, se reenvía con el domingo entero.
 */
async function maybeTriggerWeeklyAfterSundayClose() {
  if (madridWeekday(Date.now()) !== 'Sun') {
    return { triggered: false, reason: 'not_sunday' }
  }
  try {
    const result = await runInforme('semanal', { force: true })
    return { triggered: true, result }
  } catch (err) {
    console.warn('[informe] sunday trigger', err)
    return {
      triggered: true,
      error: String(err && err.message ? err.message : err),
    }
  }
}

/**
 * Lunes (cron): envía si no se envió, o reenvía si el envío previo
 * tenía menos tickets/total (p. ej. cierre prematuro el domingo).
 */
async function maybeTriggerWeeklyMondayBackup(now = new Date()) {
  const range = weekRangeEndingSunday(now)
  const log = await readInformeLog()
  const prev = log.sent[range.periodKey]
  if (!prev) {
    return runInforme('semanal', { force: false, now })
  }
  const dry = await runInforme('semanal', { dryRun: true, now })
  const curTickets = Number(dry.report?.totals?.tickets) || 0
  const curTotal = Number(dry.report?.totals?.total) || 0
  const prevTickets = Number(prev.totals?.tickets) || 0
  const prevTotal = Number(prev.totals?.total) || 0
  const grew =
    curTickets > prevTickets || curTotal > prevTotal + 0.009
  if (!grew) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_sent_complete',
      periodKey: range.periodKey,
      previous: prev,
      currentTotals: dry.report?.totals || null,
    }
  }
  return runInforme('semanal', { force: true, now })
}

module.exports = {
  buildActivityByHour,
  peakFromActivity,
  weekRangeEndingSunday,
  previousMonthRange,
  buildPeriodReport,
  buildMobileEmailHtml,
  runInforme,
  maybeTriggerWeeklyAfterSundayClose,
  maybeTriggerWeeklyMondayBackup,
  madridWeekday,
  madridParts,
  REPORT_TO,
  RESEND_API_KEY,
}

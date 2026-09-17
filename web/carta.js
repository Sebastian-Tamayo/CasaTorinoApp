/**
 * Casa Torino — carga carta única (data/carta.json) + filtro menú semana/finde/festivo.
 */
(() => {
  const CARTA_URL = 'data/carta.json'

  function madridParts(ts = Date.now()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    })
    const parts = Object.fromEntries(
      fmt
        .formatToParts(new Date(ts))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    )
    return {
      dayKey: `${parts.year}-${parts.month}-${parts.day}`,
      weekday: parts.weekday,
      year: parts.year,
    }
  }

  function festivoSet(meta) {
    const bag = new Set()
    const block = meta && meta.festivosGijon
    if (!block || typeof block !== 'object') return bag
    for (const year of Object.keys(block)) {
      if (!/^\d{4}$/.test(year)) continue
      const list = block[year]
      if (!Array.isArray(list)) continue
      for (const item of list) {
        const d = typeof item === 'string' ? item : item && item.date
        if (d) bag.add(String(d).slice(0, 10))
      }
    }
    return bag
  }

  function festivoToday(meta, ts = Date.now()) {
    const { dayKey } = madridParts(ts)
    const block = meta && meta.festivosGijon
    if (!block) return null
    const year = dayKey.slice(0, 4)
    const list = Array.isArray(block[year]) ? block[year] : []
    return list.find((it) => (typeof it === 'string' ? it : it?.date) === dayKey) || null
  }

  /** Sáb/dom o festivo laboral de Gijón → menú fin de semana. */
  function isWeekendMenuDay(meta, ts = Date.now()) {
    const { dayKey, weekday } = madridParts(ts)
    if (weekday === 'Sat' || weekday === 'Sun') {
      return { weekend: true, reason: 'weekend', dayKey, festivo: null }
    }
    const fest = festivoToday(meta, ts)
    if (fest) {
      return {
        weekend: true,
        reason: 'holiday',
        dayKey,
        festivo: typeof fest === 'string' ? { date: fest, name: fest } : fest,
      }
    }
    return { weekend: false, reason: 'weekday', dayKey, festivo: null }
  }

  function madridIsWeekend(ts = Date.now()) {
    return isWeekendMenuDay(null, ts).weekend
  }

  function applyMenuSchedule(categories, { forceAll = false, meta = null } = {}) {
    const info = isWeekendMenuDay(meta || window.TPV_CARTA_META, Date.now())
    const want = info.weekend ? 'weekend' : 'weekday'
    return (categories || []).map((cat) => {
      if (cat.id !== 'menus-dia' || forceAll) {
        return { ...cat, items: (cat.items || []).slice() }
      }
      const items = (cat.items || []).filter((it) => {
        const sch = it.schedule
        if (!sch) return true
        return sch === want
      })
      return { ...cat, items }
    })
  }

  async function loadCarta() {
    const r = await fetch(CARTA_URL, { cache: 'no-store' })
    if (!r.ok) throw new Error('carta ' + r.status)
    return r.json()
  }

  window.CasaTorinoCarta = {
    loadCarta,
    applyMenuSchedule,
    madridIsWeekend,
    isWeekendMenuDay,
    festivoToday,
    festivoSet,
    madridParts,
    CARTA_URL,
  }
})()

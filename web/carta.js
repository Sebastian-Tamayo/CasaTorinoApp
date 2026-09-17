/**
 * Casa Torino — carga carta única (data/carta.json) + filtro menú semana/finde.
 */
(() => {
  const CARTA_URL = 'data/carta.json'

  function madridIsWeekend(ts = Date.now()) {
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      weekday: 'short',
    }).format(new Date(ts))
    return wd === 'Sat' || wd === 'Sun'
  }

  function applyMenuSchedule(categories, { forceAll = false } = {}) {
    const weekend = madridIsWeekend()
    const want = weekend ? 'weekend' : 'weekday'
    return (categories || []).map((cat) => {
      if (cat.id !== 'menus-dia' || forceAll) return { ...cat, items: (cat.items || []).slice() }
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
    CARTA_URL,
  }
})()

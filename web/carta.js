/**
 * Casa Torino — carga carta única + filtro menú semana/finde/festivo.
 * Preferente: /api/carta (Supabase ops_kv). Fallback: data/carta.json.
 */
(() => {
  const CARTA_API = '/api/carta'
  const CARTA_FILE = 'data/carta.json'
  /** @deprecated usar CARTA_API; se mantiene por compat */
  const CARTA_URL = CARTA_API

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
    try {
      const r = await fetch(CARTA_API, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (r.ok) return r.json()
    } catch (err) {
      console.warn('[carta] api', err)
    }
    const r2 = await fetch(CARTA_FILE, { cache: 'no-store' })
    if (!r2.ok) throw new Error('carta ' + r2.status)
    return r2.json()
  }

  async function postCarta(action, payload = {}) {
    const r = await fetch(CARTA_API, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const err = new Error(data.error || 'carta POST ' + r.status)
      err.status = r.status
      err.data = data
      throw err
    }
    return data
  }

  /** Sube imagen de plato al bucket menu_images (vía API servidor). */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const s = String(reader.result || '')
        const i = s.indexOf(',')
        resolve(i >= 0 ? s.slice(i + 1) : s)
      }
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
      reader.readAsDataURL(file)
    })
  }

  /** Comprime a JPEG ≤ maxEdge px / quality para que quepa en Storage o inline. */
  function compressImageFile(file, { maxEdge = 1000, quality = 0.72, maxBytes = 180 * 1024 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || '').startsWith('image/')) {
        reject(new Error('archivo no es imagen'))
        return
      }
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        try {
          URL.revokeObjectURL(url)
          let w = img.naturalWidth || img.width
          let h = img.naturalHeight || img.height
          if (!w || !h) {
            reject(new Error('imagen inválida'))
            return
          }
          const scale = Math.min(1, maxEdge / Math.max(w, h))
          w = Math.max(1, Math.round(w * scale))
          h = Math.max(1, Math.round(h * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          let q = quality
          let dataUrl = canvas.toDataURL('image/jpeg', q)
          while (dataUrl.length > maxBytes * 1.37 && q > 0.45) {
            q -= 0.08
            dataUrl = canvas.toDataURL('image/jpeg', q)
          }
          const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
          resolve({
            dataBase64: b64,
            contentType: 'image/jpeg',
            bytes: Math.round((b64.length * 3) / 4),
          })
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('No se pudo leer la imagen'))
      }
      img.src = url
    })
  }

  async function uploadCartaImage(itemId, file) {
    if (!file) throw new Error('falta archivo')
    let payload
    try {
      payload = await compressImageFile(file)
    } catch (err) {
      console.warn('[carta] compress', err)
      const dataBase64 = await fileToBase64(file)
      payload = {
        dataBase64,
        contentType: file.type || 'image/jpeg',
      }
    }
    const r = await fetch('/api/carta-image', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        action: 'upload',
        itemId,
        contentType: payload.contentType,
        filename: file.name || '',
        dataBase64: payload.dataBase64,
      }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const err = new Error(data.error || 'upload ' + r.status)
      err.status = r.status
      err.data = data
      throw err
    }
    return data
  }

  window.CasaTorinoCarta = {
    loadCarta,
    postCarta,
    uploadCartaImage,
    applyMenuSchedule,
    madridIsWeekend,
    isWeekendMenuDay,
    festivoToday,
    festivoSet,
    madridParts,
    CARTA_URL,
    CARTA_API,
    CARTA_FILE,
  }
})()

/**
 * Casa Torino — carga carta única + menú del día único (semana y finde).
 * Preferente: /api/carta (Supabase ops_kv). Fallback: data/carta.json.
 */
(() => {
  // Rutas absolutas: en móvil/PWA un path relativo a veces falla tras ?v= o deep link.
  const CARTA_API = '/api/carta'
  const CARTA_FILE = '/data/carta.json'
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

  /**
   * Menú del día único (ya no depende del día de la semana).
   * Se mantiene la API por compat con web/TV.
   */
  function menuDayKind(meta, ts = Date.now()) {
    const { dayKey } = madridParts(ts)
    return { kind: 'daily', schedule: 'always', reason: 'unified', dayKey, festivo: null }
  }

  /** Compat: ya no hay menú distinto de finde. */
  function isWeekendMenuDay(meta, ts = Date.now()) {
    const info = menuDayKind(meta, ts)
    return {
      weekend: false,
      reason: info.reason,
      dayKey: info.dayKey,
      festivo: null,
      schedule: 'always',
      kind: 'daily',
    }
  }

  function madridIsWeekend(ts = Date.now()) {
    return isWeekendMenuDay(null, ts).weekend
  }

  /** @deprecated schedule ya no filtra; todo el menú del día es único. */
  function menuItemSchedule(it) {
    if (!it || it.customProduct || it.historicoOnly) return ''
    return 'always'
  }

  /** Plato canónico del menú del día (uno solo). */
  function pickMenuDiaItem(items) {
    const list = (items || []).filter(
      (it) =>
        it &&
        !it.customProduct &&
        !it.historicoOnly &&
        String(it.id) !== 'menu-historico',
    )
    if (!list.length) return null
    const rank = (it) => {
      const id = String(it.id || '')
      if (id === 'menu-dia' || id === 'menu-dia-unificado-semana') return 0
      if (it.image_url) return 1
      return 2
    }
    return [...list].sort((a, b) => rank(a) - rank(b))[0] || null
  }

  /** Precio del menú único (menuDay.price o el plato). */
  function menuDiaPrice(data) {
    const md = data?.menuDay
    if (md && Number.isFinite(Number(md.price))) return Number(md.price)
    if (md?.weekday && Number.isFinite(Number(md.weekday.price ?? md.weekday.unified))) {
      return Number(md.weekday.price ?? md.weekday.unified)
    }
    const menus = (data?.categories || []).find((c) => c && c.id === 'menus-dia')
    const it = pickMenuDiaItem(menus?.items)
    if (it && Number.isFinite(Number(it.price))) return Number(it.price)
    return 13
  }

  function applyMenuSchedule(categories, { forceAll = false } = {}) {
    return (categories || []).map((cat) => {
      if (cat.id !== 'menus-dia') {
        return { ...cat, items: (cat.items || []).slice() }
      }
      if (forceAll) {
        return { ...cat, items: (cat.items || []).slice() }
      }
      const primary = pickMenuDiaItem(cat.items)
      return { ...cat, items: primary ? [primary] : [] }
    })
  }

  async function loadCarta() {
    let lastErr = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await fetch(CARTA_API, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (r.ok) {
          const data = await r.json()
          if (data && Array.isArray(data.categories) && data.categories.length) {
            return data
          }
          lastErr = new Error('carta API sin categorías')
        } else {
          lastErr = new Error('carta API ' + r.status)
        }
      } catch (err) {
        lastErr = err
        console.warn('[carta] api', err)
      }
      try {
        const r2 = await fetch(CARTA_FILE, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (r2.ok) {
          const data = await r2.json()
          if (data && Array.isArray(data.categories) && data.categories.length) {
            return data
          }
          lastErr = new Error('carta.json sin categorías')
        } else {
          lastErr = new Error('carta.json ' + r2.status)
        }
      } catch (err) {
        lastErr = err
        console.warn('[carta] file', err)
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 350))
    }
    throw lastErr || new Error('No se pudo cargar la carta')
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
    menuItemSchedule,
    pickMenuDiaItem,
    menuDiaPrice,
    menuDayKind,
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

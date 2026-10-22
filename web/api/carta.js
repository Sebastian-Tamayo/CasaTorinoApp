/**
 * Carta única (web pública + TPV) — Supabase ops_kv clave `carta`.
 *
 * GET  /api/carta
 *   Lee de Supabase. Si no hay fila / error → fallback a data/carta.json.
 *   Si Supabase está vacío pero configurado, siembra desde el JSON (una vez).
 *
 * POST /api/carta  (sesión TPV o X-Tpv-Key)
 *   { action: 'seed' }                      — fuerza copia JSON → Supabase
 *   { action: 'put', carta: { ... } }       — reemplaza carta completa
 *   { action: 'upsertItem', categoryId, item } — alta/edición de un producto
 *
 * Así se pueden cambiar precios/productos sin redeploy de Vercel.
 */
const fs = require('fs')
const path = require('path')
const { getJson, setJson, hasSupabase } = require('./_opsStore')
const { hasTpvSession } = require('./_tpvSession')

const CARTA_KEY = 'carta'
const SYNC_KEY = process.env.TPV_SYNC_KEY || ''

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Tpv-Key, Cache-Control',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function authorized(req) {
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  if (SYNC_KEY && key && key === SYNC_KEY) return true
  return false
}

function readFileCarta() {
  const candidates = [
    path.join(process.cwd(), 'data', 'carta.json'),
    path.join(__dirname, '..', 'data', 'carta.json'),
  ]
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8')
        return JSON.parse(raw)
      }
    } catch (err) {
      console.warn('[carta] read file', file, err && err.message)
    }
  }
  throw new Error('No se pudo leer data/carta.json')
}

function isValidCarta(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.categories) &&
    data.categories.length > 0
  )
}

function withMeta(data, source) {
  const out =
    data && typeof data === 'object'
      ? { ...data }
      : { version: 1, categories: [] }
  ensureMenusHistorico(out)
  if (!Array.isArray(out.menusAnteriores)) out.menusAnteriores = []
  out._source = source
  out._servedAt = new Date().toISOString()
  return out
}

/**
 * Plato solo TPV (modo edición): subir fotos al histórico de la web.
 * No forma parte de la carta pública ni se vende en sala.
 */
function ensureMenusHistorico(carta) {
  if (!carta || typeof carta !== 'object') return carta
  if (!Array.isArray(carta.categories)) carta.categories = []
  if (!Array.isArray(carta.menusAnteriores)) carta.menusAnteriores = []
  let cat = carta.categories.find((c) => c && c.id === 'menus-historico')
  if (!cat) {
    cat = {
      id: 'menus-historico',
      name: 'Menús anteriores',
      icon: 'fa-images',
      items: [],
    }
    // Justo después de menús del día si existe
    const menusIdx = carta.categories.findIndex((c) => c && c.id === 'menus-dia')
    if (menusIdx >= 0) carta.categories.splice(menusIdx + 1, 0, cat)
    else carta.categories.unshift(cat)
  }
  if (!Array.isArray(cat.items)) cat.items = []
  cat.name = 'Menús anteriores'
  cat.icon = cat.icon || 'fa-images'
  let item = cat.items.find((it) => it && it.id === 'menu-historico')
  if (!item) {
    cat.items.push({
      id: 'menu-historico',
      name: 'Menús anteriores',
      price: 0,
      desc: 'Sube aquí fotos de menús pasados. Solo histórico web; no sale en la carta.',
      base: 'Menús anteriores',
      categoryType: 'comida',
      customProduct: true,
      historicoOnly: true,
    })
  } else {
    item.name = 'Menús anteriores'
    item.customProduct = true
    item.historicoOnly = true
    item.price = 0
  }
  return carta
}

function cartaNeedsHistoricoPersist(carta) {
  if (!carta || !Array.isArray(carta.categories)) return true
  const cat = carta.categories.find((c) => c && c.id === 'menus-historico')
  if (!cat || !Array.isArray(cat.items)) return true
  return !cat.items.some((it) => it && it.id === 'menu-historico')
}

async function loadFromStore() {
  if (!hasSupabase()) return null
  try {
    const v = await getJson(CARTA_KEY, null, { fresh: true })
    if (isValidCarta(v)) return v
  } catch (err) {
    console.warn('[carta] supabase get', err && err.message)
  }
  return null
}

async function seedFromFile() {
  const file = readFileCarta()
  if (!isValidCarta(file)) throw new Error('carta.json inválida')
  if (!hasSupabase()) return { carta: file, seeded: false, reason: 'no-supabase' }
  const payload = {
    ...file,
    updatedAt: Date.now(),
  }
  await setJson(CARTA_KEY, payload)
  return { carta: payload, seeded: true }
}

function upsertItemInCarta(carta, categoryId, item) {
  if (!item || typeof item !== 'object' || !item.id || !item.name) {
    throw new Error('item.id e item.name son obligatorios')
  }
  const catId = String(categoryId || '').trim()
  if (!catId) throw new Error('categoryId obligatorio')
  const next = JSON.parse(JSON.stringify(carta))
  const cats = Array.isArray(next.categories) ? next.categories : []
  let cat = cats.find((c) => c.id === catId)
  if (!cat) {
    cat = { id: catId, name: catId, items: [] }
    cats.push(cat)
    next.categories = cats
  }
  if (!Array.isArray(cat.items)) cat.items = []
  const idx = cat.items.findIndex((it) => it.id === item.id)
  const normalized = {
    id: String(item.id),
    name: String(item.name),
    price: Number(item.price) || 0,
    desc: item.desc != null ? String(item.desc) : '',
    base: item.base != null ? String(item.base) : String(item.name),
    categoryType: item.categoryType || 'bebida',
  }
  if (item.schedule) normalized.schedule = item.schedule
  if (item.customProduct) normalized.customProduct = true
  if (item.historicoOnly) normalized.historicoOnly = true
  if (item.priceEditable) normalized.priceEditable = true
  if (item.coursePick) normalized.coursePick = true
  if (item.star) normalized.star = true
  if (item.group) normalized.group = String(item.group)
  const isHistorico =
    catId === 'menus-historico' ||
    String(item.id) === 'menu-historico' ||
    item.historicoOnly === true
  if (isHistorico) {
    normalized.customProduct = true
    normalized.historicoOnly = true
    normalized.price = 0
    normalized.name = 'Menús anteriores'
    normalized.base = 'Menús anteriores'
  }
  // image_url: solo si viene en el payload ('' = quitar foto)
  let clearImage = false
  if (Object.prototype.hasOwnProperty.call(item, 'image_url')) {
    const url = item.image_url != null ? String(item.image_url).trim() : ''
    if (url) normalized.image_url = url
    else clearImage = true
  }
  if (idx >= 0) {
    const prev = cat.items[idx] || {}
    // Si cambia la foto de un menú del día, archivar la anterior (colección web)
    const isMenuDia =
      catId === 'menus-dia' || String(prev.id || item.id || '').startsWith('menu-dia')
    const prevUrl = prev.image_url != null ? String(prev.image_url).trim() : ''
    const nextUrl = normalized.image_url != null ? String(normalized.image_url).trim() : ''
    if (isMenuDia && prevUrl && nextUrl && prevUrl !== nextUrl) {
      archiveMenuAnterior(next, prevUrl)
    }
    // Histórico: cada foto nueva se añade a la galería pública (no sale en carta)
    if (isHistorico && nextUrl) {
      archiveMenuAnterior(next, nextUrl)
    }
    cat.items[idx] = { ...prev, ...normalized }
    // Si el cliente no manda star:true, no borrar la estrella existente
    if (!item.star && prev.star && item.star !== false) {
      cat.items[idx].star = true
    }
    if (item.star === false) delete cat.items[idx].star
    if (clearImage) delete cat.items[idx].image_url
  } else {
    if (clearImage) delete normalized.image_url
    cat.items.push(normalized)
    const nextUrl = normalized.image_url != null ? String(normalized.image_url).trim() : ''
    if (isHistorico && nextUrl) {
      archiveMenuAnterior(next, nextUrl)
    }
  }
  next.updatedAt = Date.now()
  syncMenuDayFromItems(next)
  return next
}

/** Fotos de menús pasados para la web (solo URLs; máx. 30). */
function archiveMenuAnterior(carta, url) {
  const src = String(url || '').trim()
  if (!src || src.startsWith('data:')) return
  if (!Array.isArray(carta.menusAnteriores)) carta.menusAnteriores = []
  carta.menusAnteriores = carta.menusAnteriores.filter((u) => String(u) !== src)
  carta.menusAnteriores.unshift(src)
  if (carta.menusAnteriores.length > 30) {
    carta.menusAnteriores = carta.menusAnteriores.slice(0, 30)
  }
}

/** Mantén precios del bloque «Menú del día» de la web alineados con los platos. */
function syncMenuDayFromItems(carta) {
  const menus = (carta.categories || []).find((c) => c && c.id === 'menus-dia')
  if (!menus || !Array.isArray(menus.items)) return
  const find = (id) => menus.items.find((it) => it && it.id === id)
  const bySchedule = (sch) =>
    menus.items.find((it) => it && String(it.schedule || '').trim() === sch)
  const week =
    find('menu-dia-unificado-semana') ||
    bySchedule('weekday') ||
    find('menu-dia-es-semana') ||
    find('menu-dia-co-semana')
  const sat =
    find('menu-dia-sabado') ||
    find('menu-dia-co-finde') ||
    bySchedule('saturday')
  const sun =
    find('menu-dia-domingo') ||
    find('menu-dia-es-finde') ||
    bySchedule('sunday')
  if (!carta.menuDay || typeof carta.menuDay !== 'object') {
    carta.menuDay = {
      weekday: { label: 'Entre semana', price: 13 },
      saturday: { label: 'Sábado', price: 16 },
      sunday: { label: 'Domingo / festivo', price: 18 },
    }
  }
  if (!carta.menuDay.weekday) carta.menuDay.weekday = { label: 'Entre semana' }
  if (!carta.menuDay.saturday) carta.menuDay.saturday = { label: 'Sábado' }
  if (!carta.menuDay.sunday) carta.menuDay.sunday = { label: 'Domingo / festivo' }
  if (week && Number.isFinite(Number(week.price))) {
    carta.menuDay.weekday.price = Number(week.price)
    carta.menuDay.weekday.unified = Number(week.price)
    delete carta.menuDay.weekday.es
    delete carta.menuDay.weekday.co
  }
  if (sat && Number.isFinite(Number(sat.price))) {
    carta.menuDay.saturday.price = Number(sat.price)
  }
  if (sun && Number.isFinite(Number(sun.price))) {
    carta.menuDay.sunday.price = Number(sun.price)
  }
  // Limpia bloque legado ES/CO de finde
  if (carta.menuDay.weekend) delete carta.menuDay.weekend
}

function deleteItemInCarta(carta, categoryId, itemId) {
  const catId = String(categoryId || '').trim()
  const id = String(itemId || '').trim()
  if (!catId || !id) throw new Error('categoryId e itemId son obligatorios')
  if (id === 'menu-historico' || catId === 'menus-historico') {
    throw new Error('El plato de menús anteriores no se puede borrar')
  }
  const next = JSON.parse(JSON.stringify(carta))
  const cats = Array.isArray(next.categories) ? next.categories : []
  const cat = cats.find((c) => c.id === catId)
  if (!cat || !Array.isArray(cat.items)) {
    throw new Error('categoría no encontrada')
  }
  const before = cat.items.length
  cat.items = cat.items.filter((it) => it && it.id !== id)
  if (cat.items.length === before) throw new Error('producto no encontrado')
  next.updatedAt = Date.now()
  return next
}

function expectedEditPin() {
  // Solo CARTA_EDIT_PIN en Vercel (sin fallback hardcodeado en el repo)
  return String(process.env.CARTA_EDIT_PIN || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\r|\n/g, '')
    .trim()
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET') {
    try {
      let source = 'supabase'
      let data = await loadFromStore()
      if (!data) {
        try {
          if (hasSupabase()) {
            const seeded = await seedFromFile()
            data = seeded.carta
            source = seeded.seeded ? 'supabase-seed' : 'file'
          } else {
            data = readFileCarta()
            source = 'file'
          }
        } catch (err) {
          // Último recurso: solo fichero
          data = readFileCarta()
          source = 'file'
          console.warn('[carta] seed/fallback', err && err.message)
        }
      }
      // Persistimos el plato de histórico si aún no está en Supabase
      if (data && cartaNeedsHistoricoPersist(data) && hasSupabase()) {
        try {
          const patched = ensureMenusHistorico(JSON.parse(JSON.stringify(data)))
          patched.updatedAt = Date.now()
          await setJson(CARTA_KEY, patched)
          data = patched
          source = source === 'file' ? 'supabase-seed' : source
        } catch (err) {
          console.warn('[carta] ensure historico', err && err.message)
          ensureMenusHistorico(data)
        }
      } else if (data) {
        ensureMenusHistorico(data)
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Carta-Source', source)
      return res.end(JSON.stringify(withMeta(data, source)))
    } catch (err) {
      console.error('[carta] GET', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          error: String(err && err.message ? err.message : err),
        }),
      )
    }
  }

  if (req.method === 'POST') {
    if (!authorized(req)) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'unauthorized' }))
    }
    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body || '{}')
      } catch {
        body = {}
      }
    }
    body = body || {}
    const action = String(body.action || '').trim()

    try {
      if (action === 'seed') {
        const out = await seedFromFile()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({
            ok: true,
            action: 'seed',
            seeded: out.seeded,
            reason: out.reason || null,
            categories: (out.carta.categories || []).length,
            updatedAt: out.carta.updatedAt || null,
          }),
        )
      }

      if (action === 'put') {
        if (!isValidCarta(body.carta)) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'carta inválida' }))
        }
        if (!hasSupabase()) {
          res.statusCode = 503
          return res.end(JSON.stringify({ error: 'supabase no configurado' }))
        }
        const payload = { ...body.carta, updatedAt: Date.now() }
        await setJson(CARTA_KEY, payload)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({
            ok: true,
            action: 'put',
            categories: (payload.categories || []).length,
            updatedAt: payload.updatedAt,
          }),
        )
      }

      if (action === 'verifyEditPin') {
        const pin = String(body.pin || '').trim()
        const ok = Boolean(pin && pin === expectedEditPin())
        res.statusCode = ok ? 200 : 401
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify(
            ok
              ? { ok: true, action: 'verifyEditPin' }
              : { ok: false, error: 'PIN incorrecto' },
          ),
        )
      }

      if (action === 'upsertItem') {
        if (!hasSupabase()) {
          res.statusCode = 503
          return res.end(JSON.stringify({ error: 'supabase no configurado' }))
        }
        let current = await loadFromStore()
        if (!current) {
          const seeded = await seedFromFile()
          current = seeded.carta
        }
        ensureMenusHistorico(current)
        const next = upsertItemInCarta(
          current,
          body.categoryId,
          body.item,
        )
        await setJson(CARTA_KEY, next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({
            ok: true,
            action: 'upsertItem',
            categoryId: body.categoryId,
            itemId: body.item && body.item.id,
            updatedAt: next.updatedAt,
            carta: withMeta(next, 'supabase'),
          }),
        )
      }

      if (action === 'deleteItem') {
        if (!hasSupabase()) {
          res.statusCode = 503
          return res.end(JSON.stringify({ error: 'supabase no configurado' }))
        }
        let current = await loadFromStore()
        if (!current) {
          const seeded = await seedFromFile()
          current = seeded.carta
        }
        const next = deleteItemInCarta(
          current,
          body.categoryId,
          body.itemId || (body.item && body.item.id),
        )
        await setJson(CARTA_KEY, next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({
            ok: true,
            action: 'deleteItem',
            categoryId: body.categoryId,
            itemId: body.itemId || (body.item && body.item.id),
            updatedAt: next.updatedAt,
            carta: withMeta(next, 'supabase'),
          }),
        )
      }

      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          error: 'action inválida (seed|put|upsertItem|deleteItem|verifyEditPin)',
        }),
      )
    } catch (err) {
      console.error('[carta] POST', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          error: String(err && err.message ? err.message : err),
        }),
      )
    }
  }

  res.statusCode = 405
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify({ error: 'method not allowed' }))
}

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

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
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
  out._source = source
  out._servedAt = new Date().toISOString()
  return out
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
  if (item.priceEditable) normalized.priceEditable = true
  if (item.coursePick) normalized.coursePick = true
  if (item.star) normalized.star = true
  if (item.group) normalized.group = String(item.group)
  if (idx >= 0) {
    const prev = cat.items[idx] || {}
    cat.items[idx] = { ...prev, ...normalized }
    // Si el cliente no manda star:true, no borrar la estrella existente
    if (!item.star && prev.star && item.star !== false) {
      cat.items[idx].star = true
    }
    if (item.star === false) delete cat.items[idx].star
  } else {
    cat.items.push(normalized)
  }
  next.updatedAt = Date.now()
  syncMenuDayFromItems(next)
  return next
}

/** Mantén precios del bloque «Menú del día» de la web alineados con los platos. */
function syncMenuDayFromItems(carta) {
  const menus = (carta.categories || []).find((c) => c && c.id === 'menus-dia')
  if (!menus || !Array.isArray(menus.items)) return
  const find = (id) => menus.items.find((it) => it && it.id === id)
  const esW = find('menu-dia-es-semana')
  const coW = find('menu-dia-co-semana')
  const esE = find('menu-dia-es-finde')
  const coE = find('menu-dia-co-finde')
  if (!carta.menuDay || typeof carta.menuDay !== 'object') {
    carta.menuDay = {
      weekday: { label: 'Entre semana', es: 14, co: 13 },
      weekend: { label: 'Fin de semana / festivo', es: 18, co: 15 },
    }
  }
  if (!carta.menuDay.weekday) carta.menuDay.weekday = { label: 'Entre semana' }
  if (!carta.menuDay.weekend) carta.menuDay.weekend = { label: 'Fin de semana / festivo' }
  if (esW && Number.isFinite(Number(esW.price))) carta.menuDay.weekday.es = Number(esW.price)
  if (coW && Number.isFinite(Number(coW.price))) carta.menuDay.weekday.co = Number(coW.price)
  if (esE && Number.isFinite(Number(esE.price))) carta.menuDay.weekend.es = Number(esE.price)
  if (coE && Number.isFinite(Number(coE.price))) carta.menuDay.weekend.co = Number(coE.price)
}

function deleteItemInCarta(carta, categoryId, itemId) {
  const catId = String(categoryId || '').trim()
  const id = String(itemId || '').trim()
  if (!catId || !id) throw new Error('categoryId e itemId son obligatorios')
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
  return String(process.env.CARTA_EDIT_PIN || '2908').trim()
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

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
  if (idx >= 0) cat.items[idx] = { ...cat.items[idx], ...normalized }
  else cat.items.push(normalized)
  next.updatedAt = Date.now()
  return next
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
          }),
        )
      }

      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          error: 'action inválida (seed|put|upsertItem)',
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

/**
 * Fotos de platos — seguro y gratis (Hobby).
 *
 * POST /api/carta-image  (sesión TPV o X-Tpv-Key)
 *   { action:'upload', itemId, contentType, dataBase64 }
 *   → { ok, publicUrl, backend: 'supabase-storage'|'ops_kv' }
 *
 * GET  /api/carta-image?item=<id>  (público)
 *   Sirve la imagen. Preferente Storage; si no hay service role,
 *   se guarda en ops_kv (misma DB gratis que la carta).
 *
 * Seguridad:
 * - Subida solo con sesión TPV (PIN).
 * - Lectura pública (las fotos del menú son públicas).
 * - Sin abrir INSERT anon en Storage.
 * - Service role solo en servidor (si está en Vercel).
 */
const {
  SUPABASE_URL,
  SUPABASE_KEY,
  hasSupabase,
  getJson,
  setJson,
} = require('./_opsStore')

const BUCKET = 'menu_images'
const MAX_BYTES = 220 * 1024
const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const IMG_KEY_PREFIX = 'menu_img:'
const ALLOWED = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Tpv-Key',
  )
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

function extFromMime(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

function safeItemId(id) {
  return (
    String(id || 'plato')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'plato'
  )
}

function imgStoreKey(itemId) {
  return IMG_KEY_PREFIX + safeItemId(itemId)
}

/** true si la key del servidor puede bypassear RLS de Storage */
function hasStorageWritePrivilege() {
  const k = String(SUPABASE_KEY || '')
  if (!k) return false
  if (k.startsWith('sb_secret_')) return true
  if (k.startsWith('sb_publishable_') || k.startsWith('sb_publi')) return false
  // JWT legacy (anon / service_role)
  try {
    const mid = k.split('.')[1]
    if (!mid) return false
    const json = Buffer.from(
      mid.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8')
    const payload = JSON.parse(json)
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

function publicStorageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

function publicOpsUrl(itemId, version) {
  const q = new URLSearchParams({
    item: safeItemId(itemId),
    v: String(version || Date.now()),
  })
  return `/api/carta-image?${q.toString()}`
}

function parseBody(req) {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}')
    } catch {
      body = {}
    }
  }
  return body || {}
}

function parseQuery(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const u = new URL(req.url || '/', `${proto}://${host}`)
    return u.searchParams
  } catch {
    return new URLSearchParams()
  }
}

async function storageUpload(path, buffer, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  })
  const text = await r.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!r.ok) {
    const msg =
      [data && data.error, data && data.message].filter(Boolean).join(' — ') ||
      `storage ${r.status}`
    throw new Error(String(msg))
  }
  return data
}

async function serveGet(req, res) {
  const params = parseQuery(req)
  const itemId = safeItemId(params.get('item') || '')
  if (!params.get('item') || !itemId) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'falta item' }))
  }
  if (!hasSupabase()) {
    res.statusCode = 503
    return res.end('supabase no configurado')
  }
  const row = await getJson(imgStoreKey(itemId), null, { fresh: true })
  if (!row || !row.dataBase64 || row.deleted) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'sin foto' }))
  }
  const mime = ALLOWED.has(row.contentType) ? row.contentType : 'image/jpeg'
  let buf
  try {
    buf = Buffer.from(String(row.dataBase64), 'base64')
  } catch {
    res.statusCode = 500
    return res.end('foto corrupta')
  }
  res.statusCode = 200
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.end(buf)
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET') {
    try {
      return await serveGet(req, res)
    } catch (err) {
      console.error('[carta-image] GET', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          error: String(err && err.message ? err.message : err),
        }),
      )
    }
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  }

  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: 'Sesión TPV caducada — vuelve a introducir el PIN',
      }),
    )
  }

  if (!hasSupabase()) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'supabase no configurado' }))
  }

  const body = parseBody(req)
  const action = String(body.action || 'upload').trim()

  try {
    if (action === 'remove') {
      const itemId = safeItemId(body.itemId)
      await setJson(imgStoreKey(itemId), {
        deleted: true,
        updatedAt: Date.now(),
      })
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: true, action: 'remove', itemId }))
    }

    if (action !== 'upload') {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'action inválida (upload|remove)' }))
    }

    const itemId = safeItemId(body.itemId)
    let contentType = String(body.contentType || '').toLowerCase().trim()
    if (contentType === 'image/jpg') contentType = 'image/jpeg'
    if (!ALLOWED.has(contentType)) {
      res.statusCode = 400
      return res.end(
        JSON.stringify({
          error: 'formato no permitido (jpeg, png, webp, gif)',
        }),
      )
    }

    const b64 = String(body.dataBase64 || '')
      .replace(/^data:[^;]+;base64,/, '')
      .replace(/\s/g, '')
    if (!b64) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'falta dataBase64' }))
    }

    let buffer
    try {
      buffer = Buffer.from(b64, 'base64')
    } catch {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'base64 inválido' }))
    }
    if (!buffer.length || buffer.length > MAX_BYTES) {
      res.statusCode = 400
      return res.end(
        JSON.stringify({
          error: `imagen demasiado grande (máx. ${Math.round(MAX_BYTES / 1024)} KB comprimidos)`,
        }),
      )
    }

    const version = Date.now()
    let publicUrl
    let backend
    let path = null

    if (hasStorageWritePrivilege()) {
      path = `${itemId}/${version}.${extFromMime(contentType)}`
      await storageUpload(path, buffer, contentType)
      publicUrl = publicStorageUrl(path)
      backend = 'supabase-storage'
      // Espejo ligero en ops_kv no necesario
    } else {
      // Plan gratis sin service role: misma DB ops_kv, puerta = PIN TPV
      await setJson(imgStoreKey(itemId), {
        itemId,
        contentType,
        dataBase64: buffer.toString('base64'),
        bytes: buffer.length,
        updatedAt: version,
      })
      publicUrl = publicOpsUrl(itemId, version)
      backend = 'ops_kv'
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    return res.end(
      JSON.stringify({
        ok: true,
        action: 'upload',
        itemId,
        path,
        publicUrl,
        backend,
        bytes: buffer.length,
      }),
    )
  } catch (err) {
    console.error('[carta-image]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: String(err && err.message ? err.message : err),
      }),
    )
  }
}

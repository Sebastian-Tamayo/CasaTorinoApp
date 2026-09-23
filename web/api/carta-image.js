/**
 * Fotos de platos → Supabase Storage bucket `menu_images`.
 *
 * POST /api/carta-image  (sesión TPV o X-Tpv-Key)
 *   { action: 'upload', itemId, contentType, dataBase64 }
 *   → { ok, publicUrl, path, backend: 'supabase-storage' }
 *   { action: 'remove', itemId, path? }
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en Vercel.
 * No hay fallback a ops_kv: la subida va siempre al bucket.
 *
 * Seguridad: mutaciones solo con PIN/sesión TPV; lectura pública del bucket.
 */
function cleanToken(raw) {
  let t = String(raw || '').trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1)
  }
  return t.trim()
}

const SUPABASE_URL = cleanToken(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
).replace(/\/$/, '')

/** Solo service role / secret — nunca anon para escribir en Storage */
const SERVICE_ROLE_KEY = cleanToken(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    '',
)

const BUCKET = 'menu_images'
const MAX_BYTES = 1.5 * 1024 * 1024
const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ALLOWED = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Tpv-Key',
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

function publicUrlFor(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
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

function assertStorageConfig() {
  if (!SUPABASE_URL) {
    throw Object.assign(new Error('Falta SUPABASE_URL en Vercel'), {
      status: 503,
    })
  }
  if (!SERVICE_ROLE_KEY) {
    const flags = {
      SERVICE_ROLE: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      SECRET: Boolean(process.env.SUPABASE_SECRET_KEY),
      ANON: Boolean(process.env.SUPABASE_ANON_KEY),
      URL: Boolean(process.env.SUPABASE_URL),
    }
    throw Object.assign(
      new Error(
        `Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en Vercel. Sin service role no se sube a menu_images. env=${JSON.stringify(flags)}`,
      ),
      { status: 503 },
    )
  }
}

async function storageUpload(path, buffer, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
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

async function storageRemove(itemId, path) {
  const prefixes = []
  if (path && !String(path).includes('..')) {
    prefixes.push(String(path).replace(/^\/+/, ''))
  }
  prefixes.push(`${safeItemId(itemId)}/`)
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}`
  const r = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes }),
  })
  if (!r.ok && r.status !== 404) {
    const text = await r.text()
    throw new Error(text || `storage delete ${r.status}`)
  }
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
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

  try {
    assertStorageConfig()
  } catch (err) {
    res.statusCode = err.status || 503
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: err.message }))
  }

  const body = parseBody(req)
  const action = String(body.action || 'upload').trim()

  try {
    if (action === 'remove') {
      const itemId = safeItemId(body.itemId)
      await storageRemove(itemId, body.path)
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
          error: `imagen demasiado grande (máx. ${Math.round(MAX_BYTES / 1024)} KB)`,
        }),
      )
    }

    const path = `${itemId}/${Date.now()}.${extFromMime(contentType)}`
    await storageUpload(path, buffer, contentType)
    const publicUrl = publicUrlFor(path)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        ok: true,
        action: 'upload',
        itemId,
        path,
        publicUrl,
        backend: 'supabase-storage',
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

/**
 * Subida de fotos de platos.
 * 1) Supabase Storage `menu_images` (ideal)
 * 2) Si RLS bloquea: data-URL inline (queda en image_url del JSON carta)
 *
 * POST /api/carta-image  (sesión TPV o X-Tpv-Key)
 */
const {
  SUPABASE_URL,
  SUPABASE_KEY,
  hasSupabase,
} = require('./_opsStore')

const BUCKET = 'menu_images'
const MAX_BYTES = 1.5 * 1024 * 1024
const INLINE_MAX = 220 * 1024 // ~220 KB para guardar en ops_kv sin Storage
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

function storageErrorMessage(data, status) {
  if (!data || typeof data !== 'object') {
    return typeof data === 'string' && data ? data : `storage ${status}`
  }
  const parts = [data.error, data.message, data.msg].filter(
    (x) => x != null && String(x).trim(),
  )
  return parts.length ? parts.map(String).join(' — ') : `storage ${status}`
}

function isRlsBlocked(msg, status) {
  return (
    status === 403 ||
    status === 401 ||
    /row-level security|RLS|AccessDenied|Unauthorized|not allowed/i.test(
      String(msg || ''),
    )
  )
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
    const msg = storageErrorMessage(data, r.status)
    const err = new Error(msg)
    err.status = r.status
    err.rls = isRlsBlocked(msg, r.status)
    throw err
  }
  return data
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

  const body = parseBody(req)
  const action = String(body.action || 'upload').trim()

  try {
    if (action === 'remove') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: true, action: 'remove' }))
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

    const ext = extFromMime(contentType)
    const path = `${itemId}/${Date.now()}.${ext}`

    let publicUrl = null
    let backend = 'supabase'
    let storedPath = path

    if (hasSupabase() && SUPABASE_URL && SUPABASE_KEY) {
      try {
        await storageUpload(path, buffer, contentType)
        publicUrl = publicUrlFor(path)
      } catch (err) {
        console.warn('[carta-image] supabase storage', err && err.message)
        if (err && err.rls) {
          // Fallback: embeber en image_url (ops_kv). Mejor comprimir en el TPV.
          if (buffer.length > INLINE_MAX) {
            throw new Error(
              'Supabase Storage bloqueado (RLS) y la foto es grande para guardar inline. Ejecuta en SQL Editor: web/supabase/008b_menu_images_anon_upload.sql — o elige una foto más ligera (<200 KB).',
            )
          }
          publicUrl = `data:${contentType};base64,${buffer.toString('base64')}`
          storedPath = `inline:${itemId}`
          backend = 'inline'
        } else {
          throw err
        }
      }
    } else {
      if (buffer.length > INLINE_MAX) {
        res.statusCode = 503
        return res.end(
          JSON.stringify({
            error: 'supabase no configurado y la foto es demasiado grande',
          }),
        )
      }
      publicUrl = `data:${contentType};base64,${buffer.toString('base64')}`
      storedPath = `inline:${itemId}`
      backend = 'inline'
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        ok: true,
        action: 'upload',
        path: storedPath,
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

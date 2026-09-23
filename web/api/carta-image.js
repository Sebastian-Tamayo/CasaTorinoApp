/**
 * Subida de fotos de platos → Supabase Storage bucket `menu_images`.
 *
 * POST /api/carta-image  (sesión TPV o X-Tpv-Key)
 *   { action: 'upload', itemId, contentType, dataBase64, filename? }
 *   → { ok, publicUrl, path }
 *   { action: 'remove', path }  — opcional, borra objeto del bucket
 *
 * La URL pública se guarda en el JSON del plato (`image_url`) vía /api/carta.
 * No se usa el SDK en el navegador: las claves quedan en el servidor.
 */
const {
  SUPABASE_URL,
  SUPABASE_KEY,
  hasSupabase,
} = require('./_opsStore')

const BUCKET = 'menu_images'
const MAX_BYTES = 1.5 * 1024 * 1024 // 1,5 MB
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
  return String(id || 'plato')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'plato'
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
      (data && (data.error || data.message || data.msg)) ||
      `storage ${r.status}`
    const hint =
      /row-level security|RLS|not allowed|403|401/i.test(String(msg)) ||
      r.status === 403 ||
      r.status === 401
        ? ' · Ejecuta web/supabase/008b_menu_images_anon_upload.sql o añade SUPABASE_SERVICE_ROLE_KEY en Vercel'
        : ''
    throw new Error(String(msg) + hint)
  }
  return data
}

async function storageRemove(path) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}`
  const r = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [path] }),
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
    return res.end(JSON.stringify({ error: 'unauthorized' }))
  }
  if (!hasSupabase() || !SUPABASE_URL || !SUPABASE_KEY) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'supabase no configurado' }))
  }

  const body = parseBody(req)
  const action = String(body.action || 'upload').trim()

  try {
    if (action === 'remove') {
      const path = String(body.path || '').replace(/^\/+/, '').trim()
      if (!path || path.includes('..')) {
        res.statusCode = 400
        return res.end(JSON.stringify({ error: 'path inválido' }))
      }
      await storageRemove(path)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: true, action: 'remove', path }))
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
    await storageUpload(path, buffer, contentType)
    const publicUrl = publicUrlFor(path)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        ok: true,
        action: 'upload',
        path,
        publicUrl,
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

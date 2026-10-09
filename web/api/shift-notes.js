/**
 * Casa Torino — Notas de turno (cambio de personal)
 *
 * GET  /api/shift-notes
 *   → { ok, notes: [{ id, category, content, created_at, is_completed }] }
 *   Solo notas con is_completed = false.
 *
 * POST /api/shift-notes
 *   { action: 'create', category: 'proveedor'|'general', content }
 *   { action: 'complete', id }
 *   { action: 'delete', id }
 *
 * Auth: sesión TPV (cookie ct_tpv_session) o X-Tpv-Key.
 * Persistencia: Supabase tabla public.shift_notes vía service role (bypass RLS).
 */
const { applySecurityHeaders } = require('./_securityHeaders')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const CATEGORIES = new Set(['proveedor', 'general'])
const CONTENT_MAX = 500

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

/** Prefer service role — RLS deniega anon en shift_notes */
const SUPABASE_KEY = cleanToken(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    '',
)

function cors(res) {
  applySecurityHeaders(res)
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

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body
}

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function sbFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const err = new Error(
      'Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel',
    )
    err.status = 500
    throw err
  }
  const url = `${SUPABASE_URL}/rest/v1/${path.replace(/^\//, '')}`
  const r = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  })
  const text = await r.text()
  let data = null
  if (text && text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!r.ok) {
    const msg =
      (data && data.message) ||
      (data && data.error) ||
      (typeof data === 'string' ? data : '') ||
      `supabase ${r.status}`
    const err = new Error(msg)
    err.status = r.status
    err.body = data
    throw err
  }
  return data
}

async function listActive() {
  const rows = await sbFetch(
    'shift_notes?is_completed=eq.false&select=id,category,content,created_at,is_completed&order=created_at.desc',
    { method: 'GET' },
  )
  return Array.isArray(rows) ? rows : []
}

async function createNote(category, content) {
  const rows = await sbFetch('shift_notes', {
    method: 'POST',
    body: JSON.stringify({
      category,
      content,
      is_completed: false,
    }),
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function completeNote(id) {
  const rows = await sbFetch(
    `shift_notes?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        is_completed: true,
        completed_at: new Date().toISOString(),
      }),
    },
  )
  return Array.isArray(rows) ? rows[0] : rows
}

async function deleteNote(id) {
  await sbFetch(`shift_notes?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  return true
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (!authorized(req)) {
    return json(res, 401, { ok: false, error: 'No autorizado' })
  }

  try {
    if (req.method === 'GET') {
      const notes = await listActive()
      return json(res, 200, {
        ok: true,
        notes,
        counts: {
          proveedor: notes.filter((n) => n.category === 'proveedor').length,
          general: notes.filter((n) => n.category === 'general').length,
          total: notes.length,
        },
      })
    }

    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, error: 'Método no permitido' })
    }

    const body = parseBody(req)
    const action = String(body.action || '').trim()

    if (action === 'create') {
      const category = String(body.category || '').trim()
      const content = String(body.content || '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!CATEGORIES.has(category)) {
        return json(res, 400, {
          ok: false,
          error: 'category debe ser proveedor o general',
        })
      }
      if (!content) {
        return json(res, 400, { ok: false, error: 'Escribe el texto de la nota' })
      }
      if (content.length > CONTENT_MAX) {
        return json(res, 400, {
          ok: false,
          error: `Máximo ${CONTENT_MAX} caracteres`,
        })
      }
      const note = await createNote(category, content)
      return json(res, 200, { ok: true, note })
    }

    if (action === 'complete') {
      const id = String(body.id || '').trim()
      if (!id) return json(res, 400, { ok: false, error: 'id requerido' })
      const note = await completeNote(id)
      if (!note) {
        return json(res, 404, { ok: false, error: 'Nota no encontrada' })
      }
      return json(res, 200, { ok: true, note })
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim()
      if (!id) return json(res, 400, { ok: false, error: 'id requerido' })
      await deleteNote(id)
      return json(res, 200, { ok: true })
    }

    return json(res, 400, {
      ok: false,
      error: 'action inválida (create|complete|delete)',
    })
  } catch (err) {
    console.error('[shift-notes]', err)
    const status = err && err.status >= 400 && err.status < 600 ? err.status : 500
    return json(res, status, {
      ok: false,
      error: String(err && err.message ? err.message : err),
    })
  }
}

/**
 * Casa Torino — almacén operativo 24/7
 * Backend: Supabase (tabla public.ops_kv) — plan gratis
 *
 * Claves: kitchen | tpv | jornada | cierres
 *
 * Env (Vercel proyecto casa-torino-web):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY   (o SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY)
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
const SUPABASE_KEY = cleanToken(
  process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '',
)

const MEM_TTL_MS = 400

/** @type {Record<string, { value: any, at: number }>} */
const memory = Object.create(null)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assertConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Falta SUPABASE_URL / SUPABASE_ANON_KEY (o SECRET) en Vercel',
    )
  }
}

function restHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Prefer: 'return=representation',
    ...extra,
  }
}

async function sbFetch(path, options = {}) {
  assertConfig()
  const url = `${SUPABASE_URL}/rest/v1/${path.replace(/^\//, '')}`
  let lastErr = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, {
        ...options,
        headers: restHeaders(options.headers || {}),
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
    } catch (err) {
      lastErr = err
      if (err && err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err
      }
      await sleep(80 * attempt * attempt)
    }
  }
  throw lastErr || new Error('supabase fetch failed')
}

async function readRow(key) {
  const rows = await sbFetch(
    `ops_kv?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at`,
    { method: 'GET', headers: { Prefer: 'return=representation' } },
  )
  if (!Array.isArray(rows) || !rows.length) return null
  return rows[0]
}

async function writeRow(key, value) {
  const payload = {
    key: String(key),
    value,
    updated_at: new Date().toISOString(),
  }
  // Upsert por PK
  const rows = await sbFetch('ops_kv?on_conflict=key', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  })
  memory[key] = { value, at: Date.now() }
  return Array.isArray(rows) ? rows[0] : payload
}

/**
 * @param {string} key
 * @param {any|Function} fallback
 * @param {{ fresh?: boolean }} [opts]
 */
async function getJson(key, fallback, opts = {}) {
  const fresh = Boolean(opts.fresh)
  if (!fresh) {
    const cached = memory[key]
    if (cached && cached.value != null && Date.now() - cached.at < MEM_TTL_MS) {
      return cached.value
    }
  }

  let value = null
  try {
    const row = await readRow(key)
    if (row && row.value != null) value = row.value
  } catch (err) {
    console.warn('[opsStore] get', key, err)
    throw err
  }

  if (value == null) {
    value = typeof fallback === 'function' ? fallback() : fallback
  }
  memory[key] = { value, at: Date.now() }
  return value
}

async function setJson(key, value) {
  await writeRow(key, value)
  return value
}

/**
 * Read-modify-write con reintento ANTES de escribir.
 * No re-ejecuta el mutator tras un put exitoso (evita duplicar comandas).
 */
async function updateJson(key, fallback, mutator) {
  let lastErr = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    const current = await getJson(key, fallback, { fresh: true })
    const baseVersion = Number(
      current && typeof current === 'object' ? current.updatedAt || 0 : 0,
    )
    const base =
      current && typeof current === 'object'
        ? JSON.parse(JSON.stringify(current))
        : typeof fallback === 'function'
          ? fallback()
          : fallback
    const next = await mutator(base)
    if (!next || typeof next !== 'object') {
      throw new Error('updateJson mutator must return object')
    }
    const latest = await getJson(key, fallback, { fresh: true })
    const latestVersion = Number(
      latest && typeof latest === 'object' ? latest.updatedAt || 0 : 0,
    )
    if (latestVersion !== baseVersion) {
      lastErr = new Error('updateJson conflict')
      await sleep(35 * attempt * attempt)
      continue
    }
    next.updatedAt = Date.now()
    await setJson(key, next)
    return next
  }
  throw lastErr || new Error('updateJson conflict')
}

module.exports = {
  getJson,
  setJson,
  updateJson,
  hasBlob: () => false,
  getBackend: () => (SUPABASE_URL && SUPABASE_KEY ? 'supabase' : 'none'),
  hasSupabase: () => Boolean(SUPABASE_URL && SUPABASE_KEY),
}

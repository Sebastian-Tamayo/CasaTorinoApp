/**
 * Casa Torino — almacén operativo 24/7
 *
 * Preferencia:
 * 1) Vercel Blob (privado) si está activo
 * 2) Edge Config (fallback automático si Blob está suspendido / sin cuota)
 *
 * El polling agresivo agotó la Store Blob Hobby → quedó "suspended".
 * Con este fallback el TPV/cocina siguen funcionando.
 */
const { put, get } = require('@vercel/blob')

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

const BLOB_TOKEN = cleanToken(process.env.BLOB_READ_WRITE_TOKEN || '')
const EDGE_ID = process.env.TPV_EDGE_CONFIG_ID
const TEAM_ID = process.env.TPV_TEAM_ID
const VERCEL_TOKEN = process.env.TPV_VERCEL_TOKEN
const FORCE_EDGE = /^(1|true|yes)$/i.test(String(process.env.OPS_FORCE_EDGE || ''))
const MEM_TTL_MS = 500

/** @type {Record<string, { value: any, at: number }>} */
const memory = Object.create(null)

/** Sticky: una vez Blob falla por suspensión, no insistir (ahorra tiempo y errores) */
let blobDisabled = FORCE_EDGE || !BLOB_TOKEN
let backend = blobDisabled ? 'edge' : 'blob'

function pathnameFor(key) {
  return `casa-torino-ops/${String(key).replace(/[^a-z0-9_-]/gi, '')}.json`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBlobSuspendedError(err) {
  const msg = String(err && err.message ? err.message : err)
  return /suspended|blocked|usage.?threshold|limits?.?reached|quota|billingState/i.test(
    msg,
  )
}

function markBlobDown(err) {
  if (!isBlobSuspendedError(err) && !/forbidden|unauthorized/i.test(String(err))) {
    return
  }
  blobDisabled = true
  backend = 'edge'
  console.warn('[opsStore] Blob no usable → Edge Config', String(err && err.message ? err.message : err))
}

async function readEdge(key) {
  if (!EDGE_ID || !VERCEL_TOKEN) return null
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/item/${encodeURIComponent(key)}` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      cache: 'no-store',
    })
    if (r.status === 404 || r.status === 204) return null
    if (!r.ok) return null
    const text = await r.text()
    if (!text || !text.trim()) return null
    const data = JSON.parse(text)
    if (data && typeof data === 'object' && 'value' in data) return data.value
    return data
  } catch {
    return null
  }
}

async function writeEdge(key, value) {
  if (!EDGE_ID || !VERCEL_TOKEN) {
    throw new Error('Edge Config no configurado (TPV_EDGE_CONFIG_ID / TPV_VERCEL_TOKEN)')
  }
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/items` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  let lastErr = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ operation: 'upsert', key: String(key), value }],
        }),
      })
      const text = await r.text()
      if (!r.ok) {
        throw new Error(text || `edge PATCH ${r.status}`)
      }
      memory[key] = { value, at: Date.now() }
      backend = 'edge'
      return value
    } catch (err) {
      lastErr = err
      await sleep(120 * attempt * attempt)
    }
  }
  throw lastErr || new Error('edge PUT failed')
}

async function blobGet(key) {
  if (blobDisabled || !BLOB_TOKEN) return null
  const pathname = pathnameFor(key)
  try {
    const result = await get(pathname, {
      access: 'private',
      token: BLOB_TOKEN,
      useCache: false,
    })
    if (!result || result.statusCode === 404 || result.statusCode === 304) {
      return null
    }
    if (result.stream) {
      const text = await new Response(result.stream).text()
      return text ? JSON.parse(text) : null
    }
    if (typeof result.json === 'function') return await result.json()
    if (typeof result.text === 'function') {
      const text = await result.text()
      return text ? JSON.parse(text) : null
    }
    if (result.body) {
      const text = await new Response(result.body).text()
      return text ? JSON.parse(text) : null
    }
    return null
  } catch (err) {
    const msg = String(err && err.message ? err.message : err)
    if (/404|not found|BlobNotFound/i.test(msg)) return null
    markBlobDown(err)
    throw err
  }
}

async function blobPut(key, value) {
  if (blobDisabled || !BLOB_TOKEN) {
    throw new Error('blob disabled')
  }
  const pathname = pathnameFor(key)
  const body = JSON.stringify(value)
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await put(pathname, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        token: BLOB_TOKEN,
        cacheControlMaxAge: 0,
      })
      memory[key] = { value, at: Date.now() }
      backend = 'blob'
      return value
    } catch (err) {
      lastErr = err
      markBlobDown(err)
      if (blobDisabled) break
      const msg = String(err && err.message ? err.message : err)
      if (
        /missing|unauthorized|forbidden|invalid|suspended/i.test(msg) &&
        !/rate|429|503|502|timeout/i.test(msg)
      ) {
        break
      }
      await sleep(150 * attempt * attempt)
    }
  }
  throw lastErr || new Error('blob PUT failed')
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

  if (!blobDisabled) {
    try {
      value = await blobGet(key)
    } catch (err) {
      console.warn('[opsStore] blobGet', key, err)
    }
  }

  // Si Blob está caído/suspendido o no hay dato → Edge Config
  if (value == null) {
    try {
      value = await readEdge(key)
      if (value != null) backend = blobDisabled ? 'edge' : backend
    } catch (err) {
      console.warn('[opsStore] edgeGet', key, err)
    }
  }

  if (value == null) {
    value = typeof fallback === 'function' ? fallback() : fallback
  }
  memory[key] = { value, at: Date.now() }
  return value
}

async function setJson(key, value) {
  // Intentar Blob; si está suspendido / falla, Edge Config
  if (!blobDisabled) {
    try {
      await blobPut(key, value)
      return value
    } catch (err) {
      console.warn('[opsStore] blobPut → edge', key, err)
    }
  }
  await writeEdge(key, value)
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
  pathnameFor,
  hasBlob: () => Boolean(BLOB_TOKEN) && !blobDisabled,
  getBackend: () => backend,
}

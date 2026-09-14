/**
 * Casa Torino — almacén operativo 24/7
 * Vercel Blob (privado). Edge Config solo como migración única (lectura).
 *
 * Importante:
 * - @vercel/blob v2 `get()` devuelve { stream }, NO .json()
 * - Hay que usar useCache:false o las lecturas ven datos viejos (CDN HIT)
 * - Caché en memoria solo milisegundos (misma invocación)
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
const MEM_TTL_MS = 400

/** @type {Record<string, { value: any, at: number }>} */
const memory = Object.create(null)
/** Evita re-migrar Edge→Blob en bucle */
const migrated = Object.create(null)

function pathnameFor(key) {
  return `casa-torino-ops/${String(key).replace(/[^a-z0-9_-]/gi, '')}.json`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readEdgeLegacy(key) {
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

async function blobGet(key) {
  if (!BLOB_TOKEN) return null
  const pathname = pathnameFor(key)
  try {
    // useCache:false → origen fresco (imprescindible para Listo / jornada)
    const result = await get(pathname, {
      access: 'private',
      token: BLOB_TOKEN,
      useCache: false,
    })
    if (!result || result.statusCode === 404 || result.statusCode === 304) {
      return null
    }
    // SDK v2: stream; v1 legacy: json/text/body
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
    throw err
  }
}

async function blobPut(key, value) {
  if (!BLOB_TOKEN) throw new Error('missing BLOB_READ_WRITE_TOKEN')
  const pathname = pathnameFor(key)
  const body = JSON.stringify(value)
  let lastErr = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await put(pathname, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        token: BLOB_TOKEN,
        // Evitar CDN largo: los clientes hacen RMW frecuente
        cacheControlMaxAge: 0,
      })
      memory[key] = { value, at: Date.now() }
      return value
    } catch (err) {
      lastErr = err
      const msg = String(err && err.message ? err.message : err)
      if (
        /missing|unauthorized|forbidden|invalid/i.test(msg) &&
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
  let blobFailed = false
  try {
    value = await blobGet(key)
  } catch (err) {
    blobFailed = true
    console.warn('[opsStore] blobGet', key, err)
  }

  // Con Blob activo NO leemos Edge Config: era la causa de pisar datos frescos
  // (Listo / jornada) con copias viejas cacheadas en Edge.
  // Solo si no hay token Blob se contempla legacy.
  if (value == null && !blobFailed && !BLOB_TOKEN && !migrated[key]) {
    const legacy = await readEdgeLegacy(key)
    migrated[key] = true
    if (legacy != null) value = legacy
  }

  if (value == null) {
    value = typeof fallback === 'function' ? fallback() : fallback
  }
  memory[key] = { value, at: Date.now() }
  return value
}

async function setJson(key, value) {
  await blobPut(key, value)
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
    // Si otro proceso escribió mientras mutábamos, reintentar sin put
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
  hasBlob: () => Boolean(BLOB_TOKEN),
}

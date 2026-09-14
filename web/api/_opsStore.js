/**
 * Casa Torino — almacén operativo (sustituye Edge Config para escrituras).
 * Usa @vercel/blob porque Edge Config free quedó rate-limited (429).
 */
const { put, get } = require('@vercel/blob')

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || ''
const EDGE_ID = process.env.TPV_EDGE_CONFIG_ID
const TEAM_ID = process.env.TPV_TEAM_ID
const VERCEL_TOKEN = process.env.TPV_VERCEL_TOKEN

/** @type {Record<string, { value: any, at: number }>} */
const memory = Object.create(null)

function pathnameFor(key) {
  return `casa-torino-ops/${String(key).replace(/[^a-z0-9_-]/gi, '')}.json`
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
    const result = await get(pathname, { access: 'private', token: BLOB_TOKEN })
    if (!result || result.statusCode === 404) return null
    // get() returns a Response-like or stream depending on version
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
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await put(pathname, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        token: BLOB_TOKEN,
      })
      memory[key] = { value, at: Date.now() }
      return value
    } catch (err) {
      lastErr = err
      await new Promise((resolve) => setTimeout(resolve, 120 * attempt))
    }
  }
  throw lastErr || new Error('blob PUT failed')
}

async function getJson(key, fallback) {
  const cached = memory[key]
  if (cached && cached.value != null) return cached.value

  let value = null
  try {
    value = await blobGet(key)
  } catch (err) {
    console.warn('[opsStore] blobGet', key, err)
  }

  if (value == null) {
    const legacy = await readEdgeLegacy(key)
    if (legacy != null) {
      value = legacy
      blobPut(key, legacy).catch((err) =>
        console.warn('[opsStore] migrate', key, err),
      )
    }
  }

  if (value == null) value = typeof fallback === 'function' ? fallback() : fallback
  memory[key] = { value, at: Date.now() }
  return value
}

async function setJson(key, value) {
  await blobPut(key, value)
  return value
}

module.exports = {
  getJson,
  setJson,
  pathnameFor,
  hasBlob: () => Boolean(BLOB_TOKEN),
}

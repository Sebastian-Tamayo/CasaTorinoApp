/**
 * Casa Torino TPV — sync de mesas entre dispositivos.
 * Persistencia: Vercel Blob (opsStore), clave `tpv`.
 */
const { getJson, setJson } = require('./_opsStore')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'tpv'

function cors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Tpv-Key, Cache-Control',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function emptyState() {
  return { kind: 'casa-torino-tpv', tables: {}, mesa: '', updatedAt: 0, clientId: null }
}

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
}

function authorized(req) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return true
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  return Boolean(SYNC_KEY && key && key === SYNC_KEY)
}

module.exports = async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (!authorized(req)) {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: 'unauthorized' }))
  }

  try {
    if (req.method === 'GET') {
      const state = (await getJson(ITEM_KEY, emptyState, { fresh: true })) || emptyState()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(state || emptyState()))
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {}
      const incomingAt = Number(body.updatedAt || Date.now())
      const current = (await getJson(ITEM_KEY, emptyState, { fresh: true })) || emptyState()
      if (Number(current.updatedAt || 0) > incomingAt) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(current))
      }
      const next = {
        kind: 'casa-torino-tpv',
        tables: body.tables && typeof body.tables === 'object' ? body.tables : {},
        mesa: typeof body.mesa === 'string' ? body.mesa : '',
        updatedAt: incomingAt,
        clientId: body.clientId || null,
      }
      await setJson(ITEM_KEY, next)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(next))
    }

    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[tpv-sync]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({ error: String(err && err.message ? err.message : err) }),
    )
  }
}

/**
 * Casa Torino TPV — PIN personal por camarera (4 dígitos).
 *
 * Persistencia: ops_kv clave `waiter_pins` (solo servidor; no expone hash al cliente).
 *
 * GET  /api/waiter-pin?waiterId=… → { hasPin }
 * GET  /api/waiter-pin → { waiters: [{ id, hasPin }] }
 *
 * POST { action: 'verify'|'setup'|'change'|'delete', waiterId, pin?, pinConfirm?, currentPin?, newPin? }
 *
 * Auth: cookie sesión TPV o X-Tpv-Key (TPV_SYNC_KEY).
 */
const crypto = require('crypto')
const { applySecurityHeaders } = require('./_securityHeaders')
const { hasTpvSession } = require('./_tpvSession')
const { getJson, updateJson } = require('./_opsStore')
const tpvVersion = require('./_tpvVersion')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'waiter_pins'
const PBKDF2_ITERS = 120000

function cors(req, res) {
  applySecurityHeaders(res)
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Tpv-Key, Cache-Control, X-Tpv-Client-Version',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function authorized(req) {
  if (req.method === 'OPTIONS') return true
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  return Boolean(SYNC_KEY && key && key === SYNC_KEY)
}

function emptyStore() {
  return { kind: 'casa-torino-waiter-pins', pins: {}, updatedAt: 0 }
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

function validPin(pin) {
  const p = String(pin || '').trim()
  return /^\d{4}$/.test(p)
}

function hashPin(pin, saltHex) {
  const salt = Buffer.from(saltHex, 'hex')
  return crypto.pbkdf2Sync(String(pin), salt, PBKDF2_ITERS, 32, 'sha256').toString('hex')
}

function verifyStored(pin, entry) {
  if (!entry || !entry.salt || !entry.hash) return false
  const h = hashPin(pin, entry.salt)
  try {
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(entry.hash, 'hex'))
  } catch {
    return false
  }
}

function pinEntry() {
  const salt = crypto.randomBytes(16).toString('hex')
  return { salt, hash: '', updatedAt: Date.now() }
}

function setPinHash(entry, pin) {
  entry.hash = hashPin(pin, entry.salt)
  entry.updatedAt = Date.now()
  return entry
}

function listHasPin(store, waiterId) {
  const id = String(waiterId || '').trim()
  if (!id) return false
  return Boolean(store.pins && store.pins[id] && store.pins[id].hash)
}

module.exports = async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ ok: false, error: 'Sesión caducada' }))
  }

  try {
    if (req.method === 'GET') {
      const store = await getJson(ITEM_KEY, emptyStore, { fresh: true })
      const qid = String(req.query?.waiterId || '').trim()
      if (qid) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, hasPin: listHasPin(store, qid) }))
      }
      const pins = store.pins || {}
      const waiters = Object.keys(pins).map((id) => ({
        id,
        hasPin: Boolean(pins[id]?.hash),
      }))
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: true, waiters }))
    }

    if (req.method === 'POST') {
      if (tpvVersion.rejectIfClientOutdated(req, res)) return

      const body = parseBody(req)
      const action = String(body.action || '').trim()
      const waiterId = String(body.waiterId || '').trim()
      if (!waiterId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: false, error: 'Falta waiterId' }))
      }

      if (action === 'verify') {
        const pin = body.pin
        if (!validPin(pin)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ ok: false, error: 'PIN de 4 dígitos' }))
        }
        const store = await getJson(ITEM_KEY, emptyStore, { fresh: true })
        const entry = store.pins?.[waiterId]
        if (!entry?.hash) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ ok: false, error: 'Esta camarera aún no tiene PIN' }),
          )
        }
        if (!verifyStored(pin, entry)) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ ok: false, error: 'PIN incorrecto' }))
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true }))
      }

      if (action === 'setup') {
        const pin = body.pin
        const pinConfirm = body.pinConfirm != null ? body.pinConfirm : body.pin2
        if (!validPin(pin) || pin !== String(pinConfirm || '').trim()) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ ok: false, error: 'Los dos PIN deben coincidir (4 dígitos)' }),
          )
        }
        let created = false
        await updateJson(ITEM_KEY, emptyStore, (store) => {
          if (!store.pins || typeof store.pins !== 'object') store.pins = {}
          if (store.pins[waiterId]?.hash) {
            const err = new Error('already')
            err.code = 'ALREADY'
            throw err
          }
          const entry = pinEntry()
          setPinHash(entry, pin)
          store.pins[waiterId] = entry
          store.updatedAt = Date.now()
          created = true
          return store
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, created }))
      }

      if (action === 'change') {
        const currentPin = body.currentPin
        const newPin = body.newPin
        if (!validPin(currentPin) || !validPin(newPin)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ ok: false, error: 'PIN de 4 dígitos' }))
        }
        if (currentPin === newPin) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ ok: false, error: 'El PIN nuevo debe ser distinto' }))
        }
        try {
          await updateJson(ITEM_KEY, emptyStore, (store) => {
            if (!store.pins || typeof store.pins !== 'object') store.pins = {}
            const entry = store.pins[waiterId]
            if (!entry?.hash) {
              const err = new Error('no_pin')
              err.code = 'NO_PIN'
              throw err
            }
            if (!verifyStored(currentPin, entry)) {
              const err = new Error('bad_pin')
              err.code = 'BAD_PIN'
              throw err
            }
            setPinHash(entry, newPin)
            store.updatedAt = Date.now()
            return store
          })
        } catch (e) {
          if (e.code === 'NO_PIN') {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ ok: false, error: 'Sin PIN — créalo al entrar' }))
          }
          if (e.code === 'BAD_PIN') {
            res.statusCode = 401
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ ok: false, error: 'PIN actual incorrecto' }))
          }
          throw e
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true }))
      }

      if (action === 'delete') {
        await updateJson(ITEM_KEY, emptyStore, (store) => {
          if (!store.pins || typeof store.pins !== 'object') store.pins = {}
          delete store.pins[waiterId]
          store.updatedAt = Date.now()
          return store
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true }))
      }

      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: false, error: 'Acción no válida' }))
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    if (err && err.code === 'ALREADY') {
      res.statusCode = 409
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ok: false, error: 'Ya tiene PIN — usa Cambiar PIN' }))
    }
    console.error('[waiter-pin]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ ok: false, error: 'waiter-pin error' }))
  }
}

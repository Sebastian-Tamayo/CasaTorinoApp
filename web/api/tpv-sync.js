/**
 * Casa Torino TPV — sync de mesas entre dispositivos.
 * Persistencia: Supabase ops_kv (opsStore), clave `tpv`.
 *
 * Limpieza diaria 09:00 Europe/Madrid: vacía cuentas/histórico de mesas
 * (rollover en GET/POST + cron /api/ops-daily-purge).
 */
const { getJson, setJson, updateJson } = require('./_opsStore')
const { opsDayId, applyTpvDayRollover } = require('./_opsDay')

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
  return {
    kind: 'casa-torino-tpv',
    tables: {},
    mesa: '',
    opsDay: opsDayId(),
    updatedAt: 0,
    clientId: null,
  }
}

function cartQty(table) {
  let n = 0
  const cart = table && table.cart
  if (!cart || typeof cart !== 'object') return 0
  for (const line of Object.values(cart)) n += Math.max(0, Number(line?.qty) || 0)
  return n
}

function tablesQty(tables) {
  let n = 0
  if (!tables || typeof tables !== 'object') return 0
  for (const t of Object.values(tables)) n += cartQty(t)
  return n
}

/**
 * Fusiona mesas en servidor: un POST vacío NUNCA borra cuentas con productos.
 * Por mesa, si una parte está vacía y la otra no, gana la que tiene cuenta.
 * Si ambas tienen qty, gana `preferred` (LWW del cliente más reciente).
 */
function mergeTables(serverTables, incomingTables, preferIncoming) {
  const server = serverTables && typeof serverTables === 'object' ? serverTables : {}
  const incoming =
    incomingTables && typeof incomingTables === 'object' ? incomingTables : {}
  const sTotal = tablesQty(server)
  const iTotal = tablesQty(incoming)

  // Cliente sin mesas (refresh antes de hidratar) no puede vaciar el servidor.
  if (Object.keys(incoming).length === 0 && sTotal > 0) {
    return { tables: server, rejectedEmpty: true }
  }
  if (iTotal === 0 && sTotal > 0 && !preferIncoming) {
    return { tables: server, rejectedEmpty: true }
  }
  // Preferencia LWW: si el cliente manda todo vacío CON claves de mesa
  // (cobros reales), se acepta abajo mesa a mesa.

  const keys = new Set([...Object.keys(server), ...Object.keys(incoming)])
  const out = {}
  for (const k of keys) {
    const S = server[k]
    const I = incoming[k]
    const sq = cartQty(S)
    const iq = cartQty(I)
    if (iq === 0 && sq > 0 && !Object.prototype.hasOwnProperty.call(incoming, k)) {
      // Mesa solo en servidor: conservar
      out[k] = S
    } else if (iq === 0 && sq > 0 && preferIncoming && Object.prototype.hasOwnProperty.call(incoming, k)) {
      // Cliente vació esa mesa a propósito (cobro / vaciar cuenta)
      out[k] = I
    } else if (sq === 0 && iq > 0) {
      out[k] = I
    } else if (iq > 0 && sq > 0) {
      out[k] = preferIncoming ? I : S
    } else if (I) {
      out[k] = I
    } else if (S) {
      out[k] = S
    }
  }
  return { tables: out, rejectedEmpty: false }
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

async function loadTpvState() {
  const current = (await getJson(ITEM_KEY, emptyState, { fresh: true })) || emptyState()
  const { state, changed } = applyTpvDayRollover(current)
  if (changed) {
    try {
      await setJson(ITEM_KEY, state)
    } catch (err) {
      console.warn('[tpv-sync] day rollover', err)
    }
  }
  return state
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
      const state = await loadTpvState()
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
      const day = opsDayId()

      const next = await updateJson(ITEM_KEY, emptyState, (raw) => {
        const { state: rolled } = applyTpvDayRollover(raw)
        const serverDay = rolled.opsDay || day
        const incomingDay = body.opsDay ? String(body.opsDay) : null
        const incomingTables =
          body.tables && typeof body.tables === 'object' ? body.tables : {}

        // Cliente de otro día no puede repoblar tras la limpieza de las 09:00.
        if (incomingDay && incomingDay !== serverDay) {
          return { ...rolled, opsDay: serverDay }
        }

        const serverAt = Number(rolled.updatedAt || 0)
        const preferIncoming = !(serverAt > incomingAt)
        const merged = mergeTables(rolled.tables, incomingTables, preferIncoming)

        // POST {} vacío con reloj adelantado: mantener servidor intacto.
        if (merged.rejectedEmpty) {
          return { ...rolled, opsDay: serverDay }
        }

        if (!preferIncoming) {
          return { ...rolled, opsDay: serverDay }
        }

        return {
          kind: 'casa-torino-tpv',
          tables: merged.tables,
          mesa:
            typeof body.mesa === 'string' && body.mesa
              ? body.mesa
              : rolled.mesa || '',
          opsDay: serverDay,
          updatedAt: incomingAt,
          clientId: body.clientId || null,
        }
      })

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

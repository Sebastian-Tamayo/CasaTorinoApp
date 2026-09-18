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
        const incomingCount = Object.keys(incomingTables).length

        // Cliente de otro día (o legacy sin opsDay con mesas) no puede
        // repoblar tras la limpieza de las 09:00.
        if (incomingDay && incomingDay !== serverDay) {
          return { ...rolled, opsDay: serverDay }
        }
        if (!incomingDay && incomingCount > 0 && serverDay === day) {
          // Legacy: solo aceptar si el servidor aún no ha sellado un purge
          // (mesas no vacías) o si gana LWW sobre estado no vacío.
          const serverCount = Object.keys(rolled.tables || {}).length
          if (serverCount === 0 && Number(rolled.updatedAt || 0) > 0) {
            return { ...rolled, opsDay: serverDay }
          }
        }

        if (Number(rolled.updatedAt || 0) > incomingAt) {
          return { ...rolled, opsDay: serverDay }
        }
        return {
          kind: 'casa-torino-tpv',
          tables: incomingTables,
          mesa: typeof body.mesa === 'string' ? body.mesa : '',
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

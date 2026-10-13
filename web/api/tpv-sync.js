/**
 * Casa Torino TPV — sync de mesas entre dispositivos.
 * Persistencia: Supabase ops_kv (opsStore), clave `tpv`.
 *
 * Limpieza diaria 08:00 Europe/Madrid: vacía cuentas/histórico de mesas
 * (rollover en GET/POST + cron /api/ops-daily-purge).
 * Tras el purge, un cliente con localStorage viejo NO puede repoblar el día nuevo
 * (opsDay distinto → se descarta el push de mesas antiguas).
 */
const { getJson, setJson, updateJson } = require('./_opsStore')
const { opsDayId, applyTpvDayRollover } = require('./_opsDay')
const { mergeTables, tablesQty } = require('./_tpvMerge')
const tpvVersion = require('./_tpvVersion')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'tpv'

function cors(req, res) {
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

function withTpvForce(state) {
  const base = state && typeof state === 'object' ? state : emptyState()
  return {
    ...base,
    tpvForce: {
      required: tpvVersion.required,
      message: tpvVersion.message || 'Actualiza para seguir',
    },
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
      // Soft-force: GET entrega tpvForce; el overlay aparece sin refrescar.
      const state = await loadTpvState()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(withTpvForce(state || emptyState())))
    }

    if (req.method === 'POST') {
      // Mutaciones: sin versión actual → 426
      if (tpvVersion.rejectIfClientOutdated(req, res)) return
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

        // Cliente de otro día no puede repoblar tras la limpieza de las 08:00.
        if (incomingDay && incomingDay !== serverDay) {
          return { ...rolled, opsDay: serverDay }
        }

        // Tras purge del día: servidor vacío + cliente sin opsDay (app vieja)
        // no puede volver a llenar con mesas de ayer.
        const serverQty = tablesQty(rolled.tables)
        const incomingQty = tablesQty(incomingTables)
        if (
          serverQty === 0 &&
          incomingQty > 0 &&
          !incomingDay &&
          rolled.opsDay === serverDay
        ) {
          return { ...rolled, opsDay: serverDay }
        }

        const serverAt = Number(rolled.updatedAt || 0)
        const preferIncoming = !(serverAt > incomingAt)
        const merged = mergeTables(rolled.tables, incomingTables, preferIncoming)

        if (merged.rejectedEmpty) {
          return { ...rolled, opsDay: serverDay }
        }

        if (!preferIncoming) {
          return {
            ...rolled,
            tables: merged.tables,
            opsDay: serverDay,
          }
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
      return res.end(JSON.stringify(withTpvForce(next)))
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

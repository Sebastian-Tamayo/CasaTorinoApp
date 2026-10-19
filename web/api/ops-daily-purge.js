/**
 * Limpieza diaria 08:00 Europe/Madrid — cocina + mesas TPV.
 * También dispara informes email (Hobby: máx. 2 crons / 12 functions).
 *   - Lunes ~08:00 Madrid: informe semanal (lun–dom) — envío principal
 *   - Día 1 ~08:00 Madrid: informe mensual del mes anterior
 *
 * GET|POST /api/ops-daily-purge
 * Invocado por Vercel Cron (06:00 y 07:00 UTC → cubre CEST/CET = 08:00 Madrid)
 * y de forma idempotente: solo actúa si cambió el día operativo.
 *
 * Manual informes (sin ruta API extra — límite Hobby):
 *   ?informe=semanal|mensual&dryRun=1&force=1  → solo informe, sin purge
 *
 * Auth: header x-vercel-cron, Bearer CRON_SECRET / TPV_SYNC_KEY, o cookie TPV.
 */
const { updateJson } = require('./_opsStore')
const {
  opsDayId,
  applyKitchenDayRollover,
  applyTpvDayRollover,
} = require('./_opsDay')
const {
  runInforme,
  maybeTriggerWeeklyMondayBackup,
  madridWeekday,
  madridParts,
} = require('./_informeReports')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const CRON_SECRET = process.env.CRON_SECRET || SYNC_KEY || ''

function cors(res) {
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
  if (req.headers['x-vercel-cron'] === '1') return true
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  if (SYNC_KEY && key && key === SYNC_KEY) return true
  if (CRON_SECRET) {
    const auth = String(req.headers.authorization || '')
    if (auth === `Bearer ${CRON_SECRET}`) return true
  }
  return false
}

function flag(req, name) {
  const url = new URL(req.url || '/', 'http://local')
  if (url.searchParams.get(name) === '1') return true
  const body =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body || '{}')
          } catch {
            return {}
          }
        })()
      : req.body || {}
  return body[name] === true || body[name] === 1 || body[name] === '1'
}

function informeKind(req) {
  const url = new URL(req.url || '/', 'http://local')
  const q = String(url.searchParams.get('informe') || '').toLowerCase()
  if (q === 'semanal' || q === 'mensual') return q
  const body =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body || '{}')
          } catch {
            return {}
          }
        })()
      : req.body || {}
  const b = String(body.informe || '').toLowerCase()
  if (b === 'semanal' || b === 'mensual') return b
  return null
}

async function purgeKitchen() {
  let changed = false
  let day = opsDayId()
  const state = await updateJson(
    'kitchen',
    () => ({
      orders: [],
      history: [],
      lastCompleted: null,
      pickups: [],
      historyDay: null,
      jornadaId: null,
      jornadaStartedAt: null,
      updatedAt: 0,
    }),
    (raw) => {
      const out = applyKitchenDayRollover(raw)
      changed = out.changed
      day = out.day
      return out.state
    },
  )
  return {
    changed,
    day,
    historyCount: Array.isArray(state.history) ? state.history.length : 0,
    ordersCount: Array.isArray(state.orders) ? state.orders.length : 0,
  }
}

async function purgeTpv() {
  let changed = false
  let day = opsDayId()
  const state = await updateJson(
    'tpv',
    () => ({
      kind: 'casa-torino-tpv',
      tables: {},
      mesa: '',
      opsDay: null,
      updatedAt: 0,
      clientId: null,
    }),
    (raw) => {
      const out = applyTpvDayRollover(raw)
      changed = out.changed
      day = out.day
      return out.state
    },
  )
  const tables = state.tables && typeof state.tables === 'object' ? state.tables : {}
  return {
    changed,
    day,
    tablesCount: Object.keys(tables).length,
  }
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  }
  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'unauthorized' }))
  }

  try {
    // Solo informe (dry-run / force / prueba manual) — no toca cocina/mesas
    const kind = informeKind(req)
    if (kind) {
      const result = await runInforme(kind, {
        dryRun: flag(req, 'dryRun'),
        force: flag(req, 'force'),
      })
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(result))
    }

    const day = opsDayId()
    const [kitchen, tpv] = await Promise.all([purgeKitchen(), purgeTpv()])

    // Informes email (idempotentes; no rompen el purge si fallan)
    let informes = null
    try {
      const now = new Date()
      const wd = madridWeekday(now)
      const { day: madridDay } = madridParts(now)
      // #region agent log
      try {
        console.log(
          '[informeReports]',
          JSON.stringify({
            sessionId: '258f1c',
            hypothesisId: 'H2',
            location: 'ops-daily-purge.js:handler',
            message: 'purge schedule check',
            data: {
              wd,
              madridDay,
              isCron: req.headers['x-vercel-cron'] === '1',
              day,
            },
            timestamp: Date.now(),
          }),
        )
      } catch {}
      // #endregion
      informes = { weekly: null, monthly: null }
      if (wd === 'Mon') {
        informes.weekly = await maybeTriggerWeeklyMondayBackup(now)
      }
      if (madridDay === 1) {
        informes.monthly = await runInforme('mensual', { force: false, now })
      }
    } catch (err) {
      console.warn('[ops-daily-purge] informes', err)
      informes = {
        error: String(err && err.message ? err.message : err),
      }
    }

    const payload = {
      ok: true,
      day,
      purgeAt: '08:00 Europe/Madrid',
      kitchen,
      tpv,
      informes,
      ranAt: new Date().toISOString(),
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify(payload))
  } catch (err) {
    console.error('[ops-daily-purge]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
      }),
    )
  }
}

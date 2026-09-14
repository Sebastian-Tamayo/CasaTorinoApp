/**
 * Casa Torino — Kitchen Display (KDS)
 * Persistencia: Vercel Blob vía api/_opsStore.js (clave `kitchen`).
 *
 * GET  /api/kitchen
 * POST /api/kitchen  { action: create|complete|undo|resetHistory|syncJornada }
 *
 * Histórico:
 *   - Se limpia al «Inicio de jornada» del TPV (syncJornada / resetHistory)
 *   - También se puede alinear al Fin de sesión
 */
const {
  getJson,
  setJson,
} = require('./_opsStore')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'kitchen'
const HISTORY_MAX = 300
const ORDERS_MAX = 80

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
    orders: [],
    lastCompleted: null,
    history: [],
    historyDay: null,
    jornadaId: null,
    jornadaStartedAt: null,
    updatedAt: 0,
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

async function loadState() {
  const value = await getJson(ITEM_KEY, emptyState)
  return {
    ...emptyState(),
    ...(value && typeof value === 'object' ? value : {}),
    orders: Array.isArray(value?.orders) ? value.orders : [],
    history: Array.isArray(value?.history) ? value.history : [],
    lastCompleted: value?.lastCompleted || null,
  }
}

async function saveState(state) {
  const payload = {
    orders: state.orders || [],
    lastCompleted: state.lastCompleted || null,
    history: state.history || [],
    historyDay: state.historyDay || null,
    jornadaId: state.jornadaId || null,
    jornadaStartedAt: state.jornadaStartedAt || null,
    updatedAt: state.updatedAt || Date.now(),
  }
  await setJson(ITEM_KEY, payload)
  return payload
}

function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((it) => {
      const name = String(it?.name || '').trim()
      if (!name) return false
      const t = String(it?.categoryType || '').trim().toLowerCase()
      const catId = String(it?.catId || '').trim().toLowerCase()
      if (t === 'bebida' || t === 'drink' || catId === 'bebidas') return false
      return true
    })
    .map((it) => ({
      id: String(it.id || ''),
      name: String(it.name || '').trim(),
      qty: Math.max(1, Math.min(99, Number(it.qty) || 1)),
      categoryType: 'comida',
      catId: String(it.catId || ''),
      note: String(it.note || '').trim(),
    }))
}

function publicPayload(state) {
  const pending = (state.orders || []).filter(
    (o) => o && (o.status === 'pending_kitchen' || o.status === 'alert'),
  )
  const history = Array.isArray(state.history) ? state.history : []
  return {
    orders: pending,
    history,
    historyDay: state.historyDay || null,
    historyCount: history.length,
    jornadaId: state.jornadaId || null,
    jornadaStartedAt: state.jornadaStartedAt || null,
    lastCompleted: state.lastCompleted || null,
    updatedAt: state.updatedAt || 0,
    canUndo: Boolean(state.lastCompleted),
    purgeAt: 'Inicio / fin de jornada TPV',
  }
}

function pushHistory(history, order) {
  const next = [order, ...(history || []).filter((h) => h && h.id !== order.id)]
  return next.slice(0, HISTORY_MAX)
}

function removeFromHistory(history, id) {
  return (history || []).filter((h) => h && h.id !== id)
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
    return res.end(JSON.stringify({ error: 'unauthorized' }))
  }

  try {
    if (req.method === 'GET') {
      const state = await loadState()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(publicPayload(state)))
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      const action = String(body.action || '').trim()
      const state = await loadState()
      let orders = Array.isArray(state.orders) ? state.orders.slice() : []
      let lastCompleted = state.lastCompleted || null
      let history = Array.isArray(state.history) ? state.history.slice() : []
      let historyDay = state.historyDay || null
      let jornadaId = state.jornadaId || null
      let jornadaStartedAt = state.jornadaStartedAt || null

      if (action === 'create') {
        const incoming = body.order || body
        const kind = String(incoming.kind || 'order').trim()
        const mesa = String(incoming.mesa || '').trim()
        if (!mesa) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Falta mesa' }))
        }

        // Aviso especial: siguiente plato (solo menús)
        if (kind === 'siguiente_plato') {
          const now = new Date().toISOString()
          const order = {
            id:
              String(incoming.id || '').trim() ||
              `sp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            mesa,
            status: 'pending_kitchen',
            kind: 'siguiente_plato',
            createdAt: now,
            completedAt: null,
            notes: String(incoming.notes || '¡SIGUIENTE PLATO!').trim(),
            items: [
              {
                id: 'siguiente-plato',
                name: '➡️ SIGUIENTE PLATO (MENÚ)',
                qty: 1,
                categoryType: 'comida',
                catId: 'menus-dia',
                note: String(incoming.menuName || 'Menú').trim(),
              },
            ],
          }
          orders = [order, ...orders].slice(0, ORDERS_MAX)
          const next = {
            orders,
            lastCompleted,
            history,
            historyDay,
            jornadaId,
            jornadaStartedAt,
            updatedAt: Date.now(),
          }
          await saveState(next)
          res.statusCode = 201
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ ok: true, order, ...publicPayload(next) }),
          )
        }

        const items = sanitizeItems(incoming.items)
        if (!items.length) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ error: 'Sin productos de comida para cocina' }),
          )
        }
        const now = new Date().toISOString()
        const order = {
          id:
            String(incoming.id || '').trim() ||
            `k-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          mesa,
          status: 'pending_kitchen',
          kind: 'order',
          createdAt: now,
          completedAt: null,
          notes: String(incoming.notes || '').trim(),
          items,
        }
        orders = [order, ...orders].slice(0, ORDERS_MAX)
        const next = {
          orders,
          lastCompleted,
          history,
          historyDay,
          jornadaId,
          jornadaStartedAt,
          updatedAt: Date.now(),
        }
        await saveState(next)
        res.statusCode = 201
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, order, ...publicPayload(next) }))
      }

      if (action === 'complete') {
        const id = String(body.id || '').trim()
        const idx = orders.findIndex((o) => o && o.id === id)
        if (idx < 0) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Pedido no encontrado' }))
        }
        const done = {
          ...orders[idx],
          status: 'ready',
          completedAt: new Date().toISOString(),
        }
        orders.splice(idx, 1)
        lastCompleted = done
        history = pushHistory(history, done)
        const next = {
          orders,
          lastCompleted,
          history,
          historyDay,
          jornadaId,
          jornadaStartedAt,
          updatedAt: Date.now(),
        }
        await saveState(next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({ ok: true, order: done, ...publicPayload(next) }),
        )
      }

      if (action === 'undo') {
        if (!lastCompleted || lastCompleted.status !== 'ready') {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Nada que deshacer' }))
        }
        const restored = {
          ...lastCompleted,
          status: 'pending_kitchen',
          completedAt: null,
          restoredAt: new Date().toISOString(),
        }
        orders = orders.filter((o) => o.id !== restored.id)
        orders = [restored, ...orders]
        history = removeFromHistory(history, restored.id)
        lastCompleted = null
        const next = {
          orders,
          lastCompleted,
          history,
          historyDay,
          jornadaId,
          jornadaStartedAt,
          updatedAt: Date.now(),
        }
        await saveState(next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({ ok: true, order: restored, ...publicPayload(next) }),
        )
      }

      // Inicio de jornada TPV → nuevo histórico limpio
      if (action === 'resetHistory' || action === 'syncJornada') {
        const phase = String(body.phase || 'start').toLowerCase()
        const jId =
          String(body.jornadaId || '').trim() ||
          `j-${body.startedAt || Date.now()}`
        const startedAt = Number(body.startedAt) || Date.now()

        if (phase === 'start') {
          history = []
          lastCompleted = null
          historyDay = new Date(startedAt).toISOString().slice(0, 10)
          jornadaId = jId
          jornadaStartedAt = startedAt
          // Opcional: no vaciar pedidos pendientes en curso
        } else if (phase === 'end') {
          // Fin de sesión: conserva histórico hasta el próximo inicio,
          // pero marca la jornada cerrada
          historyDay = historyDay || new Date().toISOString().slice(0, 10)
          jornadaId = jId || jornadaId
        }

        const next = {
          orders,
          lastCompleted,
          history,
          historyDay,
          jornadaId,
          jornadaStartedAt,
          updatedAt: Date.now(),
        }
        await saveState(next)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, ...publicPayload(next) }))
      }

      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'action inválida' }))
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'method not allowed' }))
  } catch (err) {
    console.error('[kitchen]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: String(err && err.message ? err.message : err),
      }),
    )
  }
}

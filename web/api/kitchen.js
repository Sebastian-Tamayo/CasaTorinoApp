/**
 * Casa Torino — Kitchen Display (KDS)
 * Persistencia: Vercel Blob vía api/_opsStore.js (clave `kitchen`).
 *
 * GET  /api/kitchen
 * POST /api/kitchen  { action: create|complete|undo|resetHistory|syncJornada }
 *
 * Escrituras con updateJson (RMW + reintento) para no perder Listo/comandas
 * concurrentes en jornada 24/7.
 */
const { getJson, updateJson } = require('./_opsStore')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const ITEM_KEY = 'kitchen'
const HISTORY_MAX = 300
const ORDERS_MAX = 80
const PICKUPS_MAX = 30

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
    // Avisos TPV: cocina marcó Listo → camareros recogen mesa
    pickups: [],
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

function normalizeState(value) {
  return {
    ...emptyState(),
    ...(value && typeof value === 'object' ? value : {}),
    orders: Array.isArray(value?.orders) ? value.orders : [],
    history: Array.isArray(value?.history) ? value.history : [],
    pickups: Array.isArray(value?.pickups) ? value.pickups : [],
    lastCompleted: value?.lastCompleted || null,
  }
}

async function loadState() {
  const value = await getJson(ITEM_KEY, emptyState, { fresh: true })
  return normalizeState(value)
}

function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((it) => {
      const name = String(it?.name || '').trim()
      if (!name) return false
      const t = String(it?.categoryType || '').trim().toLowerCase()
      const catId = String(it?.catId || '').trim().toLowerCase()
      if (t === 'bebida' || t === 'drink' || catId === 'bebidas' || catId === 'cafes' || catId === 'postres' || catId === 'extras') return false
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

/** Menú español = siempre 2 platos (primero / segundo) */
function isSpanishMenuItem(it) {
  const id = String(it?.id || '')
  const note = String(it?.note || '')
  const cat = String(it?.catId || '').toLowerCase()
  if (/^menu-dia-es-/.test(id)) return true
  if (cat === 'menus-dia' && /Primero\s*N\s*\d/i.test(note)) return true
  return false
}

function parseCourseNote(note) {
  const m = String(note || '').match(/Primero\s*N\s*(\d)\s*[·.•\-]\s*Segundo\s*N\s*(\d)/i)
  if (!m) return null
  return { primero: m[1], segundo: m[2] }
}

function buildMenuDiaOrderFields(items) {
  const menuItems = items.filter(isSpanishMenuItem)
  if (!menuItems.length) return null

  const course1Items = items.map((it) => {
    if (!isSpanishMenuItem(it)) return { ...it }
    const c = parseCourseNote(it.note)
    return {
      ...it,
      name: `${it.name} · 1º PLATO N${c?.primero || '?'}`,
      note: c ? `Primero Nº${c.primero}` : it.note,
    }
  })
  const menuSecondItems = menuItems.map((it) => {
    const c = parseCourseNote(it.note)
    return {
      id: it.id,
      name: `${it.name} · 2º PLATO N${c?.segundo || '?'}`,
      qty: it.qty,
      categoryType: 'comida',
      catId: it.catId || 'menus-dia',
      note: c ? `Segundo Nº${c.segundo}` : String(it.note || '').trim(),
    }
  })
  return {
    kind: 'menu_dia',
    course: 1,
    courseTotal: 2,
    items: course1Items,
    menuSecondItems,
    phase: 'primero',
  }
}

function publicPayload(state) {
  const pending = (state.orders || []).filter(
    (o) =>
      o &&
      (o.status === 'pending_kitchen' ||
        o.status === 'alert' ||
        o.status === 'waiting_next'),
  )
  const history = Array.isArray(state.history) ? state.history : []
  const pickups = Array.isArray(state.pickups) ? state.pickups : []
  return {
    orders: pending,
    history,
    historyDay: state.historyDay || null,
    historyCount: history.length,
    jornadaId: state.jornadaId || null,
    jornadaStartedAt: state.jornadaStartedAt || null,
    lastCompleted: state.lastCompleted || null,
    pickups,
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

/**
 * Mutación RMW. Si mutator lanza { httpStatus }, no escribe y se propaga.
 */
async function mutate(mutator) {
  let resultMeta = null
  const next = await updateJson(ITEM_KEY, emptyState, async (raw) => {
    const state = normalizeState(raw)
    const out = await mutator(state)
    resultMeta = out.meta || null
    return out.state
  })
  return { state: normalizeState(next), meta: resultMeta }
}

function bizError(status, message) {
  const err = new Error(message)
  err.httpStatus = status
  return err
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

      if (action === 'create') {
        const incoming = body.order || body
        const kind = String(incoming.kind || 'order').trim()
        const mesa = String(incoming.mesa || '').trim()
        if (!mesa) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Falta mesa' }))
        }

        if (kind === 'siguiente_plato') {
          const { state, meta } = await mutate((state) => {
            const now = new Date().toISOString()
            const orders = Array.isArray(state.orders) ? state.orders.slice() : []
            // Activar 2º plato del menú que está esperando en esa mesa
            const idx = orders.findIndex(
              (o) =>
                o &&
                String(o.mesa) === mesa &&
                o.kind === 'menu_dia' &&
                (o.status === 'waiting_next' || o.phase === 'waiting_segundo'),
            )
            if (idx >= 0) {
              const prev = orders[idx]
              const secondItems =
                Array.isArray(prev.menuSecondItems) && prev.menuSecondItems.length
                  ? prev.menuSecondItems
                  : [
                      {
                        id: 'segundo-plato',
                        name: '2º PLATO (MENÚ)',
                        qty: 1,
                        categoryType: 'comida',
                        catId: 'menus-dia',
                        note: String(incoming.menuName || prev.notes || 'Menú').trim(),
                      },
                    ]
              const activated = {
                ...prev,
                status: 'pending_kitchen',
                phase: 'segundo',
                course: 2,
                notes: '¡SEGUNDO PLATO!',
                items: secondItems,
                activatedSecondAt: now,
                completedAt: null,
              }
              orders[idx] = activated
              state.orders = orders
              return { state, meta: { order: activated } }
            }
            // Fallback: aviso suelto (si no había menú esperando)
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
            state.orders = [order, ...orders].slice(0, ORDERS_MAX)
            return { state, meta: { order } }
          })
          res.statusCode = 201
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({ ok: true, order: meta.order, ...publicPayload(state) }),
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

        const { state, meta } = await mutate((state) => {
          const now = new Date().toISOString()
          const menuFields = buildMenuDiaOrderFields(items)
          const order = {
            id:
              String(incoming.id || '').trim() ||
              `k-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            mesa,
            status: 'pending_kitchen',
            kind: menuFields ? 'menu_dia' : 'order',
            createdAt: now,
            completedAt: null,
            notes: String(incoming.notes || '').trim(),
            items: menuFields ? menuFields.items : items,
            ...(menuFields
              ? {
                  course: 1,
                  courseTotal: 2,
                  phase: 'primero',
                  menuSecondItems: menuFields.menuSecondItems,
                }
              : {}),
          }
          state.orders = [order, ...(state.orders || [])].slice(0, ORDERS_MAX)
          return { state, meta: { order } }
        })
        res.statusCode = 201
        res.setHeader('Content-Type', 'application/json')
        return res.end(
          JSON.stringify({ ok: true, order: meta.order, ...publicPayload(state) }),
        )
      }

      if (action === 'complete') {
        const id = String(body.id || '').trim()
        try {
          const { state, meta } = await mutate((state) => {
            const orders = Array.isArray(state.orders) ? state.orders.slice() : []
            const idx = orders.findIndex((o) => o && o.id === id)
            if (idx < 0) throw bizError(404, 'Pedido no encontrado')
            const current = orders[idx]
            const now = new Date().toISOString()
            const mesa = String(current.mesa || '').trim() || '?'

            // Menú español · 1º plato: avisa TPV pero NO cierra el ticket (espera 2º)
            if (
              current.kind === 'menu_dia' &&
              Number(current.course || 1) === 1 &&
              current.status !== 'waiting_next'
            ) {
              const snapshot = { ...current }
              const waiting = {
                ...current,
                status: 'waiting_next',
                phase: 'waiting_segundo',
                course: 2,
                completedFirstAt: now,
                completedAt: null,
                items: [
                  {
                    id: 'waiting-segundo',
                    name: '⏳ 1º listo — esperando «Siguiente plato»',
                    qty: 1,
                    categoryType: 'comida',
                    catId: 'menus-dia',
                    note: 'La camarera pulsará Siguiente plato en el TPV',
                  },
                ],
              }
              orders[idx] = waiting
              state.orders = orders
              const done = {
                ...snapshot,
                status: 'ready',
                completedAt: now,
                menuPartial: true,
                course: 1,
              }
              state.lastCompleted = done
              // No va al histórico hasta cerrar el 2º
              const pickup = {
                id: `${done.id}::c1`,
                mesa,
                at: now,
                message: `Recoger mesa ${mesa} · 1º plato`,
              }
              const prev = Array.isArray(state.pickups) ? state.pickups : []
              state.pickups = [pickup, ...prev.filter((p) => p && p.id !== pickup.id)].slice(
                0,
                PICKUPS_MAX,
              )
              return { state, meta: { order: done, pickup } }
            }

            const done = {
              ...current,
              status: 'ready',
              completedAt: now,
            }
            orders.splice(idx, 1)
            state.orders = orders
            state.lastCompleted = done
            state.history = pushHistory(state.history, done)

            if (done.kind === 'siguiente_plato') {
              return { state, meta: { order: done, pickup: null } }
            }

            const isSecond =
              done.kind === 'menu_dia' && Number(done.course || 0) === 2
            const pickup = {
              id: done.id,
              mesa,
              at: done.completedAt,
              message: isSecond
                ? `Recoger mesa ${mesa} · 2º plato`
                : `Recoger mesa ${mesa}`,
            }
            const prev = Array.isArray(state.pickups) ? state.pickups : []
            state.pickups = [pickup, ...prev.filter((p) => p && p.id !== pickup.id)].slice(
              0,
              PICKUPS_MAX,
            )
            return { state, meta: { order: done, pickup } }
          })
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              ok: true,
              order: meta.order,
              pickup: meta.pickup,
              ...publicPayload(state),
            }),
          )
        } catch (err) {
          if (err.httpStatus) {
            res.statusCode = err.httpStatus
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: err.message }))
          }
          throw err
        }
      }

      if (action === 'ackPickup') {
        const id = String(body.id || '').trim()
        const { state } = await mutate((state) => {
          const list = Array.isArray(state.pickups) ? state.pickups : []
          state.pickups = id
            ? list.filter((p) => p && p.id !== id)
            : []
          return { state }
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, ...publicPayload(state) }))
      }

      if (action === 'undo') {
        try {
          const { state, meta } = await mutate((state) => {
            const lastCompleted = state.lastCompleted
            if (!lastCompleted || lastCompleted.status !== 'ready') {
              throw bizError(400, 'Nada que deshacer')
            }

            // Deshacer Listo del 1º plato del menú
            if (lastCompleted.menuPartial && lastCompleted.kind === 'menu_dia') {
              const restored = {
                ...lastCompleted,
                status: 'pending_kitchen',
                completedAt: null,
                course: 1,
                phase: 'primero',
                restoredAt: new Date().toISOString(),
              }
              delete restored.menuPartial
              let orders = (state.orders || []).filter((o) => o.id !== restored.id)
              orders = [restored, ...orders]
              state.orders = orders
              state.lastCompleted = null
              state.pickups = (state.pickups || []).filter(
                (p) => p && p.id !== restored.id && p.id !== `${restored.id}::c1`,
              )
              return { state, meta: { order: restored } }
            }

            const restored = {
              ...lastCompleted,
              status: 'pending_kitchen',
              completedAt: null,
              restoredAt: new Date().toISOString(),
            }
            let orders = (state.orders || []).filter((o) => o.id !== restored.id)
            orders = [restored, ...orders]
            state.orders = orders
            state.history = removeFromHistory(state.history, restored.id)
            state.lastCompleted = null
            // Si se deshace el Listo, quitar aviso de recogida
            state.pickups = (state.pickups || []).filter((p) => p && p.id !== restored.id)
            return { state, meta: { order: restored } }
          })
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              ok: true,
              order: meta.order,
              ...publicPayload(state),
            }),
          )
        } catch (err) {
          if (err.httpStatus) {
            res.statusCode = err.httpStatus
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: err.message }))
          }
          throw err
        }
      }

      if (action === 'resetHistory' || action === 'syncJornada') {
        const phase = String(body.phase || 'start').toLowerCase()
        const jId =
          String(body.jornadaId || '').trim() ||
          `j-${body.startedAt || Date.now()}`
        const startedAt = Number(body.startedAt) || Date.now()

        const { state } = await mutate((state) => {
          if (phase === 'start') {
            state.history = []
            state.lastCompleted = null
            state.pickups = []
            state.historyDay = new Date(startedAt).toISOString().slice(0, 10)
            state.jornadaId = jId
            state.jornadaStartedAt = startedAt
          } else if (phase === 'end') {
            state.historyDay =
              state.historyDay || new Date().toISOString().slice(0, 10)
            state.jornadaId = jId || state.jornadaId
          }
          return { state }
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ ok: true, ...publicPayload(state) }))
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

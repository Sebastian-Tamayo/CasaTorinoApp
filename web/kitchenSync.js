/**
 * Casa Torino — sync cocina (KDS)
 * - Lectura DIRECTA a Supabase ops_kv (no quema Fluid Active CPU de Vercel)
 * - Realtime postgres_changes + broadcast; poll lento solo como respaldo
 * - Mutaciones (create/complete/…) siguen en /api/kitchen (sesión PIN)
 * - Avisos de recogida (Listo → TPV)
 */
(() => {
  const API_URL = '/api/kitchen'
  const AUTH_URL = '/api/tpv-auth'
  const KITCHEN_KEY = 'kitchen'
  // Respaldo lento: el vivo va por Supabase Realtime (0 Vercel).
  const POLL_MS = 20000
  const POLL_HIDDEN_MS = 120000
  const FORCE_POLL_MS = 5 * 60 * 1000
  const RETRIES = 3
  const SB_URL = 'https://fpnjtgoxljqmwuukyrrm.supabase.co'
  const SB_ANON = 'sb_publishable_A_zxEJjB3NN_hh8Qdu7ccQ_qhcWGoz0'
  const LIVE_CHANNEL = 'casa-torino-kitchen-live'

  let timer = null
  let heartbeat = null
  let forceTimer = null
  let polling = false
  let visibilityBound = false
  let lastUpdatedAt = 0
  let knownIds = new Set()
  let knownPickupIds = new Set()
  let onUpdate = null
  let onAuthLost = null
  let onPickup = null
  let bootstrapped = false
  let sbClient = null
  let sbChannel = null
  let realtimeStarted = false

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  function clientHeaders(extra) {
    if (typeof window.__casaTorinoCocinaClientHeaders === 'function') {
      return window.__casaTorinoCocinaClientHeaders(extra)
    }
    if (typeof window.__casaTorinoTpvClientHeaders === 'function') {
      return window.__casaTorinoTpvClientHeaders(extra)
    }
    return Object.assign({ 'Cache-Control': 'no-store' }, extra || {})
  }

  function noteForce(data) {
    try {
      if (
        data &&
        data.cocinaForce &&
        typeof window.__casaTorinoApplyCocinaForce === 'function' &&
        typeof window.__casaTorinoCocinaClientHeaders === 'function'
      ) {
        window.__casaTorinoCocinaForceRequired = data.cocinaForce.required
        window.__casaTorinoApplyCocinaForce(data.cocinaForce)
      }
    } catch {}
  }

  async function refreshSession() {
    try {
      await fetch(AUTH_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: clientHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ refresh: true }),
      })
    } catch {}
  }

  async function ensureSb() {
    if (sbClient) return sbClient
    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src =
          'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js'
        s.async = true
        s.onload = resolve
        s.onerror = () => reject(new Error('supabase-js'))
        document.head.appendChild(s)
      })
    }
    if (window.__casaTorinoSbClient) {
      sbClient = window.__casaTorinoSbClient
      return sbClient
    }
    sbClient = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 8 } },
    })
    window.__casaTorinoSbClient = sbClient
    return sbClient
  }

  function publicPayload(raw) {
    const state = raw && typeof raw === 'object' ? raw : {}
    const orders = Array.isArray(state.orders) ? state.orders : []
    const pending = orders.filter(
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
      updatedAt: Number(state.updatedAt || 0),
      canUndo: Boolean(state.lastCompleted),
      purgeAt: '08:00 Europe/Madrid',
    }
  }

  async function pullFromSupabase() {
    const c = await ensureSb()
    const { data, error } = await c
      .from('ops_kv')
      .select('value')
      .eq('key', KITCHEN_KEY)
      .maybeSingle()
    if (error) throw error
    return publicPayload(data?.value)
  }

  /** Fallback legacy — solo si Supabase falla */
  async function pullFromApi() {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: clientHeaders(),
        })
        const data = await r.json().catch(() => ({}))
        if (r.status === 426) {
          noteForce(data)
          const err = new Error('update_required')
          err.status = 426
          err.data = data
          throw err
        }
        if (!r.ok) throw new Error('kitchen GET ' + r.status)
        noteForce(data)
        return data
      } catch (err) {
        lastErr = err
        if (err && err.status === 426) throw err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('kitchen GET failed')
  }

  async function pull() {
    try {
      return await pullFromSupabase()
    } catch (err) {
      console.warn('[kitchenSync] pull SB → API', err)
      return pullFromApi()
    }
  }

  /** Fuerza de versión cocina: JSON estático (0 Fluid CPU). */
  async function pollCocinaForce() {
    try {
      if (typeof window.__casaTorinoCocinaClientHeaders !== 'function') return
      const r = await fetch('/cocina-version.json', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!r.ok) return
      const j = await r.json()
      if (j && j.required) {
        noteForce({
          cocinaForce: {
            required: String(j.required),
            message: String(j.message || 'Actualiza para seguir'),
          },
        })
      }
    } catch {}
  }

  async function post(action, payload = {}) {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: clientHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ action, ...payload }),
        })
        const data = await r.json().catch(() => ({}))
        if (r.status === 426) {
          noteForce(data)
          const err = new Error(data.error || 'update_required')
          err.status = 426
          err.data = data
          throw err
        }
        if (r.status === 401) {
          if (typeof onAuthLost === 'function') onAuthLost()
          const err = new Error(
            data.error || 'Sesión caducada — vuelve a introducir el PIN',
          )
          err.status = 401
          throw err
        }
        if (!r.ok) {
          const err = new Error(data.error || 'kitchen POST ' + r.status)
          err.status = r.status
          throw err
        }
        refreshSession()
        // Tras mutación: refrescar YA (sin esperar poll) + avisar peers
        tick().catch(() => {})
        notifyPeers(action).catch(() => {})
        return data
      } catch (err) {
        lastErr = err
        if (
          err.status === 401 ||
          err.status === 426 ||
          err.status === 400 ||
          err.status === 404
        ) {
          throw err
        }
        await sleep(250 * i * i)
      }
    }
    throw lastErr || new Error('kitchen POST failed')
  }

  async function notifyPeers(reason) {
    try {
      const c = await ensureSb()
      if (!sbChannel) return
      await sbChannel.send({
        type: 'broadcast',
        event: 'kitchen-updated',
        payload: { at: Date.now(), reason: reason || '' },
      })
    } catch (err) {
      console.warn('[kitchenSync] notify', err)
    }
  }

  async function startRealtime() {
    if (realtimeStarted) return
    realtimeStarted = true
    try {
      const c = await ensureSb()
      sbChannel = c.channel(LIVE_CHANNEL, {
        config: { broadcast: { self: false } },
      })
      sbChannel.on('broadcast', { event: 'kitchen-updated' }, () => {
        tick().catch((err) => console.warn('[kitchenSync] live tick', err))
      })
      sbChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ops_kv',
          filter: `key=eq.${KITCHEN_KEY}`,
        },
        () => {
          tick().catch((err) => console.warn('[kitchenSync] pg tick', err))
        },
      )
      await new Promise((resolve) => {
        sbChannel.subscribe((status) => {
          if (
            status === 'SUBSCRIBED' ||
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            resolve(status)
          }
        })
      })
    } catch (err) {
      console.warn('[kitchenSync] realtime', err)
    }
  }

  async function tick() {
    if (polling) return
    polling = true
    try {
      const remote = await pull()
      const remoteAt = Number(remote?.updatedAt || 0)
      const orders = Array.isArray(remote.orders) ? remote.orders : []
      const pickups = Array.isArray(remote.pickups) ? remote.pickups : []
      const ids = new Set(orders.map((o) => o.id))
      const pickupIds = new Set(pickups.map((p) => p && p.id).filter(Boolean))
      let newOrders = []
      let newPickups = []

      if (!bootstrapped) {
        bootstrapped = true
        knownIds = ids
        knownPickupIds = pickupIds
      } else {
        if (remoteAt >= lastUpdatedAt) {
          newOrders = orders.filter((o) => o && !knownIds.has(o.id))
          knownIds = ids
        }
        newPickups = pickups.filter(
          (p) => p && p.id && !knownPickupIds.has(p.id),
        )
        knownPickupIds = pickupIds
        for (const p of newPickups) knownPickupIds.add(p.id)
      }

      if (remoteAt !== lastUpdatedAt || newOrders.length || newPickups.length) {
        lastUpdatedAt = remoteAt
        if (typeof onUpdate === 'function') {
          onUpdate({
            orders,
            history: Array.isArray(remote.history) ? remote.history : [],
            historyDay: remote.historyDay || '',
            historyCount: Number(remote.historyCount || 0),
            jornadaId: remote.jornadaId || null,
            jornadaStartedAt: remote.jornadaStartedAt || null,
            lastCompleted: remote.lastCompleted || null,
            pickups,
            canUndo: Boolean(remote.canUndo),
            updatedAt: remoteAt,
            newOrders,
            newPickups,
            purgeAt: remote.purgeAt || 'Inicio / fin de jornada TPV',
          })
        }
        if (newPickups.length && typeof onPickup === 'function') {
          onPickup(newPickups, pickups)
        }
      }
    } catch (err) {
      console.warn('[kitchenSync]', err)
    } finally {
      polling = false
    }
  }

  function pollDelay() {
    return typeof document !== 'undefined' && document.hidden
      ? POLL_HIDDEN_MS
      : POLL_MS
  }

  function schedule() {
    if (timer) clearInterval(timer)
    timer = setInterval(tick, pollDelay())
  }

  function onVisibility() {
    schedule()
    if (!(typeof document !== 'undefined' && document.hidden)) tick()
  }

  function start(handler, authLostHandler, pickupHandler) {
    onUpdate = handler
    onAuthLost = authLostHandler || null
    onPickup = pickupHandler || null
    bootstrapped = false
    tick()
    schedule()
    startRealtime().catch(() => {})
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = setInterval(refreshSession, 20 * 60 * 1000)
    refreshSession()
    if (forceTimer) clearInterval(forceTimer)
    pollCocinaForce()
    forceTimer = setInterval(pollCocinaForce, FORCE_POLL_MS)
    if (!visibilityBound && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
      visibilityBound = true
    }
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
    if (forceTimer) clearInterval(forceTimer)
    forceTimer = null
  }

  window.CasaTorinoKitchenSync = {
    pull,
    post,
    start,
    stop,
    tick,
    refreshSession,
    create: (order) => post('create', { order }),
    complete: (id) => post('complete', { id }),
    undo: () => post('undo'),
    ackPickup: (id) => post('ackPickup', { id: id || '' }),
    syncJornada: (phase, payload = {}) =>
      post('syncJornada', { phase, ...payload }),
  }
})()

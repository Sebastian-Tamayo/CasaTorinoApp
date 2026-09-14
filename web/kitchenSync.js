/**
 * Casa Torino — sync cocina (KDS) — endurecido 24/7
 * Polling + reintentos + renovación de sesión PIN
 */
(() => {
  const API_URL = '/api/kitchen'
  const AUTH_URL = '/api/tpv-auth'
  const POLL_MS = 1200
  const RETRIES = 3

  let timer = null
  let heartbeat = null
  let polling = false
  let lastUpdatedAt = 0
  let knownIds = new Set()
  let onUpdate = null
  let onAuthLost = null
  let bootstrapped = false

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  async function refreshSession() {
    try {
      await fetch(AUTH_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: true }),
      })
    } catch {}
  }

  async function pull() {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-store' },
        })
        if (!r.ok) throw new Error('kitchen GET ' + r.status)
        return await r.json()
      } catch (err) {
        lastErr = err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('kitchen GET failed')
  }

  async function post(action, payload = {}) {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        })
        const data = await r.json().catch(() => ({}))
        if (r.status === 401) {
          if (typeof onAuthLost === 'function') onAuthLost()
          const err = new Error(data.error || 'Sesión caducada — vuelve a introducir el PIN')
          err.status = 401
          throw err
        }
        if (!r.ok) {
          const err = new Error(data.error || 'kitchen POST ' + r.status)
          err.status = r.status
          throw err
        }
        // Renovar cookie en operaciones críticas
        refreshSession()
        return data
      } catch (err) {
        lastErr = err
        if (err.status === 401 || err.status === 400 || err.status === 404) throw err
        await sleep(250 * i * i)
      }
    }
    throw lastErr || new Error('kitchen POST failed')
  }

  async function tick() {
    if (polling) return
    polling = true
    try {
      const remote = await pull()
      const remoteAt = Number(remote?.updatedAt || 0)
      const orders = Array.isArray(remote.orders) ? remote.orders : []
      const ids = new Set(orders.map((o) => o.id))
      let newOrders = []

      if (!bootstrapped) {
        bootstrapped = true
        knownIds = ids
      } else if (remoteAt >= lastUpdatedAt) {
        newOrders = orders.filter((o) => o && !knownIds.has(o.id))
        knownIds = ids
      }

      if (remoteAt !== lastUpdatedAt || newOrders.length) {
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
            canUndo: Boolean(remote.canUndo),
            updatedAt: remoteAt,
            newOrders,
            purgeAt: remote.purgeAt || 'Inicio / fin de jornada TPV',
          })
        }
      }
    } catch (err) {
      console.warn('[kitchenSync]', err)
    } finally {
      polling = false
    }
  }

  function start(handler, authLostHandler) {
    onUpdate = handler
    onAuthLost = authLostHandler || null
    bootstrapped = false
    tick()
    if (timer) clearInterval(timer)
    timer = setInterval(tick, POLL_MS)
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = setInterval(refreshSession, 15 * 60 * 1000) // cada 15 min
    refreshSession()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
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
    syncJornada: (phase, payload = {}) =>
      post('syncJornada', { phase, ...payload }),
  }
})()

/**
 * Casa Torino — sync cocina (KDS).
 * Polling ~1s sobre /api/kitchen (Edge Config), mismo patrón que el TPV.
 */
(() => {
  const API_URL = '/api/kitchen'
  const POLL_MS = 1000

  let timer = null
  let polling = false
  let lastUpdatedAt = 0
  let knownIds = new Set()
  let onUpdate = null
  let bootstrapped = false

  async function pull() {
    const r = await fetch(API_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-store' },
    })
    if (!r.ok) throw new Error('kitchen GET ' + r.status)
    return r.json()
  }

  async function post(action, payload = {}) {
    const r = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || 'kitchen POST ' + r.status)
    return data
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
            lastCompleted: remote.lastCompleted || null,
            canUndo: Boolean(remote.canUndo),
            updatedAt: remoteAt,
            newOrders,
          })
        }
      }
    } catch (err) {
      console.warn('[kitchenSync]', err)
    } finally {
      polling = false
    }
  }

  function start(handler) {
    onUpdate = handler
    tick()
    if (timer) clearInterval(timer)
    timer = setInterval(tick, POLL_MS)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  window.CasaTorinoKitchenSync = {
    pull,
    post,
    start,
    stop,
    tick,
    create: (order) => post('create', { order }),
    complete: (id) => post('complete', { id }),
    undo: () => post('undo'),
  }
})()

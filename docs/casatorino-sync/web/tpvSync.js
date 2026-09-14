/**
 * Casa Torino TPV — sync de mesas entre dispositivos (móvil ↔ PC).
 * Usa /api/tpv-sync (Vercel + Edge Config) para que el pedido
 * de una mesa aparezca al momento en todos los dispositivos.
 */
(() => {
  const API_URL = '/api/tpv-sync'
  const POLL_MS = 1500
  const PUSH_DEBOUNCE_MS = 400
  const CLIENT_ID =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'c-' + Date.now() + '-' + Math.random().toString(16).slice(2)

  let lastLocalWrite = 0
  let lastRemoteUpdatedAt = 0
  let polling = false
  let pushTimer = null
  let pending = null
  let timer = null
  let onRemote = null

  async function pull() {
    const r = await fetch(API_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-store' },
    })
    if (!r.ok) throw new Error('sync GET ' + r.status)
    return r.json()
  }

  async function pushNow(tables, mesa) {
    const updatedAt = Date.now()
    lastLocalWrite = updatedAt
    const body = {
      kind: 'casa-torino-tpv',
      tables: tables || {},
      mesa: mesa || '',
      updatedAt,
      clientId: CLIENT_ID,
    }
    const r = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error('sync POST ' + r.status)
    const saved = await r.json().catch(() => body)
    lastRemoteUpdatedAt = Number(saved.updatedAt || updatedAt)
    return saved
  }

  function push(tables, mesa) {
    pending = { tables, mesa }
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(async () => {
      const job = pending
      pending = null
      pushTimer = null
      if (!job) return
      try {
        await pushNow(job.tables, job.mesa)
      } catch (err) {
        console.warn('[tpvSync] push', err)
      }
    }, PUSH_DEBOUNCE_MS)
  }

  async function tick() {
    if (polling) return
    polling = true
    try {
      const remote = await pull()
      const remoteAt = Number(remote?.updatedAt || 0)
      if (!remoteAt) return

      if (remote.clientId === CLIENT_ID) {
        if (remoteAt > lastRemoteUpdatedAt) lastRemoteUpdatedAt = remoteAt
        return
      }

      if (remoteAt > lastRemoteUpdatedAt && remoteAt > lastLocalWrite) {
        lastRemoteUpdatedAt = remoteAt
        if (typeof onRemote === 'function') {
          onRemote({
            tables: remote.tables || {},
            mesa: remote.mesa || '',
            updatedAt: remoteAt,
          })
        }
      } else if (remoteAt > lastRemoteUpdatedAt) {
        lastRemoteUpdatedAt = remoteAt
      }
    } catch (err) {
      console.warn('[tpvSync]', err)
    } finally {
      polling = false
    }
  }

  function start(handler) {
    onRemote = handler
    tick()
    if (timer) clearInterval(timer)
    timer = setInterval(tick, POLL_MS)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
  }

  window.CasaTorinoTpvSync = { pull, push, start, stop, tick }
})()

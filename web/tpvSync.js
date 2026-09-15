/**
 * Casa Torino TPV — sync mesas móvil ↔ PC (endurecido 24/7)
 */
(() => {
  const API_URL = '/api/tpv-sync'
  const AUTH_URL = '/api/tpv-auth'
  const POLL_MS = 4000
  const PUSH_DEBOUNCE_MS = 700
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
  let heartbeat = null
  let onRemote = null
  let onAuthLost = null

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
    for (let i = 1; i <= 3; i++) {
      try {
        const r = await fetch(API_URL, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-store' },
        })
        if (!r.ok) throw new Error('sync GET ' + r.status)
        return await r.json()
      } catch (err) {
        lastErr = err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('sync GET failed')
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
    let lastErr = null
    for (let i = 1; i <= 3; i++) {
      try {
        const r = await fetch(API_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (r.status === 401) {
          if (typeof onAuthLost === 'function') onAuthLost()
          const err = new Error('Sesión caducada — vuelve a poner el PIN')
          err.status = 401
          throw err
        }
        if (!r.ok) throw new Error('sync POST ' + r.status)
        const saved = await r.json().catch(() => body)
        lastRemoteUpdatedAt = Number(saved.updatedAt || updatedAt)
        refreshSession()
        return saved
      } catch (err) {
        lastErr = err
        if (err.status === 401) throw err
        await sleep(250 * i * i)
      }
    }
    throw lastErr || new Error('sync POST failed')
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

  function start(handler, authLostHandler) {
    onRemote = handler
    onAuthLost = authLostHandler || null
    tick()
    if (timer) clearInterval(timer)
    timer = setInterval(tick, POLL_MS)
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = setInterval(refreshSession, 15 * 60 * 1000)
    refreshSession()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
  }

  window.CasaTorinoTpvSync = { pull, push, start, stop, tick, refreshSession }
})()

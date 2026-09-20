/**
 * Casa Torino TPV — sync mesas móvil ↔ PC (endurecido 24/7)
 * - Nunca deja que un remoto vacío borre mesas locales con productos
 * - No hace push hasta completar hydrate (evita wipe al refrescar)
 * - Envía opsDay (09:00 Madrid) para no chocar con el purge diario
 * - flush() al salir/refrescar para no perder el push pendiente
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
  let lastRemoteQty = 0
  let polling = false
  let pushTimer = null
  let pending = null
  let timer = null
  let heartbeat = null
  let onRemote = null
  let onAuthLost = null
  let getLocalSnapshot = null
  /** Bloquea push hasta hydrate(); evita POST {} al refrescar. */
  let ready = false

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  /** Mismo criterio que web/api/_opsDay.js (día operativo 09:00 Europe/Madrid). */
  function opsDayId(now = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
    const parts = Object.fromEntries(
      fmt
        .formatToParts(now)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    )
    let y = Number(parts.year)
    let m = Number(parts.month)
    let d = Number(parts.day)
    const hour = Number(parts.hour)
    if (hour < 9) {
      const dt = new Date(Date.UTC(y, m - 1, d))
      dt.setUTCDate(dt.getUTCDate() - 1)
      y = dt.getUTCFullYear()
      m = dt.getUTCMonth() + 1
      d = dt.getUTCDate()
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function cartQty(table) {
    let n = 0
    const cart = table && table.cart
    if (!cart || typeof cart !== 'object') return 0
    for (const line of Object.values(cart)) n += Math.max(0, Number(line?.qty) || 0)
    return n
  }

  function tablesQty(tables) {
    let n = 0
    if (!tables || typeof tables !== 'object') return 0
    for (const t of Object.values(tables)) n += cartQty(t)
    return n
  }

  /**
   * Fusiona mesas: un remoto vacío NUNCA borra mesas locales con productos.
   * Por mesa: si una está vacía y la otra no, gana la que tiene cuenta.
   */
  function mergeTables(localTables, remoteTables) {
    const local = localTables && typeof localTables === 'object' ? localTables : {}
    const remote = remoteTables && typeof remoteTables === 'object' ? remoteTables : {}
    const lTotal = tablesQty(local)
    const rTotal = tablesQty(remote)

    if (rTotal === 0 && lTotal > 0) {
      return { tables: local, keptLocal: true }
    }
    if (lTotal === 0 && rTotal > 0) {
      return { tables: remote, keptLocal: false }
    }

    const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
    const out = {}
    let keptLocal = false
    for (const k of keys) {
      const L = local[k]
      const R = remote[k]
      const lq = cartQty(L)
      const rq = cartQty(R)
      if (rq === 0 && lq > 0) {
        out[k] = L
        keptLocal = true
      } else if (lq === 0 && rq > 0) {
        out[k] = R
      } else if (R) {
        out[k] = R
      } else if (L) {
        out[k] = L
        keptLocal = true
      }
    }
    return { tables: out, keptLocal }
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

  /**
   * No enviar {} si el servidor (o el último remoto conocido) tiene cuentas.
   * Los cobros reales mandan claves de mesa con cart vacío — eso sí se permite.
   */
  function shouldBlockEmptyPush(tables) {
    const qty = tablesQty(tables)
    const keys = tables && typeof tables === 'object' ? Object.keys(tables).length : 0
    if (qty > 0) return false
    if (lastRemoteQty > 0 && keys === 0) return true
    return false
  }

  async function pushNow(tables, mesa, opts = {}) {
    if (!ready && !opts.force) {
      pending = { tables, mesa }
      return null
    }
    if (shouldBlockEmptyPush(tables)) {
      console.warn('[tpvSync] push bloqueado: no vaciar servidor con {}')
      return null
    }
    const updatedAt = Date.now()
    lastLocalWrite = updatedAt
    const body = {
      kind: 'casa-torino-tpv',
      tables: tables || {},
      mesa: mesa || '',
      opsDay: opsDayId(),
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
          keepalive: !!opts.keepalive,
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
        lastRemoteQty = tablesQty(saved.tables || tables)
        if (!opts.keepalive) refreshSession()
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
    if (!ready) return
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

  /** Empuja al momento (antes de refresh/cerrar pestaña). */
  async function flush() {
    if (pushTimer) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
    const job = pending
    pending = null
    if (!job) return null
    if (!ready) return null
    try {
      return await pushNow(job.tables, job.mesa, { keepalive: true })
    } catch (err) {
      console.warn('[tpvSync] flush', err)
      return null
    }
  }

  function applyRemotePayload(remote) {
    const localSnap =
      typeof getLocalSnapshot === 'function' ? getLocalSnapshot() : { tables: {}, mesa: '' }
    const merged = mergeTables(localSnap.tables || {}, remote.tables || {})
    const remoteAt = Number(remote?.updatedAt || 0)
    if (remoteAt > lastRemoteUpdatedAt) lastRemoteUpdatedAt = remoteAt
    lastRemoteQty = tablesQty(remote.tables || {})

    if (typeof onRemote === 'function') {
      onRemote({
        tables: merged.tables,
        mesa: remote.mesa || localSnap.mesa || '',
        updatedAt: remoteAt,
        keptLocal: merged.keptLocal,
      })
    }

    if (merged.keptLocal) {
      const m = localSnap.mesa || remote.mesa || ''
      push(merged.tables, m)
    }
  }

  async function tick() {
    if (polling || !ready) return
    polling = true
    try {
      const remote = await pull()
      const remoteAt = Number(remote?.updatedAt || 0)
      if (!remoteAt) return

      if (remote.clientId === CLIENT_ID) {
        if (remoteAt > lastRemoteUpdatedAt) lastRemoteUpdatedAt = remoteAt
        lastRemoteQty = tablesQty(remote.tables || {})
        return
      }

      if (remoteAt > lastRemoteUpdatedAt && remoteAt > lastLocalWrite) {
        applyRemotePayload(remote)
      } else if (remoteAt > lastRemoteUpdatedAt) {
        lastRemoteUpdatedAt = remoteAt
        lastRemoteQty = tablesQty(remote.tables || {})
      }
    } catch (err) {
      console.warn('[tpvSync]', err)
    } finally {
      polling = false
    }
  }

  /**
   * Arranque: merge local↔remoto ANTES del polling / cualquier push.
   * Evita el wipe al refrescar (POST {} pisa Supabase).
   */
  async function hydrate(localTables, localMesa) {
    try {
      const remote = await pull()
      const remoteAt = Number(remote?.updatedAt || 0)
      if (remoteAt) lastRemoteUpdatedAt = remoteAt
      lastRemoteQty = tablesQty(remote?.tables || {})
      const merged = mergeTables(localTables || {}, remote?.tables || {})
      ready = true
      if (merged.keptLocal || tablesQty(merged.tables) > tablesQty(remote?.tables || {})) {
        lastLocalWrite = Date.now()
        try {
          await pushNow(merged.tables, localMesa || remote?.mesa || '', { force: true })
        } catch (err) {
          console.warn('[tpvSync] hydrate push', err)
        }
      } else if (pending) {
        // Empujar lo que quedó en cola durante el boot (si no era wipe)
        const job = pending
        pending = null
        try {
          await pushNow(job.tables, job.mesa, { force: true })
        } catch (err) {
          console.warn('[tpvSync] hydrate pending', err)
        }
      }
      return {
        tables: merged.tables,
        mesa: localMesa || remote?.mesa || '',
        updatedAt: remoteAt,
        keptLocal: merged.keptLocal,
      }
    } catch (err) {
      console.warn('[tpvSync] hydrate', err)
      // Sin remoto: permitir trabajo local, pero push vacío sigue bloqueado si hubo qty remota.
      ready = true
      return {
        tables: localTables || {},
        mesa: localMesa || '',
        updatedAt: 0,
        keptLocal: true,
      }
    }
  }

  function start(handler, authLostHandler, options = {}) {
    onRemote = handler
    onAuthLost = authLostHandler || null
    getLocalSnapshot =
      typeof options.getLocalSnapshot === 'function' ? options.getLocalSnapshot : null
    if (timer) clearInterval(timer)
    timer = setInterval(tick, POLL_MS)
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = setInterval(refreshSession, 15 * 60 * 1000)
    refreshSession()
    // tick inicial solo si no se hidrató fuera
    if (!options.skipInitialTick) tick()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
  }

  window.addEventListener('pagehide', () => {
    try {
      flush()
    } catch {}
  })
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      try {
        flush()
      } catch {}
    }
  })

  window.CasaTorinoTpvSync = {
    pull,
    push,
    pushNow,
    flush,
    hydrate,
    mergeTables,
    tablesQty,
    opsDayId,
    start,
    stop,
    tick,
    refreshSession,
    isReady: () => ready,
  }
})()

/**
 * Casa Torino TPV — sync mesas móvil ↔ PC
 * - lastLocalWrite al instante al editar (evita que un poll viejo resucite mesas vaciadas)
 * - opsDay 08:00 Madrid: purge diario sin resucitar
 * - Mesas cobradas (cart vacío en remoto) no se resucitan
 */
(() => {
  const API_URL = '/api/tpv-sync'
  const AUTH_URL = '/api/tpv-auth'
  // Dinero: poll agresivo en pantalla. Oculta: más lento pero no “apagado”.
  const POLL_MS = 2000
  const POLL_HIDDEN_MS = 12000
  const PUSH_DEBOUNCE_MS = 200
  const SB_URL = 'https://fpnjtgoxljqmwuukyrrm.supabase.co'
  const SB_ANON = 'sb_publishable_A_zxEJjB3NN_hh8Qdu7ccQ_qhcWGoz0'
  const SYNC_CHANNEL = 'casa-torino-tpv-live'
  const CLIENT_ID =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'c-' + Date.now() + '-' + Math.random().toString(16).slice(2)

  let lastLocalWrite = 0
  let lastLocalClearAt = 0
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
  let ready = false
  let visibilityBound = false
  let sbClient = null
  let sbChannel = null
  let realtimeStarted = false

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

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
    if (hour < 8) {
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
    if (!cart || typeof cart !== 'object' || Array.isArray(cart)) return 0
    for (const line of Object.values(cart)) n += Math.max(0, Number(line?.qty) || 0)
    return n
  }

  function tablesQty(tables) {
    let n = 0
    if (!tables || typeof tables !== 'object') return 0
    for (const t of Object.values(tables)) n += cartQty(t)
    return n
  }

  function touch(opts = {}) {
    lastLocalWrite = Date.now()
    if (opts.clear) lastLocalClearAt = lastLocalWrite
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
    sbClient = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 8 } },
    })
    return sbClient
  }

  async function notifyPeers(reason) {
    try {
      const c = await ensureSb()
      if (!sbChannel) return
      await sbChannel.send({
        type: 'broadcast',
        event: 'tpv-updated',
        payload: { at: Date.now(), clientId: CLIENT_ID, reason: reason || '' },
      })
    } catch (err) {
      console.warn('[tpvSync] notify', err)
    }
  }

  async function startRealtime() {
    if (realtimeStarted) return
    realtimeStarted = true
    try {
      const c = await ensureSb()
      sbChannel = c.channel(SYNC_CHANNEL, {
        config: { broadcast: { self: false } },
      })
      sbChannel.on('broadcast', { event: 'tpv-updated' }, (msg) => {
        const from = msg?.payload?.clientId
        if (from && from === CLIENT_ID) return
        // Otro dispositivo cambió mesas → pull YA
        tick(true).catch((err) => console.warn('[tpvSync] live tick', err))
      })
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
      console.warn('[tpvSync] realtime', err)
    }
  }

  /**
   * Merge por mesa. Si el día cambió (purge 08:00), gana el remoto aunque esté vacío.
   * Borrados usan tombstones (removed[key]=ts) para que NO resuciten.
   * Si remoto {} sin claves y mismo día, no pisa local (anti-wipe refresh).
   */
  function tableAt(t) {
    return Math.max(0, Number(t && t.updatedAt) || 0)
  }

  function normCart(cart) {
    return cart && typeof cart === 'object' && !Array.isArray(cart) ? cart : {}
  }

  function normRemoved(removed) {
    return removed && typeof removed === 'object' && !Array.isArray(removed)
      ? removed
      : {}
  }

  function linePresentTs(line, tableAtMs) {
    if (!line || typeof line !== 'object') return 0
    return Math.max(
      0,
      Number(line.updatedAt) || 0,
      Number(line.addedAt) || 0,
      Number(tableAtMs) || 0,
    )
  }

  function pruneRemoved(removed, now = Date.now()) {
    const out = {}
    const maxAge = 36 * 60 * 60 * 1000
    for (const [k, ts] of Object.entries(normRemoved(removed))) {
      const n = Number(ts) || 0
      if (n > 0 && now - n < maxAge) out[k] = n
    }
    return out
  }

  /**
   * LWW por línea + tombstones. Un borrado reciente gana; un add concurrente
   * en otra línea no se pierde.
   */
  function mergeCarts(cartA, cartB, removedA, removedB, atA, atB) {
    const a = normCart(cartA)
    const b = normCart(cartB)
    const remA = normRemoved(removedA)
    const remB = normRemoved(removedB)
    const keys = new Set([
      ...Object.keys(a),
      ...Object.keys(b),
      ...Object.keys(remA),
      ...Object.keys(remB),
    ])
    const out = {}
    const removed = {}

    for (const key of keys) {
      const lineA = a[key]
      const lineB = b[key]
      const hasA =
        lineA &&
        typeof lineA === 'object' &&
        Math.max(0, Number(lineA.qty) || 0) > 0
      const hasB =
        lineB &&
        typeof lineB === 'object' &&
        Math.max(0, Number(lineB.qty) || 0) > 0
      const presentA = hasA ? linePresentTs(lineA, atA) : 0
      const presentB = hasB ? linePresentTs(lineB, atB) : 0
      const remTs = Math.max(0, Number(remA[key]) || 0, Number(remB[key]) || 0)

      if (remTs > 0 && remTs >= presentA && remTs >= presentB) {
        removed[key] = remTs
        continue
      }

      if (hasA || hasB) {
        let win = null
        if (hasA && hasB) win = presentA >= presentB ? lineA : lineB
        else win = hasA ? lineA : lineB
        if (win && Math.max(0, Number(win.qty) || 0) > 0) out[key] = win
      } else if (remTs > 0) {
        removed[key] = remTs
      }
    }

    return { cart: out, removed: pruneRemoved(removed) }
  }

  function mergeHist(newerHist, olderHist) {
    const out = []
    const seen = new Set()
    for (const h of [
      ...(Array.isArray(newerHist) ? newerHist : []),
      ...(Array.isArray(olderHist) ? olderHist : []),
    ]) {
      const k = String(h || '')
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push(k)
    }
    return out.slice(-80)
  }

  function mergeBusyTables(a, b, preferA) {
    const aAt = tableAt(a)
    const bAt = tableAt(b)
    let newer = a
    let older = b
    if (aAt !== bAt) {
      newer = aAt > bAt ? a : b
      older = aAt > bAt ? b : a
    } else if (!preferA) {
      newer = b
      older = a
    }
    const merged = mergeCarts(a.cart, b.cart, a.removed, b.removed, aAt, bAt)
    return {
      cart: merged.cart,
      removed: merged.removed,
      hist: mergeHist(newer.hist, older.hist),
      notes: String(newer.notes || older.notes || ''),
      paid: String(newer.paid || older.paid || ''),
      updatedAt: Math.max(aAt, bAt),
    }
  }

  function mergeTables(localTables, remoteTables, opts = {}) {
    const local = localTables && typeof localTables === 'object' ? localTables : {}
    const remote = remoteTables && typeof remoteTables === 'object' ? remoteTables : {}
    const rKeys = Object.keys(remote)
    const lTotal = tablesQty(local)
    const remoteOpsDay = opts.remoteOpsDay ? String(opts.remoteOpsDay) : ''
    const localOpsDay = opts.localOpsDay ? String(opts.localOpsDay) : ''
    const today = opsDayId()
    const dayChanged =
      (remoteOpsDay && localOpsDay && remoteOpsDay !== localOpsDay) ||
      (remoteOpsDay && remoteOpsDay === today && localOpsDay && localOpsDay !== today)

    if (dayChanged) {
      return { tables: remote, keptLocal: false, dayRollover: true }
    }

    if (rKeys.length === 0 && lTotal > 0) {
      return { tables: local, keptLocal: true }
    }

    const keys = new Set([...Object.keys(local), ...rKeys])
    const out = {}
    let keptLocal = false
    for (const k of keys) {
      const L = local[k]
      const R = remote[k]
      const hasR = Object.prototype.hasOwnProperty.call(remote, k)
      const hasL = Object.prototype.hasOwnProperty.call(local, k)
      const lq = cartQty(L)
      const rq = cartQty(R)
      const lAt = tableAt(L)
      const rAt = tableAt(R)

      if (hasR && hasL) {
        // Mesa vaciada localmente: no dejar que un remoto viejo la rellene
        if (lq === 0 && rq > 0) {
          if (lAt >= rAt || opts.preferLocalClear) {
            out[k] = L
            keptLocal = true
          } else {
            out[k] = R
          }
          continue
        }
        // Remoto vació la mesa (cobro en otro dispositivo)
        if (rq === 0 && lq > 0) {
          if (rAt >= lAt) {
            out[k] = R
          } else {
            out[k] = L
            keptLocal = true
          }
          continue
        }
        // Ambos con productos: LWW por línea + tombstones (borrado no resucita)
        if (lq > 0 && rq > 0) {
          const preferLocal = lAt > rAt || (lAt === rAt && opts.preferLocalClear)
          out[k] = mergeBusyTables(L, R, preferLocal)
          // Re-push solo si local aporta líneas VIVAS que el remoto no tiene
          // (no por haber “resucitado” algo borrado)
          const remoteKeys = new Set(Object.keys(normCart(R.cart)))
          for (const ck of Object.keys(normCart(out[k].cart))) {
            if (!remoteKeys.has(ck)) {
              keptLocal = true
              break
            }
          }
          continue
        }
        // Ambos vacíos
        if (rAt !== lAt) {
          if (rAt > lAt) out[k] = R
          else {
            out[k] = L
            keptLocal = true
          }
        } else {
          out[k] = R
        }
      } else if (hasR) {
        out[k] = R
      } else if (hasL) {
        out[k] = L
        if (lq > 0) keptLocal = true
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

  function clientHeaders(extra) {
    if (typeof window.__casaTorinoTpvClientHeaders === 'function') {
      return window.__casaTorinoTpvClientHeaders(extra)
    }
    return Object.assign({ 'Cache-Control': 'no-store' }, extra || {})
  }

  function noteTpvForce(payload) {
    try {
      if (payload && payload.tpvForce && typeof window.__casaTorinoApplyTpvForce === 'function') {
        window.__casaTorinoTpvForceRequired = payload.tpvForce.required
        window.__casaTorinoApplyTpvForce(payload.tpvForce)
      }
    } catch (err) {
      console.warn('[tpvSync] force', err)
    }
  }

  async function handleForceStatus(r) {
    if (r.status !== 426) return null
    const data = await r.json().catch(() => ({}))
    noteTpvForce(data)
    const err = new Error('update_required')
    err.status = 426
    err.data = data
    throw err
  }

  async function pull() {
    let lastErr = null
    for (let i = 1; i <= 3; i++) {
      try {
        const r = await fetch(API_URL, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: clientHeaders(),
        })
        if (r.status === 426) await handleForceStatus(r)
        if (!r.ok) throw new Error('sync GET ' + r.status)
        const data = await r.json()
        noteTpvForce(data)
        return data
      } catch (err) {
        lastErr = err
        if (err && err.status === 426) throw err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('sync GET failed')
  }

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
      touch()
      return null
    }
    if (shouldBlockEmptyPush(tables) && !opts.allowEmpty) {
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
          headers: clientHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
          keepalive: !!opts.keepalive,
        })
        if (r.status === 426) await handleForceStatus(r)
        if (r.status === 401) {
          if (typeof onAuthLost === 'function') onAuthLost()
          const err = new Error('Sesión caducada — vuelve a poner el PIN')
          err.status = 401
          throw err
        }
        if (!r.ok) throw new Error('sync POST ' + r.status)
        const saved = await r.json().catch(() => body)
        noteTpvForce(saved)
        lastRemoteUpdatedAt = Number(saved.updatedAt || updatedAt)
        lastRemoteQty = tablesQty(saved.tables || tables)
        if (!opts.keepalive) refreshSession()
        // Avisar al resto de dispositivos al instante (móvil ↔ Windows)
        notifyPeers('push').catch(() => {})
        return saved
      } catch (err) {
        lastErr = err
        if (err.status === 401 || err.status === 426) throw err
        await sleep(250 * i * i)
      }
    }
    throw lastErr || new Error('sync POST failed')
  }

  function push(tables, mesa) {
    pending = { tables, mesa }
    touch() // inmediato: un poll viejo no puede pisar un vaciado
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

  function applyRemotePayload(remote, opts = {}) {
    const remoteAt = Number(remote?.updatedAt || 0)
    const fromOther =
      remote && remote.clientId && remote.clientId !== CLIENT_ID

    // CRÍTICO: si viene de OTRO dispositivo, SIEMPRE mergear.
    // Antes se descartaba si lastLocalWrite era reciente → Windows no veía el móvil.
    if (!fromOther && remoteAt && remoteAt <= lastLocalWrite && !opts.force) {
      if (remoteAt > lastRemoteUpdatedAt) lastRemoteUpdatedAt = remoteAt
      return
    }

    const localSnap =
      typeof getLocalSnapshot === 'function'
        ? getLocalSnapshot()
        : { tables: {}, mesa: '', opsDay: '' }
    const merged = mergeTables(localSnap.tables || {}, remote.tables || {}, {
      remoteOpsDay: remote?.opsDay,
      localOpsDay: localSnap.opsDay || '',
      // Solo proteger vaciados locales recientes (cobro), no cualquier touch
      preferLocalClear: Date.now() - lastLocalClearAt < 5000,
    })
    if (remoteAt > lastRemoteUpdatedAt) lastRemoteUpdatedAt = remoteAt
    lastRemoteQty = tablesQty(remote.tables || {})

    if (typeof onRemote === 'function') {
      onRemote({
        tables: merged.tables,
        mesa: remote.mesa || localSnap.mesa || '',
        updatedAt: remoteAt,
        keptLocal: merged.keptLocal,
        opsDay: remote?.opsDay,
        fromOther: Boolean(fromOther),
      })
    }

    if (merged.keptLocal) {
      const m = localSnap.mesa || remote.mesa || ''
      push(merged.tables, m)
    }
  }

  async function tick(force) {
    if (polling || !ready) return
    polling = true
    try {
      const remote = await pull()
      const remoteAt = Number(remote?.updatedAt || 0)
      if (!remoteAt) return

      const fromSelf = remote.clientId === CLIENT_ID
      if (fromSelf) {
        if (remoteAt > lastRemoteUpdatedAt) lastRemoteUpdatedAt = remoteAt
        lastRemoteQty = tablesQty(remote.tables || {})
        return
      }

      // Otro dispositivo: aplicar si es más nuevo O si forzamos (broadcast live)
      if (force || remoteAt > lastRemoteUpdatedAt) {
        applyRemotePayload(remote, { force: Boolean(force) })
      }
    } catch (err) {
      console.warn('[tpvSync]', err)
    } finally {
      polling = false
    }
  }

  async function hydrate(localTables, localMesa, localOpsDay) {
    try {
      const remote = await pull()
      const remoteAt = Number(remote?.updatedAt || 0)
      if (remoteAt) lastRemoteUpdatedAt = remoteAt
      lastRemoteQty = tablesQty(remote?.tables || {})
      const merged = mergeTables(localTables || {}, remote?.tables || {}, {
        remoteOpsDay: remote?.opsDay,
        localOpsDay: localOpsDay || '',
      })
      ready = true
      if (merged.dayRollover) {
        return {
          tables: merged.tables,
          mesa: remote?.mesa || '',
          opsDay: remote?.opsDay || opsDayId(),
          updatedAt: remoteAt,
          keptLocal: false,
          dayRollover: true,
        }
      }
      if (merged.keptLocal || tablesQty(merged.tables) > tablesQty(remote?.tables || {})) {
        touch()
        try {
          await pushNow(merged.tables, localMesa || remote?.mesa || '', { force: true })
        } catch (err) {
          console.warn('[tpvSync] hydrate push', err)
        }
      } else if (pending) {
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
        opsDay: remote?.opsDay || opsDayId(),
        updatedAt: remoteAt,
        keptLocal: merged.keptLocal,
      }
    } catch (err) {
      console.warn('[tpvSync] hydrate', err)
      ready = true
      return {
        tables: localTables || {},
        mesa: localMesa || '',
        opsDay: localOpsDay || opsDayId(),
        updatedAt: 0,
        keptLocal: true,
      }
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

  function start(handler, authLostHandler, options = {}) {
    onRemote = handler
    onAuthLost = authLostHandler || null
    getLocalSnapshot =
      typeof options.getLocalSnapshot === 'function' ? options.getLocalSnapshot : null
    schedule()
    startRealtime().catch(() => {})
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = setInterval(refreshSession, 15 * 60 * 1000)
    refreshSession()
    if (!options.skipInitialTick) tick()
    if (!visibilityBound && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          try {
            flush()
          } catch {}
        }
        schedule()
        if (!document.hidden) tick(true)
      })
      visibilityBound = true
    }
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

  window.CasaTorinoTpvSync = {
    pull,
    push,
    pushNow,
    flush,
    touch,
    hydrate,
    mergeTables,
    mergeCarts,
    tablesQty,
    cartQty,
    opsDayId,
    start,
    stop,
    tick,
    refreshSession,
    isReady: () => ready,
  }
})()

/**
 * Casa Torino TPV — cliente de jornada / totales de caja (endurecido 24/7)
 */
(() => {
  const API_URL = '/api/tpv-jornada'
  const AUTH_URL = '/api/tpv-auth'
  // Europe/Madrid — ahorro CDN Hobby:
  // - De día (<22:00): sin auto-poll; Total día máx. 2 consultas (PIN).
  // - Desde 22:00 (~hasta 06:00): poll suave + consultas ilimitadas.
  // - Fin de jornada: el TPV abre el resumen (no cuenta en el cupo de día).
  const EVENING_FROM_HOUR = 22
  const EVENING_UNTIL_HOUR = 6
  const DAYTIME_TOTAL_LOOKS_MAX = 2
  const EVENING_POLL_MS = 3 * 60 * 1000
  const EVENING_HIDDEN_MS = 10 * 60 * 1000
  const SCHEDULE_CHECK_MS = 30000
  const RETRIES = 3
  let heartbeat = null
  let scheduleTimer = null
  let lastEveningPullAt = 0
  let onUpdate = null
  let onAuthLost = null
  let last = null
  let visibilityBound = false

  function madridClockParts(ts = Date.now()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = Object.fromEntries(
      fmt
        .formatToParts(new Date(ts))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    )
    return {
      dayKey: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    }
  }

  function isEveningWindow(p) {
    // 22:00–23:59 y madrugada hasta 05:59 (cierre de turno)
    return p.hour >= EVENING_FROM_HOUR || p.hour < EVENING_UNTIL_HOUR
  }

  function maybeEveningRefresh() {
    const delay =
      typeof document !== 'undefined' && document.hidden
        ? EVENING_HIDDEN_MS
        : EVENING_POLL_MS
    const now = Date.now()
    if (now - lastEveningPullAt < delay) return
    lastEveningPullAt = now
    refresh().catch((err) => console.warn('[tpvJornada] evening', err))
  }

  function tickSchedule() {
    try {
      const p = madridClockParts()
      // De día: nada automático (miráis Total día a la hora que queráis).
      if (isEveningWindow(p)) maybeEveningRefresh()
    } catch (err) {
      console.warn('[tpvJornada] schedule', err)
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  function clientHeaders(extra) {
    if (typeof window.__casaTorinoTpvClientHeaders === 'function') {
      return window.__casaTorinoTpvClientHeaders(extra)
    }
    return Object.assign({ 'Cache-Control': 'no-store' }, extra || {})
  }

  function noteForce(data) {
    try {
      if (data && data.tpvForce && typeof window.__casaTorinoApplyTpvForce === 'function') {
        window.__casaTorinoTpvForceRequired = data.tpvForce.required
        window.__casaTorinoApplyTpvForce(data.tpvForce)
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

  async function pull() {
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
        if (!r.ok) throw new Error('jornada GET ' + r.status)
        noteForce(data)
        return data
      } catch (err) {
        lastErr = err
        if (err && err.status === 426) throw err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('jornada GET failed')
  }

  async function post(action, extra) {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: clientHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ action, ...(extra || {}) }),
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
          const err = new Error(data.error || 'Sesión caducada — vuelve a introducir el PIN')
          err.status = 401
          err.data = data
          throw err
        }
        if (!r.ok) {
          const err = new Error(data.error || 'jornada POST ' + r.status)
          err.status = r.status
          err.data = data
          throw err
        }
        last = data
        if (typeof onUpdate === 'function') onUpdate(data)
        refreshSession()
        return data
      } catch (err) {
        lastErr = err
        // No reintentar conflictos de negocio ni auth ni force-update
        if (
          err.status === 401 ||
          err.status === 426 ||
          err.status === 400 ||
          err.status === 404 ||
          err.status === 409
        ) {
          throw err
        }
        await sleep(250 * i * i)
      }
    }
    throw lastErr || new Error('jornada POST failed')
  }

  async function start() {
    return post('start')
  }

  async function end() {
    return post('end')
  }

  async function addSale(sale) {
    return post('sale', { sale })
  }

  async function updateSale(sale) {
    return post('updateSale', { sale })
  }

  async function deleteSale(saleId) {
    return post('deleteSale', { saleId })
  }

  async function updateLine(saleId, lineId, patch) {
    return post('updateLine', { saleId, lineId, ...(patch || {}) })
  }

  async function reset() {
    return post('reset')
  }

  async function refresh() {
    const data = await pull()
    last = data
    if (typeof onUpdate === 'function') onUpdate(data)
    return data
  }

  function startPolling(handler, authLostHandler) {
    onUpdate = handler
    onAuthLost = authLostHandler || null
    // Arranque: estado abierta/cerrada. Luego horario Madrid (slots / evening).
    refresh().catch((err) => console.warn('[tpvJornada]', err))
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = setInterval(refreshSession, 20 * 60 * 1000)
    refreshSession()
    if (scheduleTimer) clearInterval(scheduleTimer)
    tickSchedule()
    scheduleTimer = setInterval(tickSchedule, SCHEDULE_CHECK_MS)
    if (!visibilityBound && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) tickSchedule()
      })
      visibilityBound = true
    }
  }

  function stopPolling() {
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
    if (scheduleTimer) clearInterval(scheduleTimer)
    scheduleTimer = null
  }

  window.CasaTorinoTpvJornada = {
    pull,
    refresh,
    start,
    end,
    addSale,
    updateSale,
    deleteSale,
    updateLine,
    reset,
    startPolling,
    stopPolling,
    refreshSession,
    madridClockParts,
    isEveningWindow: (p) => isEveningWindow(p || madridClockParts()),
    DAYTIME_TOTAL_LOOKS_MAX,
    get last() {
      return last
    },
  }
})()

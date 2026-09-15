/**
 * Casa Torino TPV — cliente de jornada / totales de caja (endurecido 24/7)
 */
(() => {
  const API_URL = '/api/tpv-jornada'
  const AUTH_URL = '/api/tpv-auth'
  const POLL_MS = 12000
  const RETRIES = 3
  let timer = null
  let heartbeat = null
  let onUpdate = null
  let onAuthLost = null
  let last = null

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
        if (!r.ok) throw new Error('jornada GET ' + r.status)
        return await r.json()
      } catch (err) {
        lastErr = err
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...(extra || {}) }),
        })
        const data = await r.json().catch(() => ({}))
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
        // No reintentar conflictos de negocio ni auth
        if (
          err.status === 401 ||
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
    refresh().catch((err) => console.warn('[tpvJornada]', err))
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      refresh().catch((err) => console.warn('[tpvJornada]', err))
    }, POLL_MS)
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = setInterval(refreshSession, 15 * 60 * 1000)
    refreshSession()
  }

  function stopPolling() {
    if (timer) clearInterval(timer)
    timer = null
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
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
    get last() {
      return last
    },
  }
})()

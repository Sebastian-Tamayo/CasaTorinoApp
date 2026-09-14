/**
 * Casa Torino TPV — cliente de jornada / totales de caja
 */
(() => {
  const API_URL = '/api/tpv-jornada'
  const POLL_MS = 4000
  let timer = null
  let onUpdate = null
  let last = null

  async function pull() {
    const r = await fetch(API_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-store' },
    })
    if (!r.ok) throw new Error('jornada GET ' + r.status)
    return r.json()
  }

  async function post(action, extra) {
    const r = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(extra || {}) }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const err = new Error(data.error || 'jornada POST ' + r.status)
      err.status = r.status
      err.data = data
      throw err
    }
    last = data
    if (typeof onUpdate === 'function') onUpdate(data)
    return data
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

  function startPolling(handler) {
    onUpdate = handler
    refresh().catch((err) => console.warn('[tpvJornada]', err))
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      refresh().catch((err) => console.warn('[tpvJornada]', err))
    }, POLL_MS)
  }

  function stopPolling() {
    if (timer) clearInterval(timer)
    timer = null
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
    get last() {
      return last
    },
  }
})()

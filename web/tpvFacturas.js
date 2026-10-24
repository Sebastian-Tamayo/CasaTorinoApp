/**
 * Casa Torino TPV — cliente facturas simplificadas
 */
(() => {
  const API_URL = '/api/tpv-facturas'
  const RETRIES = 3
  let cached = null

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
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
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || 'facturas GET ' + r.status)
        cached = data
        return data
      } catch (err) {
        lastErr = err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('facturas GET failed')
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
          const err = new Error(data.error || 'Sesión caducada')
          err.status = 401
          err.data = data
          throw err
        }
        if (!r.ok) {
          const err = new Error(data.error || 'facturas POST ' + r.status)
          err.status = r.status
          err.data = data
          throw err
        }
        cached = data
        return data
      } catch (err) {
        lastErr = err
        if (err.status === 400 || err.status === 401 || err.status === 409) throw err
        await sleep(250 * i * i)
      }
    }
    throw lastErr || new Error('facturas POST failed')
  }

  async function getStatus() {
    return pull()
  }

  async function setFiscal(fiscal) {
    return post('setFiscal', { fiscal })
  }

  async function issue(invoice) {
    return post('issue', { invoice })
  }

  function lastStatus() {
    return cached
  }

  window.CasaTorinoTpvFacturas = {
    getStatus,
    setFiscal,
    issue,
    lastStatus,
  }
})()

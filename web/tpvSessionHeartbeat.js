/**
 * Un solo timer de renovación de cookie TPV (/api/tpv-auth refresh).
 * Antes: tpvSync + jornada + kitchenSync = hasta 3× cada 20 min por dispositivo.
 */
;(() => {
  const AUTH_URL = '/api/tpv-auth'
  const INTERVAL_MS = 20 * 60 * 1000

  let timer = null
  let refs = 0

  function clientHeaders(extra) {
    if (typeof window.__casaTorinoTpvClientHeaders === 'function') {
      return window.__casaTorinoTpvClientHeaders(extra)
    }
    if (typeof window.__casaTorinoCocinaClientHeaders === 'function') {
      return window.__casaTorinoCocinaClientHeaders(extra)
    }
    return Object.assign({ 'Cache-Control': 'no-store' }, extra || {})
  }

  async function refresh() {
    try {
      await fetch(AUTH_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: clientHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ refresh: true }),
      })
    } catch {}
  }

  function start() {
    refs += 1
    if (timer) return
    timer = setInterval(refresh, INTERVAL_MS)
    refresh()
  }

  function stop() {
    refs = Math.max(0, refs - 1)
    if (refs > 0) return
    if (timer) clearInterval(timer)
    timer = null
  }

  window.CasaTorinoTpvSessionHeartbeat = {
    start,
    stop,
    refresh,
  }
})()

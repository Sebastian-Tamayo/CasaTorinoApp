/**
 * Casa Torino — avisos TPV de reservas web
 * Polling contra el API de reservas (mismo store que la app de personal).
 */
(() => {
  const API_URL = 'https://reservas-casatorino.vercel.app/api/reservas-alerts'
  const POLL_MS = 3500
  const RETRIES = 3

  let timer = null
  let polling = false
  let knownIds = new Set()
  let bootstrapped = false
  let onUpdate = null
  let onNew = null

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  async function pull() {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, {
          cache: 'no-store',
        })
        if (!r.ok) throw new Error('reservas-alerts GET ' + r.status)
        return await r.json()
      } catch (err) {
        lastErr = err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('reservas-alerts GET failed')
  }

  async function ack(id) {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ack', id: id || '' }),
        })
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || 'reservas-alerts ack ' + r.status)
        return data
      } catch (err) {
        lastErr = err
        await sleep(250 * i * i)
      }
    }
    throw lastErr || new Error('reservas-alerts ack failed')
  }

  async function tick() {
    if (polling) return
    polling = true
    try {
      const remote = await pull()
      const alerts = Array.isArray(remote?.alerts) ? remote.alerts : []
      const ids = new Set(alerts.map((a) => a && a.id).filter(Boolean))
      let newAlerts = []

      if (!bootstrapped) {
        bootstrapped = true
        knownIds = ids
      } else {
        newAlerts = alerts.filter((a) => a && a.id && !knownIds.has(a.id))
        knownIds = ids
        for (const a of newAlerts) knownIds.add(a.id)
      }

      if (typeof onUpdate === 'function') {
        onUpdate({ alerts, newAlerts, updatedAt: Number(remote?.updatedAt || 0) })
      }
      if (newAlerts.length && typeof onNew === 'function') {
        onNew(newAlerts, alerts)
      }
    } catch (err) {
      console.warn('[reservaAlertSync]', err)
    } finally {
      polling = false
    }
  }

  function start(updateHandler, newHandler) {
    onUpdate = updateHandler || null
    onNew = newHandler || null
    bootstrapped = false
    tick()
    if (timer) clearInterval(timer)
    timer = setInterval(tick, POLL_MS)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  window.CasaTorinoReservaAlertSync = {
    pull,
    ack,
    start,
    stop,
    tick,
  }
})()

/**
 * Casa Torino — avisos TPV de reservas web
 * - Lectura DIRECTA Supabase ops_kv (`tpvReservaAlerts`) + Realtime
 * - Casi no quema CDN Hobby de Vercel
 * - API reservas-casatorino solo como fallback
 */
;(() => {
  const API_URL = 'https://reservas-casatorino.vercel.app/api/reservas-alerts'
  const ALERTS_KEY = 'tpvReservaAlerts'
  const LIVE_CHANNEL = 'casa-torino-reserva-alerts'
  const SB_URL = 'https://fpnjtgoxljqmwuukyrrm.supabase.co'
  const SB_ANON = 'sb_publishable_A_zxEJjB3NN_hh8Qdu7ccQ_qhcWGoz0'
  // Respaldo muy lento: el vivo va por Realtime (0 Vercel).
  const POLL_MS = 15 * 60 * 1000
  const POLL_HIDDEN_MS = 30 * 60 * 1000
  const ALERT_TTL_MS = 24 * 60 * 60 * 1000
  const ALERTS_MAX = 30
  const RETRIES = 3

  let timer = null
  let polling = false
  let knownIds = new Set()
  let bootstrapped = false
  let onUpdate = null
  let onNew = null
  let visibilityBound = false
  let sbClient = null
  let sbChannel = null
  let realtimeStarted = false

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  function normalizePayload(value) {
    const raw = Array.isArray(value?.alerts)
      ? value.alerts
      : Array.isArray(value)
        ? value
        : []
    const now = Date.now()
    const alerts = raw
      .filter((a) => a && a.id)
      .filter((a) => {
        const created = Date.parse(String(a.createdAt || '')) || 0
        return !created || now - created < ALERT_TTL_MS
      })
      .slice(0, ALERTS_MAX)
    return {
      alerts,
      updatedAt: Number(value?.updatedAt) || now,
    }
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
    if (window.__casaTorinoSbClient) {
      sbClient = window.__casaTorinoSbClient
      return sbClient
    }
    sbClient = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 4 } },
    })
    window.__casaTorinoSbClient = sbClient
    return sbClient
  }

  async function pullFromSupabase() {
    const c = await ensureSb()
    const { data, error } = await c
      .from('ops_kv')
      .select('value')
      .eq('key', ALERTS_KEY)
      .maybeSingle()
    if (error) throw error
    return normalizePayload(data?.value)
  }

  async function pullFromApi() {
    let lastErr = null
    for (let i = 1; i <= RETRIES; i++) {
      try {
        const r = await fetch(API_URL, { cache: 'no-store' })
        if (!r.ok) throw new Error('reservas-alerts GET ' + r.status)
        return normalizePayload(await r.json())
      } catch (err) {
        lastErr = err
        await sleep(200 * i)
      }
    }
    throw lastErr || new Error('reservas-alerts GET failed')
  }

  async function pull() {
    try {
      return await pullFromSupabase()
    } catch (err) {
      console.warn('[reservaAlertSync] pull SB → API', err)
      return pullFromApi()
    }
  }

  async function ackViaSupabase(id) {
    const c = await ensureSb()
    const alertId = String(id || '').trim()
    const { data, error } = await c
      .from('ops_kv')
      .select('value')
      .eq('key', ALERTS_KEY)
      .maybeSingle()
    if (error) throw error
    const cur = normalizePayload(data?.value)
    const nextAlerts = alertId
      ? cur.alerts.filter((a) => a && a.id !== alertId)
      : []
    const payload = {
      alerts: nextAlerts.slice(0, ALERTS_MAX),
      updatedAt: Date.now(),
    }
    const { error: e2 } = await c.from('ops_kv').upsert(
      {
        key: ALERTS_KEY,
        value: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    if (e2) throw e2
    try {
      if (sbChannel) {
        await sbChannel.send({
          type: 'broadcast',
          event: 'reserva-alerts-updated',
          payload: { at: Date.now(), reason: 'ack' },
        })
      }
    } catch {}
    return {
      ok: true,
      removed: cur.alerts.length - nextAlerts.length,
      ...payload,
    }
  }

  async function ackViaApi(id) {
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

  async function ack(id) {
    try {
      return await ackViaSupabase(id)
    } catch (err) {
      console.warn('[reservaAlertSync] ack SB → API', err)
      return ackViaApi(id)
    }
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
        onUpdate({
          alerts,
          newAlerts,
          updatedAt: Number(remote?.updatedAt || 0),
        })
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

  async function startRealtime() {
    if (realtimeStarted) return
    realtimeStarted = true
    try {
      const c = await ensureSb()
      sbChannel = c.channel(LIVE_CHANNEL, {
        config: { broadcast: { self: false } },
      })
      sbChannel.on('broadcast', { event: 'reserva-alerts-updated' }, () => {
        tick().catch((err) => console.warn('[reservaAlertSync] live tick', err))
      })
      sbChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ops_kv',
          filter: `key=eq.${ALERTS_KEY}`,
        },
        () => {
          tick().catch((err) => console.warn('[reservaAlertSync] pg tick', err))
        },
      )
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
      console.warn('[reservaAlertSync] realtime', err)
    }
  }

  function pollDelay() {
    return typeof document !== 'undefined' && document.hidden
      ? POLL_HIDDEN_MS
      : POLL_MS
  }

  function schedule() {
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      tick().catch(() => {})
    }, pollDelay())
  }

  function start(updateHandler, newHandler) {
    onUpdate = updateHandler || null
    onNew = newHandler || null
    bootstrapped = false
    tick()
    schedule()
    startRealtime().catch(() => {})
    if (!visibilityBound && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        schedule()
        if (!document.hidden) tick()
      })
      visibilityBound = true
    }
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    try {
      if (sbChannel) {
        const c = sbClient
        const ch = sbChannel
        sbChannel = null
        c?.removeChannel?.(ch)
      }
    } catch {}
    realtimeStarted = false
  }

  window.CasaTorinoReservaAlertSync = {
    pull,
    ack,
    start,
    stop,
    tick,
  }
})()

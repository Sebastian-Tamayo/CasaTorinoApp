/**
 * Casa Torino — audit de movimientos TPV → ops_kv (clave tpv_audit).
 * Escritura directa a Supabase (0 invocaciones Vercel por tap).
 */
(() => {
  const AUDIT_KEY = 'tpv_audit'
  const MAX_EVENTS = 500
  const SB_URL = 'https://fpnjtgoxljqmwuukyrrm.supabase.co'
  const SB_ANON = 'sb_publishable_A_zxEJjB3NN_hh8Qdu7ccQ_qhcWGoz0'
  const FLUSH_MS = 450
  const MAX_BATCH = 40

  let queue = []
  let flushTimer = null
  let flushing = false
  let sbClient = null

  function emptyStore() {
    return { version: 1, logins: [], events: [], updatedAt: Date.now() }
  }

  function trimRing(arr, max) {
    if (!Array.isArray(arr)) return []
    if (arr.length <= max) return arr
    return arr.slice(arr.length - max)
  }

  function sanitize(ev) {
    if (!ev || typeof ev !== 'object') return null
    const type = String(ev.type || '').trim().slice(0, 40)
    if (!type) return null
    const out = {
      t: Number(ev.t) || Date.now(),
      type,
      userId: String(ev.userId || '').trim().slice(0, 40),
      userName: String(ev.userName || '').trim().slice(0, 40),
    }
    if (ev.mesa != null && String(ev.mesa).trim()) {
      out.mesa = String(ev.mesa).trim().slice(0, 8)
    }
    if (ev.item != null && String(ev.item).trim()) {
      out.item = String(ev.item).trim().slice(0, 160)
    }
    if (ev.qtyBefore != null && Number.isFinite(Number(ev.qtyBefore))) {
      out.qtyBefore = Number(ev.qtyBefore)
    }
    if (ev.qtyAfter != null && Number.isFinite(Number(ev.qtyAfter))) {
      out.qtyAfter = Number(ev.qtyAfter)
    }
    if (ev.note != null && String(ev.note).trim()) {
      out.note = String(ev.note).trim().slice(0, 200)
    }
    if (ev.amount != null && Number.isFinite(Number(ev.amount))) {
      out.amount = Math.round(Number(ev.amount) * 100) / 100
    }
    if (ev.price != null && Number.isFinite(Number(ev.price))) {
      out.price = Math.round(Number(ev.price) * 100) / 100
    }
    if (ev.tip != null && Number.isFinite(Number(ev.tip))) {
      out.tip = Math.round(Number(ev.tip) * 100) / 100
    }
    if (ev.linesCount != null && Number.isFinite(Number(ev.linesCount))) {
      out.linesCount = Math.max(0, Math.round(Number(ev.linesCount)))
    }
    if (ev.payMethod != null && String(ev.payMethod).trim()) {
      out.payMethod = String(ev.payMethod).trim().slice(0, 24)
    }
    if (ev.scope != null && String(ev.scope).trim()) {
      out.scope = String(ev.scope).trim().slice(0, 24)
    }
    if (ev.category != null && String(ev.category).trim()) {
      out.category = String(ev.category).trim().slice(0, 24)
    }
    if (ev.owner != null && String(ev.owner).trim()) {
      out.owner = String(ev.owner).trim().slice(0, 40)
    }
    return out
  }

  async function ensureSb() {
    if (sbClient) return sbClient
    if (window.__casaTorinoSbClient) {
      sbClient = window.__casaTorinoSbClient
      return sbClient
    }
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
    })
    window.__casaTorinoSbClient = sbClient
    return sbClient
  }

  function scheduleFlush() {
    if (flushTimer) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      void flush()
    }, FLUSH_MS)
  }

  async function flush() {
    if (flushing || !queue.length) return
    flushing = true
    const batch = queue.splice(0, MAX_BATCH)
    try {
      const c = await ensureSb()
      const { data, error } = await c
        .from('ops_kv')
        .select('value')
        .eq('key', AUDIT_KEY)
        .maybeSingle()
      if (error) throw error
      const prev =
        data?.value && typeof data.value === 'object' ? data.value : emptyStore()
      const logins = Array.isArray(prev.logins) ? prev.logins : []
      const events = trimRing(
        [...(Array.isArray(prev.events) ? prev.events : []), ...batch],
        MAX_EVENTS,
      )
      const value = {
        version: 1,
        logins,
        events,
        updatedAt: Date.now(),
      }
      const { error: upErr } = await c.from('ops_kv').upsert(
        { key: AUDIT_KEY, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
      if (upErr) throw upErr
    } catch (err) {
      console.warn('[tpvAudit] flush', err)
      // Reencolar al frente (best-effort; puede perderse si hay mucha presión)
      queue = batch.concat(queue).slice(0, MAX_EVENTS)
    } finally {
      flushing = false
      if (queue.length) scheduleFlush()
    }
  }

  function log(ev) {
    const row = sanitize(ev)
    if (!row) return
    queue.push(row)
    if (queue.length > MAX_EVENTS) {
      queue = queue.slice(queue.length - MAX_EVENTS)
    }
    scheduleFlush()
  }

  window.CasaTorinoTpvAudit = {
    log,
    flush,
  }
})()

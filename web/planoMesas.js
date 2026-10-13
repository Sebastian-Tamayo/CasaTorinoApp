/**
 * Casa Torino — Plano interactivo de mesas (overlay)
 *
 * - NO usa rutas API de Vercel (ahorro Hobby).
 * - Lee/escribe Supabase desde el navegador (anon).
 * - Preferencia: tabla public.tables (SQL 011). Fallback: ops_kv.floor_plan.
 * - Carritos siguen en ops_kv.tpv (TPV actual intacto).
 * - Windows = TPV central; Android/iOS = camarera.
 * - Sync: Realtime postgres_changes si hay tabla; si no, Broadcast + poll.
 */
(() => {
  const SB_URL = 'https://fpnjtgoxljqmwuukyrrm.supabase.co'
  const SB_ANON = 'sb_publishable_A_zxEJjB3NN_hh8Qdu7ccQ_qhcWGoz0'
  const FLOOR_KEY = 'floor_plan'
  const TPV_KEY = 'tpv'
  const ROLE_KEY = 'ct-plano-role'
  const WAITER_KEY = 'ct-plano-waiter'
  const POLL_MS = 3000
  const POLL_HIDDEN_MS = 15000
  const CHANNEL = 'casa-torino-plano'
  const TPV_LIVE_CHANNEL = 'casa-torino-tpv-live'

  const DEFAULT_WAITERS = [
    { id: 'w-ana', name: 'Ana' },
    { id: 'w-lucia', name: 'Lucía' },
    { id: 'w-maria', name: 'María' },
    { id: 'w-carmen', name: 'Carmen' },
    { id: 'w-paula', name: 'Paula' },
    { id: 'w-elena', name: 'Elena' },
  ]

  const DEFAULT_TABLES = [
    { id: '1', name: 'Mesa 1', zone: 'Entrada', shape: 'rect', sort_order: 1, layout: { area: 'entrada', row: 3, col: 1 } },
    { id: '2', name: 'Mesa 2', zone: 'Entrada', shape: 'rect', sort_order: 2, layout: { area: 'entrada', row: 2, col: 1 } },
    { id: '3', name: 'Mesa 3', zone: 'Entrada', shape: 'rect', sort_order: 3, layout: { area: 'entrada', row: 1, col: 1 } },
    { id: '4', name: 'Mesa 4', zone: 'Barra', shape: 'circle', sort_order: 4, layout: { area: 'barra', row: 1, col: 1 } },
    { id: '5', name: 'Mesa 5', zone: 'Barra', shape: 'circle', sort_order: 5, layout: { area: 'barra', row: 1, col: 2 } },
    { id: '6', name: 'Mesa 6', zone: 'Salon', shape: 'square', sort_order: 6, layout: { area: 'salon', row: 3, col: 1 } },
    { id: '7', name: 'Mesa 7', zone: 'Salon', shape: 'square', sort_order: 7, layout: { area: 'salon', row: 3, col: 2 } },
    { id: '8', name: 'Mesa 8', zone: 'Salon', shape: 'square', sort_order: 8, layout: { area: 'salon', row: 3, col: 3 } },
    { id: '9', name: 'Mesa 9', zone: 'Salon', shape: 'square', sort_order: 9, layout: { area: 'salon', row: 2, col: 3 } },
    { id: '10', name: 'Mesa 10', zone: 'Salon', shape: 'square', sort_order: 10, layout: { area: 'salon', row: 2, col: 2 } },
    { id: '11', name: 'Mesa 11', zone: 'Salon', shape: 'square', sort_order: 11, layout: { area: 'salon', row: 2, col: 1 } },
    { id: '12', name: 'Mesa 12', zone: 'Salon', shape: 'square', sort_order: 12, layout: { area: 'salon', row: 1, col: 1 } },
    { id: '13', name: 'Mesa 13', zone: 'Salon', shape: 'square', sort_order: 13, layout: { area: 'salon', row: 1, col: 2 } },
    { id: '14', name: 'Mesa 14', zone: 'Salon', shape: 'square', sort_order: 14, layout: { area: 'salon', row: 1, col: 3 } },
    { id: '15', name: 'Mesa 15', zone: 'Lateral', shape: 'rect', sort_order: 15, layout: { area: 'lateral', row: 3, col: 1 } },
    { id: '16', name: 'Mesa 16', zone: 'Lateral', shape: 'rect', sort_order: 16, layout: { area: 'lateral', row: 2, col: 1 } },
    { id: '17', name: 'Mesa 17', zone: 'Lateral', shape: 'rect', sort_order: 17, layout: { area: 'lateral', row: 1, col: 1 } },
  ]

  let sb = null
  let useSqlTable = null // null=unknown, true/false
  let tables = []
  let waiters = DEFAULT_WAITERS.map((w) => ({ ...w }))
  let tpvCarts = {}
  let channel = null
  let pollTimer = null
  let started = false
  let onChange = null

  function money(n) {
    const v = Math.round((Number(n) + Number.EPSILON) * 100) / 100
    if (!Number.isFinite(v)) return '0,00 €'
    return v.toFixed(2).replace('.', ',') + ' €'
  }

  function cartQty(table) {
    const cart = table && table.cart
    if (!cart || typeof cart !== 'object' || Array.isArray(cart)) return 0
    let n = 0
    for (const line of Object.values(cart)) n += Math.max(0, Number(line?.qty) || 0)
    return n
  }

  function cartTotal(table) {
    const cart = table && table.cart
    if (!cart || typeof cart !== 'object' || Array.isArray(cart)) return 0
    let cents = 0
    for (const line of Object.values(cart)) {
      const price = Number(line?.price) || 0
      const qty = Math.max(0, Number(line?.qty) || 0)
      cents += Math.round(price * 100) * qty
    }
    return Math.round(cents) / 100
  }

  function isCentralRole() {
    try {
      const r = String(localStorage.getItem(ROLE_KEY) || '').trim()
      if (r === 'central' || r === 'waiter') return r === 'central'
    } catch {}
    // Windows TPV central suele ser pantalla ancha; móviles = camarera
    const wide = typeof window !== 'undefined' && window.innerWidth >= 900
    const ua = String(navigator.userAgent || '')
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    return wide && !mobile
  }

  function getRole() {
    try {
      const r = String(localStorage.getItem(ROLE_KEY) || '').trim()
      if (r === 'central' || r === 'waiter') return r
    } catch {}
    return isCentralRole() ? 'central' : 'waiter'
  }

  function setRole(role) {
    const r = role === 'central' ? 'central' : 'waiter'
    try {
      localStorage.setItem(ROLE_KEY, r)
    } catch {}
    return r
  }

  function slugWaiterId(name) {
    return (
      'w-' +
      String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 28)
    )
  }

  function listWaiters() {
    return waiters.slice()
  }

  function getWaiter() {
    try {
      const raw = localStorage.getItem(WAITER_KEY)
      if (!raw) return null
      const o = JSON.parse(raw)
      if (o && o.id) {
        const found = waiters.find((w) => w.id === o.id)
        if (found) return found
        if (o.name) return o
      }
    } catch {}
    return null
  }

  function setWaiterById(id) {
    const w = waiters.find((x) => x.id === String(id || ''))
    if (!w) return null
    try {
      localStorage.setItem(WAITER_KEY, JSON.stringify(w))
    } catch {}
    return w
  }

  /** @deprecated prefer setWaiterById — se mantiene por compat */
  function setWaiter(nameOrId) {
    const byId = setWaiterById(nameOrId)
    if (byId) return byId
    const n = String(nameOrId || '').trim().slice(0, 40)
    if (!n) return null
    let w = waiters.find(
      (x) => x.name.toLowerCase() === n.toLowerCase() || x.id === n,
    )
    if (!w) {
      w = { id: slugWaiterId(n) || 'w-' + Date.now(), name: n }
      waiters.push(w)
    }
    return setWaiterById(w.id)
  }

  async function persistWaiters() {
    const c = await client()
    const { data, error } = await c
      .from('ops_kv')
      .select('value')
      .eq('key', FLOOR_KEY)
      .maybeSingle()
    if (error) throw error
    const prev =
      data?.value && typeof data.value === 'object' ? data.value : {}
    const value = {
      ...prev,
      kind: 'casa-torino-plano-mesas',
      source: prev.source || 'ops_kv_overlay',
      tables: Array.isArray(prev.tables)
        ? prev.tables
        : tables.map((t) => ({
            id: t.id,
            name: t.name,
            zone: t.zone,
            shape: t.shape,
            status: t.status,
            total_amount: Number(t.total_amount) || 0,
            current_waiter_id: t.current_waiter_id,
            current_waiter_name: t.current_waiter_name,
            sort_order: t.sort_order,
            layout: t.layout || {},
          })),
      waiters: waiters.map((w) => ({ id: w.id, name: w.name })),
      updatedAt: Date.now(),
    }
    const { error: e2 } = await c.from('ops_kv').upsert(
      { key: FLOOR_KEY, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    if (e2) throw e2
    await broadcast('floor-updated')
    if (typeof onChange === 'function') onChange(getSnapshot())
  }

  async function addWaiter(name) {
    const n = String(name || '').trim().slice(0, 40)
    if (!n) throw new Error('Escribe un nombre')
    if (waiters.some((w) => w.name.toLowerCase() === n.toLowerCase())) {
      throw new Error('Ya existe esa camarera')
    }
    let id = slugWaiterId(n)
    if (!id || waiters.some((w) => w.id === id)) id = id + '-' + Date.now().toString(36).slice(-4)
    const w = { id, name: n }
    waiters.push(w)
    await persistWaiters()
    setWaiterById(w.id)
    return w
  }

  async function updateWaiter(id, name) {
    const n = String(name || '').trim().slice(0, 40)
    if (!n) throw new Error('Escribe un nombre')
    const idx = waiters.findIndex((w) => w.id === String(id || ''))
    if (idx < 0) throw new Error('Camarera no encontrada')
    if (
      waiters.some(
        (w) => w.id !== id && w.name.toLowerCase() === n.toLowerCase(),
      )
    ) {
      throw new Error('Ya existe esa camarera')
    }
    waiters[idx] = { ...waiters[idx], name: n }
    // Actualizar nombre en mesas asignadas
    tables = tables.map((t) =>
      t.current_waiter_id === id
        ? { ...t, current_waiter_name: n }
        : t,
    )
    await persistWaiters()
    const cur = getWaiter()
    if (cur && cur.id === id) setWaiterById(id)
    return waiters[idx]
  }

  async function removeWaiter(id) {
    if (waiters.length <= 1) throw new Error('Debe quedar al menos una camarera')
    const wid = String(id || '')
    waiters = waiters.filter((w) => w.id !== wid)
    const cur = getWaiter()
    if (cur && cur.id === wid) {
      try {
        localStorage.removeItem(WAITER_KEY)
      } catch {}
    }
    await persistWaiters()
    return listWaiters()
  }

  async function ensureLib() {
    if (window.supabase?.createClient) return window.supabase
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js'
      s.async = true
      s.onload = resolve
      s.onerror = () => reject(new Error('No se pudo cargar supabase-js'))
      document.head.appendChild(s)
    })
    return window.supabase
  }

  async function client() {
    if (sb) return sb
    const lib = await ensureLib()
    sb = lib.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 2 } },
    })
    return sb
  }

  function normalizeRow(row) {
    return {
      id: String(row.id || ''),
      name: String(row.name || `Mesa ${row.id}`),
      zone: String(row.zone || ''),
      shape: String(row.shape || 'square'),
      status: row.status === 'ocupada' ? 'ocupada' : 'libre',
      total_amount: Number(row.total_amount) || 0,
      current_waiter_id: row.current_waiter_id || null,
      current_waiter_name: row.current_waiter_name || null,
      sort_order: Number(row.sort_order) || 0,
      layout: row.layout && typeof row.layout === 'object' ? row.layout : {},
    }
  }

  function mergeWithCarts(list) {
    return list.map((t) => {
      const cartBlob = tpvCarts[t.id]
      const qty = cartQty(cartBlob)
      const total = qty > 0 ? cartTotal(cartBlob) : Number(t.total_amount) || 0
      let status = t.status
      if (qty > 0) status = 'ocupada'
      else if (!t.current_waiter_id) status = 'libre'
      // Recuperar camarera desde el carrito TPV si el plano no la tiene
      let current_waiter_id = t.current_waiter_id || null
      let current_waiter_name = t.current_waiter_name || null
      if (qty > 0 && cartBlob && typeof cartBlob === 'object') {
        if (!current_waiter_id && cartBlob.waiterId) {
          current_waiter_id = String(cartBlob.waiterId)
        }
        if (!current_waiter_name && cartBlob.waiterName) {
          current_waiter_name = String(cartBlob.waiterName)
        }
      }
      return {
        ...t,
        status,
        total_amount: total,
        qty,
        current_waiter_id,
        current_waiter_name,
      }
    })
  }

  async function detectSqlTable(c) {
    if (useSqlTable != null) return useSqlTable
    const { error } = await c.from('tables').select('id').limit(1)
    useSqlTable = !error
    return useSqlTable
  }

  async function loadFloorFromSql(c) {
    const { data, error } = await c
      .from('tables')
      .select(
        'id,name,zone,shape,status,total_amount,current_waiter_id,current_waiter_name,sort_order,layout',
      )
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data || []).map(normalizeRow)
  }

  async function loadFloorFromOps(c) {
    const { data, error } = await c
      .from('ops_kv')
      .select('value')
      .eq('key', FLOOR_KEY)
      .maybeSingle()
    if (error) throw error
    const rawWaiters = Array.isArray(data?.value?.waiters)
      ? data.value.waiters
      : null
    if (rawWaiters && rawWaiters.length) {
      waiters = rawWaiters
        .map((w) => ({
          id: String(w.id || slugWaiterId(w.name) || ''),
          name: String(w.name || '').trim().slice(0, 40),
        }))
        .filter((w) => w.id && w.name)
    } else {
      waiters = DEFAULT_WAITERS.map((w) => ({ ...w }))
    }
    const items = Array.isArray(data?.value?.tables) ? data.value.tables : []
    if (!items.length) {
      return DEFAULT_TABLES.map((t) =>
        normalizeRow({
          ...t,
          status: 'libre',
          total_amount: 0,
          current_waiter_id: null,
          current_waiter_name: null,
        }),
      )
    }
    return items.map(normalizeRow)
  }

  async function loadTpvCarts(c) {
    const { data, error } = await c
      .from('ops_kv')
      .select('value')
      .eq('key', TPV_KEY)
      .maybeSingle()
    if (error) throw error
    const tablesObj =
      data?.value?.tables && typeof data.value.tables === 'object'
        ? data.value.tables
        : {}
    tpvCarts = tablesObj
    return tablesObj
  }

  async function refresh() {
    const c = await client()
    await loadTpvCarts(c)
    const sql = await detectSqlTable(c)
    tables = mergeWithCarts(sql ? await loadFloorFromSql(c) : await loadFloorFromOps(c))
    if (typeof onChange === 'function') onChange(getSnapshot())
    return tables
  }

  async function saveFloorOps(list) {
    const c = await client()
    const value = {
      kind: 'casa-torino-plano-mesas',
      source: 'ops_kv_overlay',
      tables: list.map((t) => ({
        id: t.id,
        name: t.name,
        zone: t.zone,
        shape: t.shape,
        status: t.status,
        total_amount: Number(t.total_amount) || 0,
        current_waiter_id: t.current_waiter_id,
        current_waiter_name: t.current_waiter_name,
        sort_order: t.sort_order,
        layout: t.layout || {},
      })),
      waiters: waiters.map((w) => ({ id: w.id, name: w.name })),
      updatedAt: Date.now(),
    }
    const { error } = await c.from('ops_kv').upsert(
      { key: FLOOR_KEY, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    if (error) throw error
  }

  async function patchTable(id, patch) {
    const c = await client()
    const sql = await detectSqlTable(c)
    if (sql) {
      const { error } = await c
        .from('tables')
        .update({
          status: patch.status,
          total_amount: patch.total_amount,
          current_waiter_id: patch.current_waiter_id,
          current_waiter_name: patch.current_waiter_name,
        })
        .eq('id', String(id))
      if (error) throw error
    } else {
      const next = tables.map((t) =>
        t.id === String(id) ? normalizeRow({ ...t, ...patch }) : t,
      )
      await saveFloorOps(next)
    }
    await broadcast('floor-updated')
    return refresh()
  }

  async function broadcast(type) {
    try {
      const c = await client()
      if (!channel) return
      await channel.send({
        type: 'broadcast',
        event: type,
        payload: { at: Date.now() },
      })
    } catch (err) {
      console.warn('[plano] broadcast', err)
    }
  }

  function pollDelay() {
    return typeof document !== 'undefined' && document.hidden
      ? POLL_HIDDEN_MS
      : POLL_MS
  }

  function schedulePoll() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      refresh().catch((err) => console.warn('[plano] poll', err))
    }, pollDelay())
  }

  async function startRealtime() {
    const c = await client()
    if (channel) {
      try {
        await c.removeChannel(channel)
      } catch {}
      channel = null
    }
    const sql = await detectSqlTable(c)
    channel = c.channel(CHANNEL, { config: { broadcast: { self: false } } })
    channel.on('broadcast', { event: 'floor-updated' }, () => {
      refresh().catch(() => {})
    })
    if (sql) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => {
          refresh().catch(() => {})
        },
      )
    }
    // ops_kv realtime often disabled; broadcast + poll cover it
    await new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve(status)
        }
      })
    })

    // Cuando el TPV (móvil/Windows) guarda carrito, refrescar totales al instante
    try {
      const tpvCh = c.channel(TPV_LIVE_CHANNEL, {
        config: { broadcast: { self: false } },
      })
      tpvCh.on('broadcast', { event: 'tpv-updated' }, () => {
        refresh().catch(() => {})
      })
      tpvCh.subscribe()
    } catch (err) {
      console.warn('[plano] tpv-live', err)
    }
  }

  async function claimTable(tableId) {
    const role = getRole()
    const id = String(tableId || '')
    const row = tables.find((t) => t.id === id)
    if (!row) throw new Error('Mesa no encontrada')

    // Obligatorio en móvil Y en Windows: el plano debe mostrar quién gestiona la mesa
    const waiter = getWaiter()
    if (!waiter) {
      throw new Error('Elige qué camarera está accediendo en el desplegable')
    }

    if (
      row.status === 'ocupada' &&
      row.current_waiter_id &&
      row.current_waiter_id !== waiter.id
    ) {
      const ok = confirm(
        `Mesa ${id} la atiende ${row.current_waiter_name || 'otro'}. ¿Abrir igual?`,
      )
      if (!ok) return { action: 'cancel', tableId: id, role }
      // Conservar la camarera ya asignada (control del salón)
      return {
        action: 'open',
        tableId: id,
        role,
        waiter: {
          id: row.current_waiter_id,
          name: row.current_waiter_name || '',
        },
      }
    }

    // Asignar / refrescar nombre en libre o si es la misma camarera
    await patchTable(id, {
      status: 'ocupada',
      total_amount: Number(row.total_amount) || 0,
      current_waiter_id: waiter.id,
      current_waiter_name: waiter.name,
    })
    return { action: 'open', tableId: id, role, waiter }
  }

  async function freeTable(tableId) {
    const id = String(tableId || '')
    if (!id) return
    await patchTable(id, {
      status: 'libre',
      total_amount: 0,
      current_waiter_id: null,
      current_waiter_name: null,
    })
  }

  /**
   * Actualiza totales/camarera desde carritos locales.
   * IMPORTANTE: si qty local es 0 NO liberamos la mesa (el Windows a menudo
   * aún no ha recibido el carrito del móvil y borraba nombre+total del plano).
   * Liberar solo con freeTable() tras cobro/vaciar.
   */
  async function syncTotalsFromLocal(localTables) {
    if (!localTables || typeof localTables !== 'object') return
    // Fusionar con carritos ya conocidos (remoto) para no pisar con un local incompleto
    const mergedCarts = { ...tpvCarts }
    for (const [id, blob] of Object.entries(localTables)) {
      const prev = mergedCarts[id]
      const qNew = cartQty(blob)
      const qOld = cartQty(prev)
      if (qNew > 0 || !prev) mergedCarts[id] = blob
      else if (qOld > 0 && qNew === 0) {
        // Solo aceptar vaciado local si el blob trae updatedAt más nuevo
        const nAt = Math.max(0, Number(blob?.updatedAt) || 0)
        const oAt = Math.max(0, Number(prev?.updatedAt) || 0)
        if (nAt >= oAt) mergedCarts[id] = blob
      }
    }
    tpvCarts = mergedCarts
    let changed = false
    const next = tables.map((t) => {
      const blob = mergedCarts[t.id]
      const qty = cartQty(blob)
      let waiterId = t.current_waiter_id || null
      let waiterName = t.current_waiter_name || null
      if (blob && typeof blob === 'object') {
        if (!waiterId && blob.waiterId) waiterId = String(blob.waiterId)
        if (!waiterName && blob.waiterName) waiterName = String(blob.waiterName)
      }
      if (qty > 0) {
        const total = cartTotal(blob)
        if (
          total !== Number(t.total_amount) ||
          t.status !== 'ocupada' ||
          String(waiterId || '') !== String(t.current_waiter_id || '') ||
          String(waiterName || '') !== String(t.current_waiter_name || '')
        ) {
          changed = true
          return {
            ...t,
            status: 'ocupada',
            total_amount: total,
            qty,
            current_waiter_id: waiterId,
            current_waiter_name: waiterName,
          }
        }
        return {
          ...t,
          status: 'ocupada',
          qty,
          total_amount: total,
          current_waiter_id: waiterId,
          current_waiter_name: waiterName,
        }
      }
      // qty 0: no tocar asignación ni total del plano (evita wipe en Windows)
      return { ...t, qty: 0 }
    })
    tables = next
    if (changed) {
      const c = await client()
      if (await detectSqlTable(c)) {
        for (const t of next) {
          if (t.qty > 0 || t.status === 'ocupada') {
            await c
              .from('tables')
              .update({
                status: t.status,
                total_amount: t.total_amount,
                current_waiter_id: t.current_waiter_id,
                current_waiter_name: t.current_waiter_name,
              })
              .eq('id', t.id)
          }
        }
      } else {
        await saveFloorOps(next)
      }
      await broadcast('floor-updated')
    }
    if (typeof onChange === 'function') onChange(getSnapshot())
  }

  function getSnapshot() {
    return {
      role: getRole(),
      waiter: getWaiter(),
      waiters: listWaiters(),
      useSqlTable: useSqlTable,
      tables: tables.slice(),
    }
  }

  async function start(handler) {
    onChange = handler || null
    await refresh()
    if (!started) {
      started = true
      await startRealtime()
      schedulePoll()
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          schedulePoll()
          if (!document.hidden) refresh().catch(() => {})
        })
      }
    } else {
      schedulePoll()
      await refresh()
    }
    return getSnapshot()
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  window.CasaTorinoPlanoMesas = {
    start,
    stop,
    refresh,
    claimTable,
    freeTable,
    syncTotalsFromLocal,
    getRole,
    setRole,
    getWaiter,
    setWaiter,
    setWaiterById,
    listWaiters,
    addWaiter,
    updateWaiter,
    removeWaiter,
    getSnapshot,
    money,
    DEFAULT_TABLES,
    DEFAULT_WAITERS,
  }
})()

/**
 * Casa Torino — Fichaje / registro de jornada (RD-ley 8/2019)
 *
 * POST /api/time-logs
 *   { action: 'punch', employeeName, eventType: 'entrada'|'salida' }
 *   → INSERT en public.time_logs (Supabase). Si la tabla aún no existe,
 *     usa fallback ops_kv clave `time_logs` (gratis, mismo proyecto).
 *
 * GET /api/time-logs?from=YYYY-MM-DD&to=YYYY-MM-DD&employee=Nombre
 *   → listado + resumen de horas por día / trabajadora
 *
 * Requiere sesión TPV (cookie) o X-Tpv-Key.
 */
const { getJson, setJson, hasSupabase } = require('./_opsStore')
const { applySecurityHeaders } = require('./_securityHeaders')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const OPS_KEY = 'time_logs'
const TZ = 'Europe/Madrid'

const STAFF = [
  'Lorena',
  'Claribel',
  'Yuli',
  'Dayana',
  'Alison',
  'Sharif',
]

function cleanToken(raw) {
  let t = String(raw || '').trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1)
  }
  return t.trim()
}

const SUPABASE_URL = cleanToken(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
).replace(/\/$/, '')
const SUPABASE_KEY = cleanToken(
  process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '',
)

function cors(res) {
  applySecurityHeaders(res)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Tpv-Key, Cache-Control',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
}

function authorized(req) {
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  if (SYNC_KEY && key && key === SYNC_KEY) return true
  return false
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body
}

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function normalizeName(name) {
  const n = String(name || '').trim()
  const hit = STAFF.find((s) => s.toLowerCase() === n.toLowerCase())
  return hit || n
}

function isStaff(name) {
  return STAFF.some((s) => s.toLowerCase() === String(name || '').trim().toLowerCase())
}

function madridParts(iso) {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    label: `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`,
  }
}

function dayBoundsIso(fromYmd, toYmd) {
  // Interpret dates in Madrid: from 00:00 to 23:59:59.999
  const start = new Date(`${fromYmd}T00:00:00+02:00`)
  // DST-safe enough for queries: widen window ±2h and filter client-side by madrid date
  const end = new Date(`${toYmd}T23:59:59.999+01:00`)
  // Better: use UTC range that covers Madrid fully
  const fromUtc = new Date(Date.UTC(
    Number(fromYmd.slice(0, 4)),
    Number(fromYmd.slice(5, 7)) - 1,
    Number(fromYmd.slice(8, 10)) - 1,
    22, 0, 0,
  ))
  const toUtc = new Date(Date.UTC(
    Number(toYmd.slice(0, 4)),
    Number(toYmd.slice(5, 7)) - 1,
    Number(toYmd.slice(8, 10)) + 1,
    22, 0, 0,
  ))
  return { from: fromUtc.toISOString(), to: toUtc.toISOString(), start, end }
}

async function sbFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Falta SUPABASE_URL / SUPABASE_ANON_KEY en Vercel')
  }
  const url = `${SUPABASE_URL}/rest/v1/${path.replace(/^\//, '')}`
  const r = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  })
  const text = await r.text()
  let data = null
  if (text && text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!r.ok) {
    const msg =
      (data && data.message) ||
      (data && data.error) ||
      (typeof data === 'string' ? data : '') ||
      `supabase ${r.status}`
    const err = new Error(msg)
    err.status = r.status
    err.code = data && data.code
    err.body = data
    throw err
  }
  return data
}

function emptyOps() {
  return { kind: 'casa-torino-time-logs', updatedAt: 0, logs: [] }
}

async function insertTable(row) {
  const rows = await sbFetch('time_logs', {
    method: 'POST',
    body: JSON.stringify(row),
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function insertOps(row) {
  const cur = await getJson(OPS_KEY, emptyOps, { fresh: true })
  const base = cur && typeof cur === 'object' ? cur : emptyOps()
  const logs = Array.isArray(base.logs) ? base.logs.slice() : []
  const entry = {
    id: row.id || `ops_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...row,
  }
  logs.push(entry)
  // Conservar ~4 años en memoria JSON (cap por seguridad ~50k filas)
  const pruned = logs.length > 50000 ? logs.slice(logs.length - 50000) : logs
  await setJson(OPS_KEY, {
    kind: 'casa-torino-time-logs',
    updatedAt: Date.now(),
    logs: pruned,
  })
  return entry
}

async function punch({ employeeName, eventType }) {
  const name = normalizeName(employeeName)
  if (!isStaff(name)) {
    const err = new Error('Trabajadora no reconocida')
    err.status = 400
    throw err
  }
  if (eventType !== 'entrada' && eventType !== 'salida') {
    const err = new Error('eventType debe ser entrada o salida')
    err.status = 400
    throw err
  }
  const now = new Date()
  const row = {
    employee_name: name,
    event_type: eventType,
    logged_at: now.toISOString(),
    timezone: TZ,
    source: 'tpv',
  }

  let backend = 'time_logs'
  let saved
  try {
    saved = await insertTable(row)
  } catch (err) {
    const missing =
      err &&
      (err.code === 'PGRST205' ||
        /Could not find the table/i.test(String(err.message || '')) ||
        err.status === 404)
    if (!missing) throw err
    backend = 'ops_kv'
    saved = await insertOps(row)
  }

  const parts = madridParts(saved.logged_at || row.logged_at)
  return {
    ok: true,
    backend,
    log: saved,
    message:
      eventType === 'entrada'
        ? `Entrada registrada · ${name} · ${parts.label}`
        : `Salida registrada · ${name} · ${parts.label}`,
  }
}

async function listFromTable({ from, to, employee }) {
  let path =
    `time_logs?select=id,employee_name,event_type,logged_at,timezone,source,note,created_at` +
    `&logged_at=gte.${encodeURIComponent(from)}` +
    `&logged_at=lte.${encodeURIComponent(to)}` +
    `&order=logged_at.asc`
  if (employee) {
    path += `&employee_name=eq.${encodeURIComponent(employee)}`
  }
  return await sbFetch(path, { method: 'GET' })
}

async function listFromOps({ from, to, employee }) {
  const cur = await getJson(OPS_KEY, emptyOps, { fresh: true })
  const logs = Array.isArray(cur?.logs) ? cur.logs : []
  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()
  return logs
    .filter((l) => {
      const t = new Date(l.logged_at).getTime()
      if (!Number.isFinite(t) || t < fromMs || t > toMs) return false
      if (employee && String(l.employee_name) !== employee) return false
      return true
    })
    .sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
}

function pairSessions(logs) {
  /** @type {Record<string, Array<{ employee: string, date: string, entrada: string|null, salida: string|null, minutes: number|null, open: boolean }>>} */
  const byEmployee = Object.create(null)
  const openStack = Object.create(null) // employee -> entrada log

  for (const log of logs) {
    const name = log.employee_name
    const parts = madridParts(log.logged_at)
    if (!byEmployee[name]) byEmployee[name] = []

    if (log.event_type === 'entrada') {
      openStack[name] = log
      byEmployee[name].push({
        employee: name,
        date: parts.date,
        entrada: log.logged_at,
        salida: null,
        minutes: null,
        open: true,
        entradaLabel: parts.label,
        salidaLabel: null,
      })
    } else if (log.event_type === 'salida') {
      const sessions = byEmployee[name] || []
      let open = null
      for (let i = sessions.length - 1; i >= 0; i--) {
        if (sessions[i].open) {
          open = sessions[i]
          break
        }
      }
      if (open) {
        open.salida = log.logged_at
        open.salidaLabel = parts.label
        open.open = false
        const ms = new Date(log.logged_at) - new Date(open.entrada)
        open.minutes = Math.max(0, Math.round(ms / 60000))
        delete openStack[name]
      } else {
        // salida sin entrada: registrar tramo incompleto
        sessions.push({
          employee: name,
          date: parts.date,
          entrada: null,
          salida: log.logged_at,
          minutes: null,
          open: false,
          entradaLabel: null,
          salidaLabel: parts.label,
          orphan: 'salida',
        })
      }
    }
  }

  const all = []
  for (const name of Object.keys(byEmployee)) {
    all.push(...byEmployee[name])
  }
  return all
}

function summarize(sessions) {
  const byEmployee = Object.create(null)
  const byDay = Object.create(null)

  for (const s of sessions) {
    const name = s.employee
    if (!byEmployee[name]) {
      byEmployee[name] = { employee: name, minutes: 0, sessions: 0, open: 0 }
    }
    byEmployee[name].sessions += 1
    if (s.open) byEmployee[name].open += 1
    if (typeof s.minutes === 'number') byEmployee[name].minutes += s.minutes

    const day = s.date
    const key = `${name}|${day}`
    if (!byDay[key]) {
      byDay[key] = { employee: name, date: day, minutes: 0, sessions: 0, open: 0 }
    }
    byDay[key].sessions += 1
    if (s.open) byDay[key].open += 1
    if (typeof s.minutes === 'number') byDay[key].minutes += s.minutes
  }

  return {
    byEmployee: Object.values(byEmployee).sort((a, b) => a.employee.localeCompare(b.employee, 'es')),
    byDay: Object.values(byDay).sort((a, b) =>
      a.date === b.date
        ? a.employee.localeCompare(b.employee, 'es')
        : a.date < b.date
          ? 1
          : -1,
    ),
  }
}

function formatMinutes(m) {
  if (m == null || !Number.isFinite(m)) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}h ${String(min).padStart(2, '0')}m`
}

function todayMadridYmd() {
  return madridParts(new Date().toISOString()).date
}

function monthStartYmd(ymd) {
  return `${ymd.slice(0, 7)}-01`
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  try {
    if (!authorized(req)) {
      return json(res, 401, { ok: false, error: 'No autorizado. Entra al TPV con PIN.' })
    }

    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'http://localhost')
      const today = todayMadridYmd()
      const from = url.searchParams.get('from') || monthStartYmd(today)
      const to = url.searchParams.get('to') || today
      const employeeRaw = url.searchParams.get('employee') || ''
      const employee = employeeRaw ? normalizeName(employeeRaw) : ''

      const bounds = dayBoundsIso(from, to)
      let backend = 'time_logs'
      let logs
      try {
        logs = await listFromTable({
          from: bounds.from,
          to: bounds.to,
          employee: employee || null,
        })
      } catch (err) {
        const missing =
          err &&
          (err.code === 'PGRST205' ||
            /Could not find the table/i.test(String(err.message || '')))
        if (!missing) throw err
        backend = 'ops_kv'
        logs = await listFromOps({
          from: bounds.from,
          to: bounds.to,
          employee: employee || null,
        })
      }

      // Filtrar por fecha Madrid real
      const filtered = (logs || []).filter((l) => {
        const d = madridParts(l.logged_at).date
        return d >= from && d <= to
      })

      const sessions = pairSessions(filtered)
      const summary = summarize(sessions)

      return json(res, 200, {
        ok: true,
        backend,
        supabase: hasSupabase(),
        staff: STAFF,
        from,
        to,
        timezone: TZ,
        logs: filtered,
        sessions,
        summary,
        formatMinutes,
        needsTableSetup: backend === 'ops_kv',
        setupSqlHint:
          backend === 'ops_kv'
            ? 'Ejecuta web/supabase/007_time_logs.sql en Supabase SQL Editor para usar la tabla time_logs.'
            : null,
      })
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      const action = body.action || 'punch'
      if (action === 'staff') {
        return json(res, 200, { ok: true, staff: STAFF })
      }
      if (action !== 'punch') {
        return json(res, 400, { ok: false, error: 'action no soportada' })
      }
      const result = await punch({
        employeeName: body.employeeName || body.employee || body.name,
        eventType: body.eventType || body.type,
      })
      return json(res, 200, result)
    }

    return json(res, 405, { ok: false, error: 'Método no permitido' })
  } catch (err) {
    console.error('[time-logs]', err)
    return json(res, err.status && err.status < 600 ? err.status : 500, {
      ok: false,
      error: err.message || 'Error fichaje',
    })
  }
}

module.exports.STAFF = STAFF
module.exports.formatMinutes = formatMinutes

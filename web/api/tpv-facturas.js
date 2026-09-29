/**
 * Casa Torino TPV — Facturas simplificadas + datos fiscales del emisor
 * Persistencia: ops_kv (Supabase) claves `fiscal` y `facturas`
 *
 * GET  /api/tpv-facturas → { fiscal, series, year, seq, nextNumber, recent }
 * POST /api/tpv-facturas
 *   { action: 'getFiscal' }
 *   { action: 'setFiscal', fiscal: { nif, legalName, address, city, phone } }
 *   { action: 'issue', invoice: { ...cliente, lines, totals, mesa, payments } }
 *     → reserva número correlativo y guarda copia; responde { invoice, number }
 */
const { getJson, setJson, updateJson } = require('./_opsStore')

const SYNC_KEY = process.env.TPV_SYNC_KEY || ''
const FISCAL_KEY = 'fiscal'
const FACTURAS_KEY = 'facturas'
const INVOICES_MAX = 800

function cors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Tpv-Key, Cache-Control',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function hasTpvSession(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some((c) => c.trim() === 'ct_tpv_session=1')
}

function authorized(req) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return true
  if (hasTpvSession(req)) return true
  const key = req.headers['x-tpv-key']
  return Boolean(SYNC_KEY && key && key === SYNC_KEY)
}

function emptyFiscal() {
  return {
    kind: 'casa-torino-fiscal',
    nif: '',
    legalName: 'CASA TORINO',
    address: 'Ctra. Ceares, 67',
    city: 'Gijón',
    phone: '612 254 719',
    updatedAt: 0,
  }
}

function emptyFacturas() {
  return {
    kind: 'casa-torino-facturas',
    series: 'FS',
    year: madridYear(Date.now()),
    seq: 0,
    items: [],
    updatedAt: 0,
  }
}

function madridYear(ts) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
  })
  return Number(fmt.format(new Date(ts))) || new Date(ts).getFullYear()
}

function sanitizeFiscal(raw) {
  const base = emptyFiscal()
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    ...base,
    nif: String(src.nif || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ''),
    legalName: String(src.legalName || base.legalName).trim() || base.legalName,
    address: String(src.address || base.address).trim() || base.address,
    city: String(src.city || base.city).trim() || base.city,
    phone: String(src.phone || base.phone).trim() || base.phone,
    updatedAt: Number(src.updatedAt) || Date.now(),
  }
}

function formatNumber(series, year, seq) {
  const n = String(Math.max(1, Number(seq) || 1)).padStart(4, '0')
  return `${series}-${year}-${n}`
}

function normalizeClient(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  return {
    name: String(c.name || '').trim(),
    nif: String(c.nif || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ''),
    address: String(c.address || '').trim(),
  }
}

function normalizeLines(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((l) => {
      if (!l || typeof l !== 'object') return null
      const qty = Math.round(Number(l.qty) * 1000) / 1000
      const price = Math.round(Number(l.price) * 100) / 100
      const name = String(l.name || '').trim()
      if (!name || !(qty > 0) || !Number.isFinite(price)) return null
      return { name, qty, price }
    })
    .filter(Boolean)
}

function normalizeInvoicePayload(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const total = Math.round(Number(src.total) * 100) / 100
  const base = Math.round(Number(src.base) * 100) / 100
  const iva = Math.round(Number(src.iva) * 100) / 100
  const ivaRate = Number.isFinite(Number(src.ivaRate))
    ? Number(src.ivaRate)
    : 0.1
  const client = normalizeClient(src.client)
  const lines = normalizeLines(src.lines)
  if (!client.name || !client.nif) {
    const err = new Error('Faltan nombre y NIF/CIF del cliente')
    err.status = 400
    throw err
  }
  if (!lines.length || !Number.isFinite(total) || total <= 0) {
    const err = new Error('La factura no tiene líneas o total válido')
    err.status = 400
    throw err
  }
  const payments = Array.isArray(src.payments)
    ? src.payments
        .map((p) => {
          if (!p || typeof p !== 'object') return null
          const method =
            String(p.method || '').toLowerCase() === 'tarjeta'
              ? 'tarjeta'
              : 'efectivo'
          const amount = Math.round(Number(p.amount) * 100) / 100
          if (!Number.isFinite(amount) || amount <= 0) return null
          return { method, amount }
        })
        .filter(Boolean)
    : []
  return {
    client,
    lines,
    total,
    base: Number.isFinite(base) ? base : Math.round((total / (1 + ivaRate)) * 100) / 100,
    iva: Number.isFinite(iva)
      ? iva
      : Math.round((total - (Number.isFinite(base) ? base : total / (1 + ivaRate))) * 100) /
        100,
    ivaRate,
    mesa: String(src.mesa || '').trim(),
    payments,
    paymentMethod: String(src.paymentMethod || '').trim(),
    saleId: String(src.saleId || '').trim(),
    notes: String(src.notes || '').trim(),
  }
}

async function readFiscal() {
  const raw = await getJson(FISCAL_KEY, emptyFiscal, { fresh: true })
  return sanitizeFiscal(raw)
}

async function readFacturas() {
  const raw = await getJson(FACTURAS_KEY, emptyFacturas, { fresh: true })
  const yearNow = madridYear(Date.now())
  const series = String(raw.series || 'FS').trim() || 'FS'
  let year = Number(raw.year) || yearNow
  let seq = Math.max(0, Number(raw.seq) || 0)
  // Nueva serie anual
  if (year !== yearNow) {
    year = yearNow
    seq = 0
  }
  return {
    kind: 'casa-torino-facturas',
    series,
    year,
    seq,
    items: Array.isArray(raw.items) ? raw.items : [],
    updatedAt: Number(raw.updatedAt) || 0,
  }
}

function publicState(fiscal, facturas) {
  const nextSeq = (Number(facturas.seq) || 0) + 1
  return {
    ok: true,
    fiscal: {
      nif: fiscal.nif || '',
      legalName: fiscal.legalName,
      address: fiscal.address,
      city: fiscal.city,
      phone: fiscal.phone,
      configured: Boolean(fiscal.nif),
    },
    series: facturas.series,
    year: facturas.year,
    seq: facturas.seq,
    nextNumber: formatNumber(facturas.series, facturas.year, nextSeq),
    recent: (facturas.items || []).slice(-20).reverse(),
  }
}

module.exports = async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'No autorizado' }))
    return
  }

  try {
    if (req.method === 'GET') {
      const [fiscal, facturas] = await Promise.all([readFiscal(), readFacturas()])
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(publicState(fiscal, facturas)))
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {}
    const action = String(body.action || '').trim()

    if (action === 'getFiscal' || action === 'status') {
      const [fiscal, facturas] = await Promise.all([readFiscal(), readFacturas()])
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(publicState(fiscal, facturas)))
      return
    }

    if (action === 'setFiscal') {
      const fiscal = sanitizeFiscal({
        ...(body.fiscal || body),
        updatedAt: Date.now(),
      })
      if (!fiscal.nif || fiscal.nif.length < 8) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Indica el NIF/CIF del local (emisor)' }))
        return
      }
      await setJson(FISCAL_KEY, fiscal)
      const facturas = await readFacturas()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(publicState(fiscal, facturas)))
      return
    }

    if (action === 'issue') {
      const fiscal = await readFiscal()
      if (!fiscal.nif) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: 'Configura primero el NIF/CIF del local (emisor)',
            needFiscal: true,
          }),
        )
        return
      }

      let payload
      try {
        payload = normalizeInvoicePayload(body.invoice || body)
      } catch (err) {
        res.statusCode = err.status || 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: err.message || 'Datos inválidos' }))
        return
      }

      let issued = null
      await updateJson(FACTURAS_KEY, emptyFacturas, (store) => {
        const yearNow = madridYear(Date.now())
        const series = String(store.series || 'FS').trim() || 'FS'
        let year = Number(store.year) || yearNow
        let seq = Math.max(0, Number(store.seq) || 0)
        if (year !== yearNow) {
          year = yearNow
          seq = 0
        }
        seq += 1
        const number = formatNumber(series, year, seq)
        const invoice = {
          id: `inv-${year}-${seq}`,
          number,
          series,
          year,
          seq,
          at: Date.now(),
          kind: 'factura-simplificada',
          emitter: {
            nif: fiscal.nif,
            legalName: fiscal.legalName,
            address: fiscal.address,
            city: fiscal.city,
            phone: fiscal.phone,
          },
          ...payload,
        }
        let items = Array.isArray(store.items) ? store.items.slice() : []
        items.push(invoice)
        while (items.length > INVOICES_MAX) items.shift()
        issued = invoice
        return {
          kind: 'casa-torino-facturas',
          series,
          year,
          seq,
          items,
          updatedAt: Date.now(),
        }
      })

      const facturas = await readFacturas()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          ...publicState(fiscal, facturas),
          invoice: issued,
          number: issued?.number,
        }),
      )
      return
    }

    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Acción no válida' }))
  } catch (err) {
    console.error('[tpv-facturas]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || 'Error facturas' }))
  }
}

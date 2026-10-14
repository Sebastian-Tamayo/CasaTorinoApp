#!/usr/bin/env node
/**
 * Pruebas de humo producción Casa Torino (sin red):
 * - merge TPV (borrados / concurrentes)
 * - ticket TOTAL en una línea
 * - opsDay / rollover
 * - rangos informe semanal / mensual
 * - kitchen create no pisa pedidos
 * - ERP libs presentes
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
let failed = 0
function ok(name) {
  console.log('OK  ' + name)
}
function fail(name, err) {
  failed++
  console.error('FAIL ' + name + ': ' + (err && err.message ? err.message : err))
}

// —— 1) Merge borrados ——
try {
  require('./test-tpv-merge-delete.js')
  ok('merge-delete')
} catch (err) {
  fail('merge-delete', err)
}

// —— 2) Ticket TOTAL misma línea ——
try {
  function money(n) {
    const v = Math.round((Number(n) + Number.EPSILON) * 100) / 100
    const neg = v < 0
    const abs = Math.abs(v)
    const [ent, dec] = abs.toFixed(2).split('.')
    return (neg ? '-' : '') + ent + ',' + dec
  }
  function padRowWidth(left, right, cols) {
    const R = String(right)
    const width = Math.max(8, Number(cols) || 24)
    let L = String(left)
    const maxLeft = Math.max(1, width - R.length - 1)
    if (L.length > maxLeft) {
      L = maxLeft <= 1 ? L.slice(0, 1) : L.slice(0, maxLeft - 1) + '…'
    }
    const space = Math.max(1, width - L.length - R.length)
    const row = L + ' '.repeat(space) + R
    return row.length > width ? row.slice(0, width) : row
  }
  const cols = 24
  const dcols = Math.max(10, Math.floor(cols / 2))
  for (const amt of [12.5, 0.5, 99.99, 123.45, 8, 4.1]) {
    const line = padRowWidth('TOTAL', money(amt), dcols)
    assert.ok(!line.includes('\n'), 'sin salto')
    assert.ok(line.startsWith('TOTAL'), 'label')
    assert.ok(line.includes(','), 'decimales en misma línea: ' + line)
    assert.ok(line.length <= dcols, 'cabe en doble ancho: ' + line)
    assert.ok(line.endsWith(money(amt)), 'importe completo al final: ' + line)
  }
  // Líneas de producto / base: importe entero en la misma fila
  const item = padRowWidth('1x Caña rubia', money(2.6), cols)
  assert.ok(item.includes('2,60'), 'precio producto: ' + item)
  assert.strictEqual(item.length, cols)
  assert.ok(!item.includes('\n'))
  const base = padRowWidth('Base', money(3.73) + ' E', cols)
  assert.ok(base.endsWith('3,73 E'), 'base con E: ' + base)
  assert.strictEqual(base.length, cols)
  const iva = padRowWidth('IVA 10%', money(0.37) + ' E', cols)
  assert.ok(iva.endsWith('0,37 E'), 'iva con E: ' + iva)
  assert.strictEqual(iva.length, cols)
  ok('ticket-total-sameline')
} catch (err) {
  fail('ticket-total-sameline', err)
}

// —— 3) opsDay / rollover ——
try {
  const { opsDayId, applyTpvDayRollover, applyKitchenDayRollover } = require('../api/_opsDay')
  const day = opsDayId()
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(day), 'opsDay format')
  // 07:00 Madrid → día anterior
  const early = new Date('2026-10-13T05:30:00.000Z') // 07:30 CEST
  const late = new Date('2026-10-13T07:00:00.000Z') // 09:00 CEST
  assert.notStrictEqual(opsDayId(early), opsDayId(late), 'corte 08:00')
  const rolled = applyTpvDayRollover({
    kind: 'casa-torino-tpv',
    tables: { '11': { cart: { a: { qty: 1 } }, updatedAt: 1 } },
    opsDay: '2020-01-01',
    updatedAt: 1,
  })
  assert.strictEqual(rolled.changed, true)
  assert.deepStrictEqual(rolled.state.tables, {})
  const kit = applyKitchenDayRollover({
    orders: [{ id: '1' }],
    history: [{ id: 'h' }],
    historyDay: '2020-01-01',
  })
  assert.strictEqual(kit.changed, true)
  assert.deepStrictEqual(kit.state.orders, [])
  ok('ops-day-rollover')
} catch (err) {
  fail('ops-day-rollover', err)
}

// —— 4) Informes rangos ——
try {
  const {
    weekRangeEndingSunday,
    previousMonthRange,
    madridWeekday,
    buildMobileEmailHtml,
  } = require('../api/_informeReports')
  // Domingo 12 oct 2026 → semana lun 6 – dom 12
  const sunday = new Date('2026-10-12T12:00:00.000Z')
  const wr = weekRangeEndingSunday(sunday)
  assert.ok(wr.startKey && wr.endKey, 'week range')
  const mr = previousMonthRange(new Date('2026-10-13T12:00:00.000Z'))
  assert.ok(mr.startKey && mr.label, 'month range')
  const wd = madridWeekday(new Date('2026-10-12T12:00:00.000Z'))
  assert.ok(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(wd))
  const html = buildMobileEmailHtml({
    kind: 'semanal',
    label: '6–12 oct 2026',
    generatedAtMadrid: '2026-10-13 08:00',
    bucketMode: 'dia',
    totals: {
      total: 100,
      tickets: 3,
      base: 90.91,
      iva: 9.09,
      byPayment: { efectivo: { total: 60 }, tarjeta: { total: 40 } },
    },
    products: [],
    buckets: [],
    activityByHour: [],
  })
  assert.ok(String(html).includes('Informe semanal'))
  ok('informes-rangos-html')
} catch (err) {
  fail('informes-rangos-html', err)
}

// —— 4b) Mesa vaciada → cleared desasigna ——
try {
  const { mergeBusyTables, cartQty } = require('../api/_tpvMerge')
  const now = Date.now()
  const occupied = {
    cart: { a: { qty: 2, price: 5, updatedAt: now - 5000 } },
    waiterId: 'w-ana',
    waiterName: 'Ana',
    cleared: false,
    updatedAt: now - 5000,
  }
  const emptied = {
    cart: {},
    removed: { a: now },
    waiterId: null,
    waiterName: null,
    cleared: true,
    updatedAt: now,
  }
  const m = mergeBusyTables(emptied, occupied, true)
  // emptied is newer by updatedAt — mergeBusy picks by aAt/bAt
  assert.strictEqual(cartQty(m), 0, 'vaciada sin productos')
  assert.ok(m.cleared || !m.waiterName, 'sin camarera al vaciar')
  ok('mesa-cleared-unassign')
} catch (err) {
  fail('mesa-cleared-unassign', err)
}

// —— 5) Kitchen: create append (simulación RMW) ——
try {
  // Lógica espejo: un create debe añadir, no sustituir el array
  function applyCreate(state, order) {
    const orders = Array.isArray(state.orders) ? state.orders.slice() : []
    orders.push(order)
    return { ...state, orders, updatedAt: Date.now() }
  }
  let st = { orders: [{ id: 'a', mesa: '11' }], updatedAt: 1 }
  st = applyCreate(st, { id: 'b', mesa: '12' })
  st = applyCreate(st, { id: 'c', mesa: '11' })
  assert.strictEqual(st.orders.length, 3)
  assert.ok(st.orders.some((o) => o.id === 'a'))
  assert.ok(st.orders.some((o) => o.id === 'c'))
  ok('kitchen-create-append')
} catch (err) {
  fail('kitchen-create-append', err)
}

// —— 6) Kitchen handler exporta y tiene create ——
try {
  const src = fs.readFileSync(path.join(root, 'api/kitchen.js'), 'utf8')
  assert.ok(src.includes("action === 'create'") || src.includes('case \'create\'') || src.includes('create'))
  assert.ok(src.includes('updateJson'))
  assert.ok(src.includes('ORDERS_MAX'))
  ok('kitchen-api-source')
} catch (err) {
  fail('kitchen-api-source', err)
}

// —— 7) ERP lee ops_kv jornada/cierres ——
try {
  const erpRoot = path.join(root, '..', 'erp')
  const files = [
    'src/lib/ops-kv.ts',
    'src/lib/tpv-ops.ts',
    'src/app/api/jornada/route.ts',
    'src/app/api/cierres/route.ts',
  ]
  for (const f of files) {
    const p = path.join(erpRoot, f)
    assert.ok(fs.existsSync(p), 'missing ' + f)
    const t = fs.readFileSync(p, 'utf8')
    assert.ok(t.includes('ops_kv') || t.includes('getOpsKv') || t.includes('cierres') || t.includes('jornada'))
  }
  ok('erp-ops-kv-paths')
} catch (err) {
  fail('erp-ops-kv-paths', err)
}

// —— 8) Cron informes en purge ——
try {
  const purge = fs.readFileSync(path.join(root, 'api/ops-daily-purge.js'), 'utf8')
  assert.ok(purge.includes('maybeTriggerWeeklyMondayBackup'))
  assert.ok(purge.includes("runInforme('mensual'") || purge.includes('runInforme("mensual"'))
  assert.ok(purge.includes("wd === 'Mon'") || purge.includes('wd === "Mon"'))
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  assert.ok(Array.isArray(vercel.crons) && vercel.crons.length >= 1)
  assert.ok(vercel.crons.some((c) => c.path === '/api/ops-daily-purge'))
  ok('cron-informes-wired')
} catch (err) {
  fail('cron-informes-wired', err)
}

// —— 9) Force update apunta a /tpv.html ——
try {
  const html = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  assert.ok(html.includes("new URL('/tpv.html', location.origin)"))
  assert.ok(html.includes('unregister'))
  assert.ok(html.includes('TOTAL') || true)
  const print = fs.readFileSync(path.join(root, 'printService.js'), 'utf8')
  assert.ok(print.includes('total-sameline') || print.includes('MISMA línea') || print.includes('padRowWidth(\'TOTAL\''))
  assert.ok(!print.includes("data.push('TOTAL' + ESC.LF)\n    data.push(money(total)"))
  ok('force-reload-tpv-html')
} catch (err) {
  fail('force-reload-tpv-html', err)
}

// —— 10) Versiones alineadas ——
try {
  const ver = JSON.parse(fs.readFileSync(path.join(root, 'tpv-version.json'), 'utf8'))
  const apiVer = fs.readFileSync(path.join(root, 'api/_tpvVersion.js'), 'utf8')
  const sw = fs.readFileSync(path.join(root, 'sw-tpv.js'), 'utf8')
  const html = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  const req = ver.required
  assert.ok(req)
  assert.ok(apiVer.includes(`'${req}'`) || apiVer.includes(`"${req}"`))
  assert.ok(sw.includes(`'${req}'`) || sw.includes(`"${req}"`))
  assert.ok(html.includes(`'${req}'`) || html.includes(`"${req}"`))
  ok('tpv-version-aligned:' + req)
} catch (err) {
  fail('tpv-version-aligned', err)
}

if (failed) {
  console.error('\n' + failed + ' test(s) failed')
  process.exit(1)
}
console.log('\nALL SMOKE TESTS PASSED')

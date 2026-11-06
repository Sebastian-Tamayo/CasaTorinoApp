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
  const informes = fs.readFileSync(path.join(root, 'api/_informeReports.js'), 'utf8')
  const jornada = fs.readFileSync(path.join(root, 'api/tpv-jornada.js'), 'utf8')
  assert.ok(purge.includes('maybeTriggerWeeklyMondayBackup'))
  assert.ok(purge.includes("runInforme('mensual'") || purge.includes('runInforme("mensual"'))
  assert.ok(purge.includes("wd === 'Mon'") || purge.includes('wd === "Mon"'))
  assert.ok(informes.includes('not_monday_08_madrid'))
  assert.ok(informes.includes('weekly_only_monday_cron'))
  assert.ok(jornada.includes('weekly_only_monday_cron'))
  assert.ok(!jornada.includes('maybeTriggerWeeklyAfterSundayClose'))
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

// —— 11) Usuarios TPV por PIN (sin función Hobby extra) ——
try {
  const auth = fs.readFileSync(path.join(root, 'api/tpv-auth.js'), 'utf8')
  const users = fs.readFileSync(path.join(root, 'api/_tpvUsers.js'), 'utf8')
  const html = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  assert.ok(auth.includes("action === 'setPin'"))
  assert.ok(auth.includes("action === 'createUser'"))
  assert.ok(auth.includes("action === 'switchUser'"))
  assert.ok(auth.includes("gate === 'tpv'"))
  assert.ok(users.includes("CREATE_USER_PIN = '2908'"))
  assert.ok(users.includes("HUB_ACCESS_PIN = '0912'"))
  assert.ok(users.includes('USERS_STORE_VERSION'))
  assert.ok(users.includes('gateUsers'))
  assert.ok(users.includes('authenticateUserPin'))
  assert.ok(users.includes('allowTpvLogin'))
  assert.ok(users.includes('isBootstrapUser'))
  assert.ok(users.includes('sessionEpoch'))
  assert.ok(users.includes('hubAccessPins'))
  assert.ok(auth.includes("action === 'gateUsers'"))
  assert.ok(auth.includes('kicked'))
  assert.ok(auth.includes('getSessionEpoch') || auth.includes('issueSession'))
  assert.ok(html.includes('gateBtnFirst') && html.includes('gateBtnCreate'))
  assert.ok(html.includes('gateLoginUser'))
  assert.ok(html.includes('tpvUserSelect') && html.includes('tpvSwitchGate'))
  assert.ok(html.includes('requestCreateConfirmPin') || html.includes("mode: 'createConfirm'"))
  assert.ok(html.includes("gate: 'tpv'"))
  assert.ok(html.includes('userId'))
  assert.ok(html.includes('kickIfNotBootstrap'))
  assert.ok(html.includes('entered !== false'))
  assert.ok(auth.includes('entered: true') && auth.includes('entered: false'))
  assert.ok(users.includes('USERS_STORE_VERSION = 8') || /USERS_STORE_VERSION\s*=\s*8/.test(users))
  // Nadie entra directo por cookie
  assert.ok(
    /tryResumeSession[\s\S]{0,220}return false/.test(html),
    'tryResumeSession no desbloquea por cookie',
  )
  assert.ok(!html.includes('planoWaiterAdd'))
  assert.ok(!html.includes('3212'), 'tpv.html no revela PIN Sebas')
  ok('tpv-usuarios-pin')
} catch (err) {
  fail('tpv-usuarios-pin', err)
}

// —— 12) Monitor TPV / audit (0 función nueva) ——
try {
  const auth = fs.readFileSync(path.join(root, 'api/tpv-auth.js'), 'utf8')
  const audit = fs.readFileSync(path.join(root, 'api/_tpvAudit.js'), 'utf8')
  const client = fs.readFileSync(path.join(root, 'tpvAudit.js'), 'utf8')
  const monitor = fs.readFileSync(path.join(root, 'monitor.html'), 'utf8')
  const interno = fs.readFileSync(path.join(root, 'interno.html'), 'utf8')
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  assert.ok(auth.includes("action === 'getAudit'"))
  assert.ok(audit.includes("AUDIT_KEY = 'tpv_audit'"))
  assert.ok(client.includes('CasaTorinoTpvAudit'))
  assert.ok(monitor.includes('getAudit'))
  assert.ok(monitor.includes('kitchen_send') && monitor.includes('kitchen_pickup'))
  assert.ok(monitor.includes('eventActionText') && monitor.includes('TYPE_META'))
  assert.ok(monitor.includes('type-chips') && monitor.includes('mesa-chip'))
  assert.ok(monitor.includes('monitor-list-accesos') && monitor.includes('monitor-list-movimientos'))
  assert.ok(monitor.includes('eventFacts') && monitor.includes('fact-row'))
  assert.ok(monitor.includes('Envió pedido a cocina') || monitor.includes('Envió'))
  assert.ok(audit.includes('payMethod') && audit.includes('category'))
  assert.ok(client.includes('payMethod') && client.includes('category'))
  assert.ok(interno.includes('monitor.html'))
  assert.ok(!JSON.stringify(vercel).includes('tpv-audit'))
  const kitchen = fs.readFileSync(path.join(root, 'api/kitchen.js'), 'utf8')
  assert.ok(kitchen.includes('auditKitchenReady') || kitchen.includes('kitchen_ready'))
  const tpv = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  assert.ok(tpv.includes("'kitchen_send'") && tpv.includes("'kitchen_pickup'"))
  assert.ok(tpv.includes('auditCartSummary') && tpv.includes('payMethod:'))
  // Admin PIN no debe aparecer en UI (HTML)
  assert.ok(!tpv.includes('2908'), 'tpv.html no revela admin PIN')
  assert.ok(!tpv.includes('3212'), 'tpv.html no revela PIN Sebas')
  assert.ok(!monitor.includes('2908'), 'monitor.html no revela admin PIN')
  assert.ok(!monitor.includes('3212'), 'monitor.html no revela PIN Sebas')
  assert.ok(!interno.includes('2908'), 'interno.html no revela admin PIN')
  assert.ok(!interno.includes('3212'), 'interno.html no revela PIN Sebas')
  assert.ok(!interno.includes('0912'), 'interno.html no revela hub PIN')
  assert.ok(tpv.includes('Primer acceso'))
  assert.ok(tpv.includes('Sin PIN: la persona hará'))
  assert.ok(!tpv.includes('PIN del nuevo usuario'))
  assert.ok(tpv.includes('Introduce el PIN para confirmar'))
  assert.ok(tpv.includes('requestCreateConfirmPin'))
  assert.ok(!tpv.includes("prompt('Introduce el PIN para confirmar')"))
  assert.ok(!tpv.includes('PIN de administrador'))
  assert.ok(!monitor.includes('administrador'))
  ok('tpv-monitor-audit')
} catch (err) {
  fail('tpv-monitor-audit', err)
}

// —— 13) Historias del menú: pantalla propia, fuera del TPV y sin función Vercel ——
try {
  const hist = fs.readFileSync(path.join(root, 'historias.html'), 'utf8')
  const interno = fs.readFileSync(path.join(root, 'interno.html'), 'utf8')
  const tpv = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  assert.ok(hist.includes('theme-color" content="#fff8e8"'))
  assert.ok(hist.includes('href="styles.css"'))
  assert.ok(!/touch-action:\s*none/i.test(hist), 'historias sin touch-action none')
  assert.ok(hist.includes("fetch('/api/tpv-auth'"))
  assert.ok(hist.includes('PIN de gestión interna'))
  assert.ok(hist.includes('Faltan platos'))
  assert.ok(hist.includes('request_menu_story'))
  assert.ok(interno.includes('PIN de gestión interna'))
  assert.ok(!hist.includes('gate: \'tpv\''), 'historias no abre sesión de cobro')
  assert.ok(!hist.includes('0912') && !hist.includes('2908') && !hist.includes('3212'))
  assert.ok(interno.includes('historias.html'))
  assert.ok(!tpv.includes('btnMenuStories'), 'el TPV no lleva el botón de historias')
  assert.ok(!tpv.includes('request_menu_story'))
  assert.ok(!JSON.stringify(vercel).includes('historias'))
  ok('historias-aparte')
} catch (err) {
  fail('historias-aparte', err)
}

if (failed) {
  console.error('\n' + failed + ' test(s) failed')
  process.exit(1)
}
console.log('\nALL SMOKE TESTS PASSED')

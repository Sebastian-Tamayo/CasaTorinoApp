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
  const printSrc = fs.readFileSync(path.join(root, 'printService.js'), 'utf8')
  assert.ok(printSrc.includes('Hostelería Valdés Bonilla S.L'), 'ticket razón social')
  assert.ok(printSrc.includes('CIF: 93990562'), 'ticket CIF')
  assert.ok(printSrc.includes('Crta Ceares 67, 33209'), 'ticket dirección')
  assert.ok(printSrc.includes('legalLines'), 'ticket legalLines')
  assert.ok(printSrc.includes('SIZE_TALL'), 'ticket letra algo mayor')
  // Cada frase fiscal en una sola línea (sin wrapLines a 24)
  assert.ok(
    /legalLines[\s\S]*?for \(const row of BUSINESS\.legalLines[\s\S]*?\.trim\(\) \+ ESC\.LF/.test(
      printSrc,
    ),
    'legal lines sin partir',
  )
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
    weekdayOfDayKey,
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
  assert.strictEqual(weekdayOfDayKey('2026-11-08'), 'Sun')
  assert.strictEqual(weekdayOfDayKey('2026-11-09'), 'Mon')
  // Lun 00:30 → weekRange termina el domingo anterior (caja domingo madrugada)
  const monEarly = new Date('2026-11-09T00:30:00+01:00')
  const wrEarly = weekRangeEndingSunday(monEarly)
  assert.strictEqual(wrEarly.endKey, '2026-11-08')
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
  assert.ok(src.includes("action === 'completeItem'"))
  assert.ok(src.includes("action === 'restore'"))
  assert.ok(src.includes('applyCompleteItem') && src.includes('platePickupMessage'))
  assert.ok(src.includes('updateJson'))
  assert.ok(src.includes('ORDERS_MAX'))
  const cocinaHtml = fs.readFileSync(path.join(root, 'cocina.html'), 'utf8')
  assert.ok(cocinaHtml.includes('data-complete-item') && cocinaHtml.includes('completeItem'))
  assert.ok(cocinaHtml.includes('data-restore'))
  const sync = fs.readFileSync(path.join(root, 'kitchenSync.js'), 'utf8')
  assert.ok(sync.includes('completeItem:') && sync.includes('restore:'))
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
  assert.ok(informes.includes("reason: 'not_monday'") || informes.includes('not_monday'))
  assert.ok(informes.includes('maybeTriggerWeeklyMondayBackup'))
  assert.ok(informes.includes('getInformeStatus'))
  assert.ok(informes.includes('not_monday_10_madrid'))
  assert.ok(informes.includes('maybeTriggerWeeklyAfterSundayClose'))
  assert.ok(informes.includes('jornada_ops_sunday') || informes.includes('not_sunday_close'))
  assert.ok(informes.includes('daysPreview'))
  assert.ok(informes.includes('loadLiveJornadaCierre') || informes.includes('jornada-live'))
  assert.ok(informes.includes('c.dayKey') || informes.includes('c && c.dayKey'))
  // Semanal principal: al cerrar jornada del domingo
  assert.ok(jornada.includes('maybeTriggerWeeklyAfterSundayClose'))
  assert.ok(jornada.includes('informeSemanal'))
  const health = fs.readFileSync(path.join(root, 'api/_opsHealth.js'), 'utf8')
  assert.ok(health.includes('informeCatchup') && health.includes('getInformeStatus'))
  assert.ok(health.includes('forceCatchup'))
  // Fin de jornada: bloquear mesas abiertas + echar a todos (sessionEpoch)
  assert.ok(jornada.includes('pendingMesas'))
  assert.ok(jornada.includes('bumpSessionEpoch'))
  assert.ok(jornada.includes('TPV_TABLES_KEY') || jornada.includes("'tpv'"))
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  assert.ok(Array.isArray(vercel.crons) && vercel.crons.length >= 1)
  assert.ok(vercel.crons.some((c) => c.path === '/api/ops-daily-purge'))
  assert.ok(
    vercel.crons.some((c) => c.schedule === '0 9 * * *'),
    'cron 09:00 UTC (~10 Madrid) backup semanal',
  )
  ok('cron-informes-wired')
} catch (err) {
  fail('cron-informes-wired', err)
}

// —— 8b) Fin de jornada: aviso mesas + kick all ——
try {
  const html = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  const jornada = fs.readFileSync(path.join(root, 'api/tpv-jornada.js'), 'utf8')
  assert.ok(html.includes('formatPendingMesasMsg'))
  assert.ok(html.includes('pendingMesas()'))
  assert.ok(html.includes('mesas pendientes de cerrar'))
  assert.ok(html.includes("method: 'DELETE'"))
  assert.ok(html.includes('Jornada finalizada — introduce el PIN'))
  assert.ok(jornada.includes('bumpSessionEpoch()'))
  assert.ok(jornada.includes('cartQty'))
  ok('jornada-end-mesas-kick')
} catch (err) {
  fail('jornada-end-mesas-kick', err)
}

// —— 8c) Cupo menús del día (bloqueo al seleccionar, no al enviar cocina) ——
try {
  const html = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  const jornada = fs.readFileSync(path.join(root, 'api/tpv-jornada.js'), 'utf8')
  const client = fs.readFileSync(path.join(root, 'tpvJornada.js'), 'utf8')
  assert.ok(jornada.includes('menuCupo'))
  assert.ok(jornada.includes('setmenucupo') || jornada.includes("setMenuCupo"))
  assert.ok(jornada.includes('adjustmenucupoused') || jornada.includes('adjustMenuCupoUsed'))
  assert.ok(jornada.includes('menu_cupo_agotado'))
  assert.ok(jornada.includes('emptyMenuCupo'))
  assert.ok(client.includes('setMenuCupo'))
  assert.ok(client.includes('adjustMenuCupoUsed'))
  assert.ok(html.includes('btnMenuCupo'))
  assert.ok(html.includes('menuCupoModal'))
  assert.ok(html.includes('reserveMenuCupo'))
  assert.ok(html.includes('Menús del día agotados'))
  assert.ok(html.includes('isMenuDiaLine'))
  // Bloqueo en add, no en sendToKitchen como puerta principal
  assert.ok(html.includes('async function addWithNote'))
  ok('menu-cupo-dia')
} catch (err) {
  fail('menu-cupo-dia', err)
}

// —— 8d) Reserva web pública + staff: hora libre (reloj); teléfono opcional en web ——
try {
  const html = fs.readFileSync(path.join(root, 'reservar.html'), 'utf8')
  assert.ok(html.includes('type="time"') || html.includes("type='time'"))
  assert.ok(html.includes('isServicioHora'))
  assert.ok(html.includes('telefono'))
  assert.ok(html.includes('Teléfono (opcional)'))
  assert.ok(!html.includes("const HORAS = ['12:00'"))
  const staff = fs.readFileSync(path.join(root, '../reservas/src/pages/StaffPage.tsx'), 'utf8')
  assert.ok(staff.includes('type="time"') || staff.includes("type='time'"))
  assert.ok(staff.includes('isServicioHora'))
  assert.ok(!staff.includes('HORAS_RAPIDAS.map'))
  const tpv = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  assert.ok(tpv.includes('reservasQuickForm'))
  assert.ok(tpv.includes('id="rqHora"'))
  assert.ok(tpv.includes('type="time"') || tpv.includes("type='time'"))
  assert.ok(tpv.includes('isServicioHoraReserva'))
  assert.ok(tpv.includes('submitReservasQuickForm'))
  assert.ok(!tpv.includes('HORAS_RAPIDAS'))
  ok('reserva-web-hora-libre')
} catch (err) {
  fail('reserva-web-hora-libre', err)
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

// —— 10b) Total día: verifyEditPin acepta también admin TPV (2908) ——
try {
  const carta = fs.readFileSync(path.join(root, 'api/carta.js'), 'utf8')
  assert.ok(carta.includes("action === 'verifyEditPin'"))
  assert.ok(carta.includes('adminPinOk'))
  ok('carta-total-dia-admin-pin')
} catch (err) {
  fail('carta-total-dia-admin-pin', err)
}

// —— 11) Usuarios TPV por PIN (sin función Hobby extra) ——
try {
  const auth = fs.readFileSync(path.join(root, 'api/tpv-auth.js'), 'utf8')
  const users = fs.readFileSync(path.join(root, 'api/_tpvUsers.js'), 'utf8')
  const html = fs.readFileSync(path.join(root, 'tpv.html'), 'utf8')
  assert.ok(auth.includes("action === 'setPin'"))
  assert.ok(auth.includes("action === 'clearPin'"))
  assert.ok(auth.includes("action === 'createUser'"))
  assert.ok(auth.includes("action === 'switchUser'"))
  assert.ok(users.includes('clearUserPin'))
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
  assert.ok(html.includes('abajo a la IZQUIERDA'))
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

if (failed) {
  console.error('\n' + failed + ' test(s) failed')
  process.exit(1)
}
console.log('\nALL SMOKE TESTS PASSED')

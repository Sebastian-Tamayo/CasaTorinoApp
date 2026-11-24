/**
 * Smoke: Listo por plato + recuperar plato en histórico.
 * Ejecutar: node web/scripts/test-kitchen-complete-item.js
 */
'use strict'

const {
  emptyState,
  normalizeState,
  applyCompleteItem,
  applyRestoreHistoryEntry,
  platePickupMessage,
} = require('../api/kitchen')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(
  platePickupMessage('7', 'Bandeja paisa') === 'Recoger plato "Bandeja paisa" · mesa 7',
  'mensaje pickup plato',
)

function baseOrder() {
  return {
    id: 'k-test-1',
    mesa: '12',
    status: 'pending_kitchen',
    kind: 'order',
    createdAt: '2026-11-24T10:00:00.000Z',
    completedAt: null,
    notes: '',
    items: [
      { id: 'a', name: 'Empanada', qty: 1, categoryType: 'comida', catId: 'entrantes', note: '' },
      { id: 'b', name: 'Bandeja', qty: 1, categoryType: 'comida', catId: 'platos', note: '' },
      { id: 'c', name: 'Sancocho', qty: 2, categoryType: 'comida', catId: 'platos', note: '' },
    ],
  }
}

// 1) Completar primer plato: comanda sigue, pickup por nombre, histórico parcial
{
  const state = normalizeState({ ...emptyState(), orders: [baseOrder()] })
  const { state: next, meta } = applyCompleteItem(state, {
    orderId: 'k-test-1',
    itemIndex: 0,
    itemId: 'a',
    now: '2026-11-24T10:05:00.000Z',
  })
  assert(next.orders.length === 1, 'comanda sigue viva')
  assert(next.orders[0].items.length === 2, 'quedan 2 líneas')
  assert(!next.orders[0].items.some((it) => it.id === 'a'), 'empanada fuera')
  assert(meta.pickup && /Empanada/.test(meta.pickup.message), 'pickup con nombre')
  assert(meta.orderClosed === false, 'no cierra aún')
  assert(next.history.length === 1 && next.history[0].itemReady === true, 'hist parcial')
  assert(next.history[0].items[0].name === 'Empanada', 'hist solo empanada')
  assert(next.lastCompleted && next.lastCompleted.id === meta.order.id, 'lastCompleted')
}

// 2) Qty>1: decrementa de 1 en 1
{
  const state = normalizeState({ ...emptyState(), orders: [baseOrder()] })
  const { state: next } = applyCompleteItem(state, {
    orderId: 'k-test-1',
    itemIndex: 2,
    itemId: 'c',
    now: '2026-11-24T10:06:00.000Z',
  })
  const sancocho = next.orders[0].items.find((it) => it.id === 'c')
  assert(sancocho && sancocho.qty === 1, 'sancocho qty 2→1')
  assert(next.history[0].items[0].qty === 1, 'hist 1 ud')
}

// 3) Último plato cierra comanda
{
  let state = normalizeState({
    ...emptyState(),
    orders: [
      {
        ...baseOrder(),
        items: [
          { id: 'b', name: 'Bandeja', qty: 1, categoryType: 'comida', catId: 'platos', note: '' },
        ],
      },
    ],
  })
  const { state: next, meta } = applyCompleteItem(state, {
    orderId: 'k-test-1',
    itemIndex: 0,
    itemId: 'b',
    now: '2026-11-24T10:07:00.000Z',
  })
  assert(next.orders.length === 0, 'comanda cerrada')
  assert(meta.orderClosed === true, 'orderClosed')
  assert(/Bandeja/.test(meta.pickup.message), 'pickup último plato')
}

// 4) Recuperar plato → comanda solo con ese plato
{
  let state = normalizeState({ ...emptyState(), orders: [baseOrder()] })
  const done = applyCompleteItem(state, {
    orderId: 'k-test-1',
    itemIndex: 1,
    itemId: 'b',
    now: '2026-11-24T10:08:00.000Z',
  })
  state = done.state
  assert(state.orders[0].items.length === 2, 'viven 2 tras listo bandeja')
  // Cerrar el resto para dejar solo histórico del plato
  while (state.orders.length) {
    const o = state.orders[0]
    const r = applyCompleteItem(state, {
      orderId: o.id,
      itemIndex: 0,
      now: '2026-11-24T10:09:00.000Z',
    })
    state = r.state
  }
  const bandejaHist = state.history.find((h) => h.items?.[0]?.name === 'Bandeja')
  assert(bandejaHist, 'hist bandeja')
  const restored = applyRestoreHistoryEntry(state, bandejaHist.id)
  assert(restored.state.orders.length === 1, 'vuelve 1 comanda')
  assert(restored.state.orders[0].id === 'k-test-1', 'mismo parent id')
  assert(restored.state.orders[0].items.length === 1, 'solo bandeja')
  assert(restored.state.orders[0].items[0].name === 'Bandeja', 'nombre ok')
  assert(!restored.state.history.some((h) => h.id === bandejaHist.id), 'sale del hist')
}

// 5) Undo último = restore
{
  let state = normalizeState({ ...emptyState(), orders: [baseOrder()] })
  const { state: mid, meta } = applyCompleteItem(state, {
    orderId: 'k-test-1',
    itemIndex: 0,
    itemId: 'a',
    now: '2026-11-24T10:10:00.000Z',
  })
  const back = applyRestoreHistoryEntry(mid, meta.order.id)
  assert(back.state.orders[0].items.some((it) => it.name === 'Empanada'), 'empanada vuelve')
  assert(back.state.orders[0].items.length === 3, '3 líneas otra vez')
}

console.log('ok: kitchen completeItem + restore plato')

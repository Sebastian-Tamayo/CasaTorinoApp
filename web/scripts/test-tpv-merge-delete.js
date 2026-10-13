#!/usr/bin/env node
/**
 * Regresión: borrar línea en un dispositivo NO debe resucitar desde otro.
 * También: add concurrente de otra línea sí se conserva.
 */
const assert = require('assert')
const {
  mergeCarts,
  mergeBusyTables,
  mergeTables,
  cartQty,
} = require('../api/_tpvMerge')

const now = Date.now()
const t0 = now - 5000
const t1 = now - 3000
const t2 = now - 1000

// 1) Borrado con tombstone gana
{
  const a = {
    cart: { cerveza: { qty: 1, price: 2, updatedAt: t0 } },
    removed: { sidra: t2 },
    updatedAt: t2,
  }
  const b = {
    cart: {
      cerveza: { qty: 1, price: 2, updatedAt: t0 },
      sidra: { qty: 1, price: 3, updatedAt: t0 },
    },
    removed: {},
    updatedAt: t1,
  }
  const m = mergeBusyTables(a, b, true)
  assert.strictEqual(m.cart.sidra, undefined, 'sidra borrada no debe volver')
  assert.ok(m.cart.cerveza, 'cerveza se conserva')
  assert.ok(m.removed.sidra >= t2, 'tombstone sidra')
}

// 2) Add concurrente: Sidra en B, cerveza nueva en A → ambas
{
  const a = {
    cart: { cerveza: { qty: 1, price: 2, addedAt: t2, updatedAt: t2 } },
    removed: {},
    updatedAt: t2,
  }
  const b = {
    cart: { sidra: { qty: 1, price: 3, addedAt: t1, updatedAt: t1 } },
    removed: {},
    updatedAt: t1,
  }
  const m = mergeBusyTables(a, b, true)
  assert.ok(m.cart.cerveza, 'cerveza nueva')
  assert.ok(m.cart.sidra, 'sidra concurrente no se pierde')
}

// 3) Vaciar mesa (incoming) más nuevo gana en servidor
{
  const server = {
    '12': {
      cart: { x: { qty: 2, price: 5, updatedAt: t0 } },
      removed: {},
      updatedAt: t1,
    },
  }
  const incoming = {
    '12': { cart: {}, removed: { x: t2 }, updatedAt: t2 },
  }
  const m = mergeTables(server, incoming, true)
  assert.strictEqual(cartQty(m.tables['12']), 0, 'mesa vaciada')
}

// 4) mergeCarts directo
{
  const r = mergeCarts(
    { a: { qty: 1, updatedAt: t2 } },
    { a: { qty: 1, updatedAt: t0 }, b: { qty: 1, updatedAt: t0 } },
    { b: t2 },
    {},
    t2,
    t1,
  )
  assert.ok(r.cart.a)
  assert.strictEqual(r.cart.b, undefined)
  assert.ok(r.removed.b)
}

console.log('OK test-tpv-merge-delete')

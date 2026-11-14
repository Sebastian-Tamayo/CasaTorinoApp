/**
 * Smoke: Varios cocina pasa sanitizeItems; menú del día ya no es menu_dia 2 tiempos.
 * Ejecutar: node web/scripts/test-kitchen-varios-menu.js
 */
'use strict'

const path = require('path')
const fs = require('fs')
const kitchen = require('../api/kitchen')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const { sanitizeItems, isSpanishMenuItem, buildMenuDiaOrderFields } = kitchen

const out = sanitizeItems([
  { id: 'extras-tapa-k', name: 'Tapa', qty: 1, catId: 'extras', categoryType: 'comida' },
  { id: 'extras-pan', name: 'Pan', qty: 1, catId: 'extras', categoryType: 'bebida' },
  { id: 'extras-encargo-k', name: 'Encargo', qty: 2, catId: 'extras' },
  { id: 'coca', name: 'Coca', qty: 1, catId: 'bebidas', categoryType: 'bebida' },
  { id: 'menu-dia', name: 'Menú del día', qty: 1, catId: 'menus-dia', categoryType: 'comida' },
])
assert(out.length === 3, `esperaba 3 items cocina, got ${out.length}: ${JSON.stringify(out)}`)
assert(out.some((x) => x.id === 'extras-tapa-k'), 'falta extras cocina con categoryType')
assert(out.some((x) => x.id === 'extras-encargo-k'), 'falta extras -k')
assert(out.some((x) => x.id === 'menu-dia'), 'falta menú del día')
assert(!out.some((x) => x.id === 'extras-pan'), 'pan barra no debe pasar')
assert(!out.some((x) => x.id === 'coca'), 'bebida no debe pasar')

assert(isSpanishMenuItem({ catId: 'menus-dia', note: '', coursePick: true }) === false, 'coursePick ya no activa 2 tiempos')
assert(
  isSpanishMenuItem({ catId: 'menus-dia', note: 'Primero N1 · Segundo N2' }) === true,
  'legado Primero/Segundo sigue reconocido',
)

const menuFields = buildMenuDiaOrderFields([
  { id: 'menu-dia', name: 'Menú del día', qty: 1, catId: 'menus-dia', note: '', categoryType: 'comida' },
])
assert(menuFields == null, 'menú sin nota 1º/2º no debe ser kind menu_dia')

const cartaJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/carta.json'), 'utf8'))
const cartaSrc = fs.readFileSync(path.join(__dirname, '../api/carta.js'), 'utf8')
const menus = (cartaJson.categories || []).find((c) => c.id === 'menus-dia')
const plato = (menus?.items || []).find((i) => i.id === 'menu-dia')
assert(plato, 'carta.json sin menu-dia')
assert(plato.coursePick !== true, 'carta.json aún tiene coursePick')
assert(/delete primary\.coursePick/.test(cartaSrc), 'ensureSingleMenuDia debe borrar coursePick')

// Payload típico tras «Añadir a cuenta» con destino Cocina
const auto = sanitizeItems([
  {
    id: 'extras-croqueta-k',
    name: 'Croqueta',
    qty: 1,
    catId: 'extras',
    categoryType: 'comida',
    note: '',
  },
])
assert(auto.length === 1 && auto[0].id === 'extras-croqueta-k', 'auto Varios cocina debe pasar sanitize')

console.log('ok: kitchen varios + menu comanda unica')

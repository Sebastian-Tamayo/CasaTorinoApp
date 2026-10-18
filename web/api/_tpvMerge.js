/**
 * Merge de mesas TPV — last-write-wins por línea + tombstones.
 * Evita que un borrado en un dispositivo “resucite” desde otro (bug domingo).
 * Espejo en web/tpvSync.js (cliente).
 */

function cartQty(table) {
  let n = 0
  const cart = table && table.cart
  if (!cart || typeof cart !== 'object' || Array.isArray(cart)) return 0
  for (const line of Object.values(cart)) n += Math.max(0, Number(line?.qty) || 0)
  return n
}

function tablesQty(tables) {
  let n = 0
  if (!tables || typeof tables !== 'object') return 0
  for (const t of Object.values(tables)) n += cartQty(t)
  return n
}

function tableAt(t) {
  return Math.max(0, Number(t && t.updatedAt) || 0)
}

function normCart(cart) {
  return cart && typeof cart === 'object' && !Array.isArray(cart) ? cart : {}
}

function normRemoved(removed) {
  return removed && typeof removed === 'object' && !Array.isArray(removed)
    ? removed
    : {}
}

/**
 * Timestamp de presencia de UNA línea.
 * IMPORTANTE: no usar tableAtMs. Si se usa el updatedAt de la mesa, cualquier
 * otro producto añadido después “infla” líneas viejas y pueden resucitar
 * borrados (p. ej. bocatas fantasma al sincronizar entre móviles).
 */
function linePresentTs(line, _tableAtMs) {
  if (!line || typeof line !== 'object') return 0
  return Math.max(
    0,
    Number(line.updatedAt) || 0,
    Number(line.addedAt) || 0,
  )
}

function pruneRemoved(removed, now = Date.now()) {
  const out = {}
  const maxAge = 36 * 60 * 60 * 1000
  for (const [k, ts] of Object.entries(normRemoved(removed))) {
    const n = Number(ts) || 0
    if (n > 0 && now - n < maxAge) out[k] = n
  }
  return out
}

/**
 * Une carritos con tombstones de borrado.
 * Una línea solo vuelve si su presencia es MÁS NUEVA que el tombstone.
 */
function mergeCarts(cartA, cartB, removedA, removedB, atA, atB) {
  const a = normCart(cartA)
  const b = normCart(cartB)
  const remA = normRemoved(removedA)
  const remB = normRemoved(removedB)
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
    ...Object.keys(remA),
    ...Object.keys(remB),
  ])
  const out = {}
  const removed = {}

  for (const key of keys) {
    const lineA = a[key]
    const lineB = b[key]
    const hasA = lineA && typeof lineA === 'object' && Math.max(0, Number(lineA.qty) || 0) > 0
    const hasB = lineB && typeof lineB === 'object' && Math.max(0, Number(lineB.qty) || 0) > 0
    const presentA = hasA ? linePresentTs(lineA, atA) : 0
    const presentB = hasB ? linePresentTs(lineB, atB) : 0
    const remTs = Math.max(0, Number(remA[key]) || 0, Number(remB[key]) || 0)

    // Borrado más reciente que cualquier presencia → se queda borrado
    if (remTs > 0 && remTs >= presentA && remTs >= presentB) {
      removed[key] = remTs
      continue
    }

    if (hasA || hasB) {
      let win = null
      if (hasA && hasB) win = presentA >= presentB ? lineA : lineB
      else win = hasA ? lineA : lineB
      if (win && Math.max(0, Number(win.qty) || 0) > 0) out[key] = win
    } else if (remTs > 0) {
      removed[key] = remTs
    }
  }

  return { cart: out, removed: pruneRemoved(removed) }
}

function mergeHist(newerHist, olderHist) {
  const out = []
  const seen = new Set()
  for (const h of [
    ...(Array.isArray(newerHist) ? newerHist : []),
    ...(Array.isArray(olderHist) ? olderHist : []),
  ]) {
    const k = String(h || '')
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out.slice(-80)
}

function mergeBusyTables(a, b, preferA) {
  const aAt = tableAt(a)
  const bAt = tableAt(b)
  let newer = a
  let older = b
  if (aAt !== bAt) {
    newer = aAt > bAt ? a : b
    older = aAt > bAt ? b : a
  } else if (!preferA) {
    newer = b
    older = a
  }

  // Vaciar/cobrar explícito: el lado más nuevo con cleared gana vacío total
  // (no dejar que líneas viejas sin tombstone “resuciten”)
  if (Boolean(newer.cleared) && cartQty(newer) === 0) {
    const rem = { ...normRemoved(older.removed), ...normRemoved(newer.removed) }
    const stamp = Math.max(tableAt(newer), Date.now())
    for (const key of Object.keys(normCart(older.cart))) {
      if (!rem[key] || Number(rem[key]) < stamp) rem[key] = stamp
    }
    for (const key of Object.keys(normCart(newer.cart))) {
      if (!rem[key] || Number(rem[key]) < stamp) rem[key] = stamp
    }
    return {
      cart: {},
      removed: pruneRemoved(rem),
      hist: Array.isArray(newer.hist) ? newer.hist : [],
      notes: '',
      paid: '',
      waiterId: null,
      waiterName: null,
      cleared: true,
      updatedAt: Math.max(aAt, bAt, stamp),
    }
  }

  const merged = mergeCarts(
    a.cart,
    b.cart,
    a.removed,
    b.removed,
    aAt,
    bAt,
  )
  return {
    cart: merged.cart,
    removed: merged.removed,
    hist: mergeHist(newer.hist, older.hist),
    notes: String(newer.notes || older.notes || ''),
    paid: String(newer.paid || older.paid || ''),
    waiterId: newer.waiterId || older.waiterId || null,
    waiterName: newer.waiterName || older.waiterName || null,
    cleared: false,
    updatedAt: Math.max(aAt, bAt),
  }
}

/**
 * Fusiona mesas en servidor con updatedAt POR MESA.
 * Borrados (cart vacío o tombstones) ganan si son más nuevos.
 */
function mergeTables(serverTables, incomingTables, preferIncoming) {
  const server = serverTables && typeof serverTables === 'object' ? serverTables : {}
  const incoming =
    incomingTables && typeof incomingTables === 'object' ? incomingTables : {}
  const sTotal = tablesQty(server)
  const incomingKeys = Object.keys(incoming)

  if (incomingKeys.length === 0 && sTotal > 0) {
    return { tables: server, rejectedEmpty: true }
  }

  const keys = new Set([...Object.keys(server), ...incomingKeys])
  const out = {}
  for (const k of keys) {
    const S = server[k]
    const I = incoming[k]
    const hasI = Object.prototype.hasOwnProperty.call(incoming, k)
    const hasS = Object.prototype.hasOwnProperty.call(server, k)
    const sq = cartQty(S)
    const iq = cartQty(I)
    const sAt = tableAt(S)
    const iAt = tableAt(I)

    if (hasI && hasS) {
      if (sq === 0 && iq > 0) {
        out[k] = iAt > sAt ? I : S
        continue
      }
      if (iq === 0 && sq > 0) {
        out[k] = iAt >= sAt || preferIncoming ? I : S
        continue
      }
      if (iq > 0 && sq > 0) {
        out[k] = mergeBusyTables(I, S, preferIncoming)
        continue
      }
      if (iAt !== sAt) {
        out[k] = iAt > sAt ? I : S
      } else {
        out[k] = preferIncoming ? I : S
      }
    } else if (hasI) {
      out[k] = I
    } else if (hasS) {
      out[k] = S
    }
  }
  return { tables: out, rejectedEmpty: false }
}

module.exports = {
  cartQty,
  tablesQty,
  tableAt,
  mergeCarts,
  mergeHist,
  mergeBusyTables,
  mergeTables,
  pruneRemoved,
  linePresentTs,
}

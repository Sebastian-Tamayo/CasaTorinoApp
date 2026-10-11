/**
 * Merge de mesas TPV — unión de líneas (anti-pérdida de productos).
 * Usado por /api/tpv-sync. La lógica espejo vive en web/tpvSync.js (cliente).
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

function mergeCarts(newerCart, olderCart) {
  const out = {}
  const newer =
    newerCart && typeof newerCart === 'object' && !Array.isArray(newerCart)
      ? newerCart
      : {}
  const older =
    olderCart && typeof olderCart === 'object' && !Array.isArray(olderCart)
      ? olderCart
      : {}
  for (const [key, line] of Object.entries(newer)) {
    if (!line || typeof line !== 'object') continue
    if (!(Math.max(0, Number(line.qty) || 0) > 0)) continue
    out[key] = line
  }
  for (const [key, line] of Object.entries(older)) {
    if (!line || typeof line !== 'object') continue
    if (!(Math.max(0, Number(line.qty) || 0) > 0)) continue
    if (!Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = line
    }
  }
  return out
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
  return {
    cart: mergeCarts(newer.cart, older.cart),
    hist: mergeHist(newer.hist, older.hist),
    notes: String(newer.notes || older.notes || ''),
    paid: String(newer.paid || older.paid || ''),
    updatedAt: Math.max(aAt, bAt, Date.now()),
  }
}

/**
 * Fusiona mesas en servidor con updatedAt POR MESA.
 * Si AMBAS tienen productos: unión de líneas (no LWW ciego).
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
}

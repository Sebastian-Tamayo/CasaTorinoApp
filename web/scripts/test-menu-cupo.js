/**
 * Unit tests for menuCupo normalize / reserve logic (mirrors tpv-jornada.js).
 */
const assert = require('assert')

function emptyMenuCupo() {
  return { limit: null, used: 0, updatedAt: 0 }
}

function normalizeMenuCupo(raw) {
  const base = emptyMenuCupo()
  if (!raw || typeof raw !== 'object') return base
  let limit = raw.limit
  if (limit === '' || limit === undefined || limit === null) {
    limit = null
  } else {
    limit = Math.floor(Number(limit))
    if (!Number.isFinite(limit) || limit <= 0) limit = null
  }
  let used = Math.floor(Number(raw.used))
  if (!Number.isFinite(used) || used < 0) used = 0
  const updatedAt = Number(raw.updatedAt) || 0
  return { limit, used, updatedAt }
}

function setMenuCupo(cur, body) {
  const resetUsed = Boolean(body.resetUsed)
  let nextLimit = body.limit
  if (nextLimit === '' || nextLimit === undefined || nextLimit === null) {
    nextLimit = null
  } else {
    nextLimit = Math.floor(Number(nextLimit))
    if (!Number.isFinite(nextLimit) || nextLimit <= 0) nextLimit = null
  }
  const prev = normalizeMenuCupo(cur.menuCupo)
  const wasOff = prev.limit == null
  let used = prev.used
  if (nextLimit == null) used = 0
  else if (resetUsed || wasOff) used = 0
  return {
    ...cur,
    menuCupo: { limit: nextLimit, used, updatedAt: 1 },
  }
}

function adjust(cur, delta) {
  const cupo = normalizeMenuCupo(cur.menuCupo)
  if (cupo.limit == null) return { ok: true, state: { ...cur, menuCupo: cupo } }
  const nextUsed = cupo.used + delta
  if (delta > 0 && nextUsed > cupo.limit) {
    return { ok: false, error: 'Menús del día agotados', state: cur }
  }
  return {
    ok: true,
    state: {
      ...cur,
      menuCupo: {
        limit: cupo.limit,
        used: Math.max(0, nextUsed),
        updatedAt: 1,
      },
    },
  }
}

let s = { menuCupo: emptyMenuCupo() }
s = setMenuCupo(s, { limit: 2 })
assert.strictEqual(s.menuCupo.limit, 2)
assert.strictEqual(s.menuCupo.used, 0)

let r = adjust(s, 1)
assert.ok(r.ok)
s = r.state
r = adjust(s, 1)
assert.ok(r.ok)
s = r.state
r = adjust(s, 1)
assert.ok(!r.ok)
assert.match(r.error, /agotados/i)

s = setMenuCupo(s, { limit: 3 })
assert.strictEqual(s.menuCupo.used, 2) // keep used when raising limit
r = adjust(s, 1)
assert.ok(r.ok)
s = r.state
assert.strictEqual(s.menuCupo.used, 3)

r = adjust(s, -1)
assert.ok(r.ok)
s = r.state
assert.strictEqual(s.menuCupo.used, 2)

s = setMenuCupo(s, { limit: 3, resetUsed: true })
assert.strictEqual(s.menuCupo.used, 0)

s = setMenuCupo(s, { limit: null })
assert.strictEqual(s.menuCupo.limit, null)
r = adjust(s, 99)
assert.ok(r.ok)

console.log('OK test-menu-cupo')

#!/usr/bin/env node
/**
 * One-shot: copia claves Edge Config → Supabase ops_kv.
 *
 * Uso (local, con ambas configs):
 *   node reservas/scripts/migrate-edge-to-ops.mjs
 *
 * Env Edge (origen):
 *   RESERVAS_EDGE_CONFIG_ID (o TPV_EDGE_CONFIG_ID)
 *   RESERVAS_VERCEL_TOKEN   (o TPV_VERCEL_TOKEN)
 *   RESERVAS_TEAM_ID        (o TPV_TEAM_ID) opcional
 *
 * Env Supabase (destino):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Tras migrar, quita las vars Edge Config de Vercel.
 */
const KEYS = ['reservas', 'tpvReservaAlerts']

function clean(raw) {
  let t = String(raw || '').trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1)
  }
  return t.trim()
}

const EDGE_ID = clean(
  process.env.RESERVAS_EDGE_CONFIG_ID || process.env.TPV_EDGE_CONFIG_ID,
)
const TEAM_ID = clean(process.env.RESERVAS_TEAM_ID || process.env.TPV_TEAM_ID)
const VERCEL_TOKEN = clean(
  process.env.RESERVAS_VERCEL_TOKEN || process.env.TPV_VERCEL_TOKEN,
)
const SUPABASE_URL = clean(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
).replace(/\/$/, '')
const SUPABASE_KEY = clean(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY,
)

async function readEdge(key) {
  const url =
    `https://api.vercel.com/v1/edge-config/${EDGE_ID}/item/${key}` +
    (TEAM_ID ? `?teamId=${TEAM_ID}` : '')
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (r.status === 404 || r.status === 204) return null
  if (!r.ok) throw new Error(`edge GET ${key}: ${r.status}`)
  const text = await r.text()
  if (!text.trim()) return null
  const data = JSON.parse(text)
  if (data && typeof data === 'object' && 'value' in data && data.key === key) {
    return data.value
  }
  return data
}

async function writeOps(key, value) {
  const url = `${SUPABASE_URL}/rest/v1/ops_kv?on_conflict=key`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`ops_kv POST ${key}: ${r.status} ${t.slice(0, 200)}`)
  }
}

async function main() {
  if (!EDGE_ID || !VERCEL_TOKEN) {
    console.error('Faltan vars Edge Config (origen)')
    process.exit(1)
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Faltan vars Supabase (destino)')
    process.exit(1)
  }

  for (const key of KEYS) {
    const value = await readEdge(key)
    if (value == null) {
      console.log(`skip ${key}: vacío en Edge Config`)
      continue
    }
    await writeOps(key, value)
    const n = Array.isArray(value?.items)
      ? value.items.length
      : Array.isArray(value)
        ? value.length
        : Array.isArray(value?.alerts)
          ? value.alerts.length
          : '?'
    console.log(`ok  ${key}: migrado (${n} items/alerts)`)
  }
  console.log('Listo. Quita RESERVAS_EDGE_CONFIG_* / BLOB_* de Vercel.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { cors, listReservas } from '../server/reservas-store.js'

/**
 * Healthcheck ligero: comprueba que Edge Config responde.
 * No escribe datos. Útil para vigilar caídas sin saturar el store.
 */
export default async function handler(req, res) {
  cors(res, 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' })
  }

  const started = Date.now()
  try {
    const items = await listReservas()
    return res.status(200).json({
      ok: true,
      store: 'edge-config',
      count: Array.isArray(items) ? items.length : 0,
      ms: Date.now() - started,
      ts: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[reservas-health]', err)
    return res.status(503).json({
      ok: false,
      store: 'edge-config',
      error: 'store_unavailable',
      detail: String(err && err.message ? err.message : err),
      ms: Date.now() - started,
      ts: new Date().toISOString(),
    })
  }
}

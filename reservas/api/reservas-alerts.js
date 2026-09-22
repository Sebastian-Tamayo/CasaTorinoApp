/**
 * Avisos TPV: reserva nueva desde la web.
 * GET  → { alerts, updatedAt }
 * POST → { action: 'ack', id? }  (sin id = ack todas)
 */
import {
  cors,
  listTpvReservaAlerts,
  ackTpvReservaAlert,
} from '../server/reservas-store.js'

export default async function handler(req, res) {
  cors(res, 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const data = await listTpvReservaAlerts()
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      const action = String(body.action || 'ack').toLowerCase()
      if (action !== 'ack') {
        return res.status(400).json({ error: 'Acción no válida' })
      }
      const result = await ackTpvReservaAlert(body.id)
      return res.status(200).json(result)
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err) {
    console.error('[reservas-alerts]', err)
    return res.status(500).json({
      error: 'Error de avisos de reserva',
      detail: String(err && err.message ? err.message : err),
    })
  }
}

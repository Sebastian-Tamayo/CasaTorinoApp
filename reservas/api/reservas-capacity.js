/**
 * Capacidad por franja (aforo) — GET ?fecha=&hora=
 * Suma personas de reservas confirmadas ese día/hora.
 */
import { cors, listReservas } from '../server/reservas-store.js'

const CAPACITY = Number(process.env.RESERVAS_SLOT_CAPACITY || 40)

export default async function handler(req, res) {
  cors(res, 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' })

  try {
    const fecha = String(req.query?.fecha || '').slice(0, 10)
    const hora = String(req.query?.hora || '').slice(0, 5)
    if (!fecha || !hora) {
      return res.status(400).json({ error: 'fecha y hora requeridos' })
    }
    const items = await listReservas()
    const used = items
      .filter(
        (r) =>
          r &&
          r.fecha === fecha &&
          r.hora === hora &&
          r.estado !== 'cancelada' &&
          r.estado !== 'no_show',
      )
      .reduce((a, r) => a + (Number(r.personas) || 0), 0)
    const remaining = Math.max(0, CAPACITY - used)
    return res.status(200).json({
      fecha,
      hora,
      capacity: CAPACITY,
      used,
      remaining,
    })
  } catch (err) {
    console.error('[reservas-capacity]', err)
    return res.status(500).json({
      error: 'Error de capacidad',
      detail: String(err && err.message ? err.message : err),
    })
  }
}

import { randomUUID } from 'node:crypto'
import {
  cors,
  listReservas,
  createReserva,
} from '../server/reservas-store.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const items = await listReservas()
      items.sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      )
      return res.status(200).json(items)
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      if (!body.nombre || !String(body.nombre).trim()) {
        return res.status(400).json({ error: 'Nombre obligatorio' })
      }
      const now = new Date().toISOString()
      const personas = Math.max(1, Math.min(12, Number(body.personas) || 2))
      const fecha = String(body.fecha || now.slice(0, 10))
      const hora = String(body.hora || '14:00')

      // Aforo por franja (solo si llega desde web u omitido; staff puede forzar con force:true)
      if (!body.force) {
        const CAPACITY = Number(process.env.RESERVAS_SLOT_CAPACITY || 40)
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
        if (used + personas > CAPACITY) {
          return res.status(409).json({
            error: `No hay plazas suficientes a las ${hora} (libres ${Math.max(0, CAPACITY - used)})`,
            remaining: Math.max(0, CAPACITY - used),
            capacity: CAPACITY,
          })
        }
      }

      const item = {
        id: randomUUID(),
        codigo: `CT-${Math.floor(1000 + Math.random() * 9000)}`,
        nombre: String(body.nombre).trim(),
        telefono: String(body.telefono || '').trim(),
        fecha,
        hora,
        personas,
        notas: String(body.notas || '').trim(),
        estado: 'confirmada',
        createdAt: now,
        updatedAt: now,
        creadoPor: String(body.creadoPor || 'personal'),
      }
      const saved = await createReserva(item)
      return res.status(201).json(saved)
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err) {
    console.error('[reservas]', err)
    return res.status(500).json({
      error: 'Error del servidor de reservas',
      detail: String(err && err.message ? err.message : err),
    })
  }
}

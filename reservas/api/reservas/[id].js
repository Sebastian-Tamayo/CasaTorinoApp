import { cors, updateReserva } from '../../server/reservas-store.js'

export default async function handler(req, res) {
  cors(res, 'GET,PUT,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'Falta id' })

  try {
    if (req.method === 'PUT') {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

      const next = await updateReserva(id, {
        nombre: body.nombre,
        telefono: body.telefono,
        fecha: body.fecha,
        hora: body.hora,
        personas: body.personas,
        notas: body.notas,
        estado: body.estado,
      })
      if (!next) return res.status(404).json({ error: 'Reserva no encontrada' })
      return res.status(200).json(next)
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err) {
    console.error('[reservas:id]', err)
    return res.status(500).json({
      error: 'Error del servidor de reservas',
      detail: String(err && err.message ? err.message : err),
    })
  }
}

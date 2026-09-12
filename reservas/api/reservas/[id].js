import { STORE, cors, mapItem } from '../../server/reservas-store.js'

export default async function handler(req, res) {
  cors(res, 'GET,PUT,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'Falta id' })

  try {
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

      // CrudCrud identifica por _id
      const listRes = await fetch(STORE)
      if (!listRes.ok) throw new Error(`Store LIST ${listRes.status}`)
      const list = await listRes.json()
      const current = (Array.isArray(list) ? list : []).find(
        (r) => r.id === id || r._id === id,
      )
      if (!current) return res.status(404).json({ error: 'Reserva no encontrada' })

      const remoteId = current._id
      const next = {
        id: current.id || id,
        codigo: current.codigo,
        nombre: body.nombre ?? current.nombre,
        telefono: body.telefono ?? current.telefono,
        fecha: body.fecha ?? current.fecha,
        hora: body.hora ?? current.hora,
        personas: body.personas ?? current.personas,
        notas: body.notas ?? current.notas,
        estado: body.estado ?? current.estado,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        creadoPor: current.creadoPor,
      }

      const r = await fetch(`${STORE}/${remoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!r.ok) throw new Error(`Store PUT ${r.status}`)
      return res.status(200).json(mapItem({ ...next, _id: remoteId }))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error del servidor de reservas' })
  }
}

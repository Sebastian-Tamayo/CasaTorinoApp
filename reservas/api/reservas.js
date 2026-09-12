import { randomUUID } from 'node:crypto'
import { STORE, cors, mapItem } from '../server/reservas-store.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const r = await fetch(STORE)
      if (!r.ok) throw new Error(`Store GET ${r.status}`)
      const data = await r.json()
      const items = (Array.isArray(data) ? data : []).map(mapItem)
      items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      return res.status(200).json(items)
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      if (!body.nombre || !String(body.nombre).trim()) {
        return res.status(400).json({ error: 'Nombre obligatorio' })
      }
      const now = new Date().toISOString()
      const item = {
        id: randomUUID(),
        codigo: `CT-${Math.floor(1000 + Math.random() * 9000)}`,
        nombre: String(body.nombre).trim(),
        telefono: String(body.telefono || '').trim(),
        fecha: String(body.fecha || now.slice(0, 10)),
        hora: String(body.hora || '14:00'),
        personas: Math.max(1, Math.min(12, Number(body.personas) || 2)),
        notas: String(body.notas || '').trim(),
        estado: 'confirmada',
        createdAt: now,
        updatedAt: now,
        creadoPor: String(body.creadoPor || 'personal'),
      }
      const r = await fetch(STORE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      if (!r.ok) throw new Error(`Store POST ${r.status}`)
      return res.status(201).json(mapItem(await r.json()))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error del servidor de reservas' })
  }
}

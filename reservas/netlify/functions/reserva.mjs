import { getStore } from '@netlify/blobs'

const STORE = 'casa-torino-reservas'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    },
  })
}

async function readAll(store) {
  const raw = await store.get('all', { type: 'json' })
  return Array.isArray(raw) ? raw : []
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return json({ ok: true })

  const id = context.params?.id
  if (!id) return json({ error: 'Falta id' }, 400)

  const store = getStore(STORE)
  const items = await readAll(store)
  const idx = items.findIndex((r) => r.id === id || r._id === id)
  if (idx < 0) return json({ error: 'Reserva no encontrada' }, 404)

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}))
    const current = items[idx]
    const next = {
      ...current,
      id: current.id || id,
      nombre: body.nombre ?? current.nombre,
      telefono: body.telefono ?? current.telefono,
      fecha: body.fecha ?? current.fecha,
      hora: body.hora ?? current.hora,
      personas: body.personas ?? current.personas,
      notas: body.notas ?? current.notas,
      estado: body.estado ?? current.estado,
      updatedAt: new Date().toISOString(),
    }
    items[idx] = next
    await store.setJSON('all', items)
    return json(next)
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config = { path: '/api/reservas/:id' }

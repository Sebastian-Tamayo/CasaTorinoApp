import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'

const STORE = 'casa-torino-reservas'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    },
  })
}

async function readAll(store) {
  const raw = await store.get('all', { type: 'json' })
  return Array.isArray(raw) ? raw : []
}

async function writeAll(store, items) {
  await store.setJSON('all', items)
}

export default async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })

  const store = getStore(STORE)

  if (req.method === 'GET') {
    const items = await readAll(store)
    items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return json(items)
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    if (!body.nombre || !String(body.nombre).trim()) {
      return json({ error: 'Nombre obligatorio' }, 400)
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
    const items = await readAll(store)
    items.unshift(item)
    await writeAll(store, items)
    return json(item, 201)
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config = { path: '/api/reservas' }

import { randomUUID } from 'node:crypto'
import {
  cors,
  listReservas,
  createReserva,
  pushTpvReservaAlert,
} from '../server/reservas-store.js'

/** Campos unificados web ↔ staff ↔ TPV */
function normalizeReservaFields(body) {
  const now = new Date().toISOString()
  const nombre = String(body.nombre || body.name || '').trim()
  const telefono = String(body.telefono || body.phone || body.tel || '')
    .trim()
    .replace(/\s+/g, ' ')
  const fecha = String(body.fecha || body.date || now.slice(0, 10)).slice(0, 10)
  let hora = String(body.hora || body.time || '14:00').trim()
  // Acepta "14:00:00" o "14" → "14:00"
  if (/^\d{1,2}$/.test(hora)) hora = `${hora.padStart(2, '0')}:00`
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(hora)) hora = hora.slice(0, 5)
  if (!/^\d{2}:\d{2}$/.test(hora)) hora = '14:00'
  const personas = Math.max(
    1,
    Math.min(12, Number(body.personas ?? body.guests ?? body.pax) || 2),
  )
  const notas = String(body.notas || body.notes || body.comentario || '').trim()
  const rawOrigen = String(body.creadoPor || body.source || body.origen || 'personal').trim()
  const creadoPor = rawOrigen.toLowerCase() === 'web' ? 'web' : rawOrigen || 'personal'
  return { nombre, telefono, fecha, hora, personas, notas, creadoPor, now }
}

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
      const fields = normalizeReservaFields(body)
      if (!fields.nombre) {
        return res.status(400).json({ error: 'Nombre obligatorio' })
      }
      const { nombre, telefono, fecha, hora, personas, notas, creadoPor, now } = fields

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
        nombre,
        telefono,
        fecha,
        hora,
        personas,
        notas,
        estado: 'confirmada',
        createdAt: now,
        updatedAt: now,
        creadoPor,
      }
      const saved = await createReserva(item)

      // Alerta amarilla en TPV cuando la reserva viene de la web pública
      if (String(saved.creadoPor || '').toLowerCase() === 'web') {
        try {
          await pushTpvReservaAlert({
            id: saved.id,
            reservaId: saved.id,
            codigo: saved.codigo,
            nombre: saved.nombre,
            telefono: saved.telefono,
            fecha: saved.fecha,
            hora: saved.hora,
            personas: saved.personas,
            notas: saved.notas || '',
            message: `Nueva reserva web · ${saved.nombre} · ${saved.fecha} ${saved.hora} · ${saved.personas}p`,
            createdAt: saved.createdAt || now,
          })
        } catch (alertErr) {
          console.warn('[reservas] tpv alert', alertErr)
        }
      }

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

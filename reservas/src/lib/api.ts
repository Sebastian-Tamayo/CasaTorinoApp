import { ONLINE_API_BASE, STAFF } from '../config'
import type { Reservation, StaffUser } from '../types'

type RemoteReservation = Omit<Reservation, 'id'> & { _id?: string; id?: string }

function mapReservation(raw: RemoteReservation): Reservation {
  return {
    id: raw.id || raw._id || '',
    codigo: raw.codigo,
    nombre: raw.nombre,
    telefono: raw.telefono || '',
    fecha: raw.fecha,
    hora: raw.hora,
    personas: Number(raw.personas) || 1,
    notas: raw.notas || '',
    estado: raw.estado,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    creadoPor: raw.creadoPor || '',
  }
}

async function parseError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    /* ignore */
  }
  return 'No se pudo conectar. Revisa internet e inténtalo otra vez.'
}

export function fetchStaffDirectory(): Promise<StaffUser[]> {
  return Promise.resolve(STAFF.map(({ id, name }) => ({ id, name })))
}

export async function loginLocal(staffId: string, pin: string): Promise<StaffUser> {
  const user = STAFF.find((s) => s.id === staffId)
  if (!user || user.pin !== String(pin)) {
    throw new Error('PIN incorrecto. Prueba otra vez.')
  }
  return { id: user.id, name: user.name }
}

export async function listReservations(): Promise<Reservation[]> {
  const res = await fetch(ONLINE_API_BASE)
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as RemoteReservation[]
  return data
    .map(mapReservation)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function createReservation(input: {
  nombre: string
  telefono: string
  fecha: string
  hora: string
  personas: number
  notas: string
  creadoPor: string
}): Promise<Reservation> {
  const res = await fetch(ONLINE_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return mapReservation((await res.json()) as RemoteReservation)
}

export async function updateReservation(
  id: string,
  patch: Partial<
    Pick<Reservation, 'nombre' | 'telefono' | 'fecha' | 'hora' | 'personas' | 'notas' | 'estado'>
  >,
): Promise<Reservation> {
  const res = await fetch(`${ONLINE_API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return mapReservation((await res.json()) as RemoteReservation)
}

export function updateReservationStatus(
  id: string,
  patch: Partial<Pick<Reservation, 'estado' | 'notas'>>,
) {
  return updateReservation(id, patch)
}

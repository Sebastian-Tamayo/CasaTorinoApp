export type ReservationStatus = 'confirmada' | 'cancelada' | 'completada' | 'no_show'

export interface Reservation {
  id: string
  codigo: string
  nombre: string
  telefono: string
  fecha: string
  hora: string
  personas: number
  notas: string
  estado: ReservationStatus
  createdAt: string
  updatedAt: string
  creadoPor: string
}

export interface StaffUser {
  id: string
  name: string
}

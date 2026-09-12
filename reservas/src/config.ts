/** Casa Torino — app online simple para 4 personas del personal */
export const BUSINESS = {
  name: 'Casa Torino',
  slogan: 'Sabor que deja huella',
  address: 'Ctra. Ceares, 67, Gijón',
  phone: '612 254 719',
  whatsapp: '34612254719',
  maxPartySize: 12,
  minPartySize: 1,
} as const

/**
 * API en el mismo dominio (Vercel Serverless).
 */
export const ONLINE_API_BASE = '/api/reservas'

/** 4 personas del equipo. PIN por defecto 1234. */
export const STAFF = [
  { id: 'lorena', name: 'Lorena', pin: '1234' },
  { id: 'yuli', name: 'Yuli', pin: '1234' },
  { id: 'dayana', name: 'Dayana', pin: '1234' },
  { id: 'claribel', name: 'Claribel', pin: '1234' },
] as const

export const STATUS_LABELS: Record<import('./types').ReservationStatus, string> = {
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Hecha',
  no_show: 'No vino',
}

export const HORAS_RAPIDAS = [
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
]

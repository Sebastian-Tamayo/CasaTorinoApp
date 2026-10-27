/**
 * Persistencia remota usada solo por las funciones serverless.
 * Sustituible por Vercel Blob / KV / Postgres sin tocar el frontend.
 */
export const STORE =
  process.env.RESERVAS_STORE_URL ||
  'https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas'

export function cors(res, methods = 'GET,POST,PUT,OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function mapItem(raw) {
  if (!raw) return raw
  const { _id, ...rest } = raw
  return { ...rest, id: rest.id || _id }
}

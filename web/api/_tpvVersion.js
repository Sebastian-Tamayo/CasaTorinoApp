/**
 * Versión mínima del cliente TPV (todos los navegadores / dispositivos).
 *
 * AL DESPLEGAR un cambio del TPV, subir el MISMO valor en:
 * 1) este archivo → required
 * 2) /tpv-version.json → required
 * 3) tpv.html → TPV_CLIENT_VERSION
 *
 * Cada navegador debe pulsar «Actualizar» (ack local). Sin la cabecera
 * X-Tpv-Client-Version correcta, el API responde 426 y no deja operar.
 */
const required = '2026-10-11-force-all'
const message = 'Actualiza para seguir'

function forcePayload() {
  return {
    error: 'update_required',
    tpvForce: { required, message },
  }
}

/** true si el cliente envía la versión exigida. */
function clientVersionOk(req) {
  const v = String(
    (req && req.headers && req.headers['x-tpv-client-version']) || '',
  ).trim()
  return Boolean(v && v === required)
}

/**
 * Si la versión no coincide, escribe 426 y devuelve true (hay que cortar el handler).
 * Los clientes viejos (sin cabecera) también quedan bloqueados → deben recargar.
 */
function rejectIfClientOutdated(req, res) {
  if (clientVersionOk(req)) return false
  res.statusCode = 426
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(forcePayload()))
  return true
}

module.exports = {
  required,
  message,
  forcePayload,
  clientVersionOk,
  rejectIfClientOutdated,
}

/**
 * Versión mínima del cliente TPV (todos los navegadores / dispositivos).
 *
 * AL DESPLEGAR un cambio del TPV, subir el MISMO valor en:
 * 1) este archivo → required
 * 2) /tpv-version.json → required
 * 3) tpv.html → TPV_CLIENT_VERSION
 *
 * El aviso «Actualiza para seguir» llega solo (poll / SW / API), sin que
 * el usuario recargue a mano. Pulsar Actualizar confirma y recarga.
 */
const required = '2026-10-13-menu-1'
const message = 'Actualiza: vaciar mesa no deja rastro ni camarera fantasma'

function forceInfo() {
  return { required, message }
}

function forcePayload() {
  return {
    error: 'update_required',
    tpvForce: forceInfo(),
  }
}

function clientVersionOk(req) {
  const v = String(
    (req && req.headers && req.headers['x-tpv-client-version']) || '',
  ).trim()
  return Boolean(v && v === required)
}

/** Solo mutaciones (POST): sin versión correcta → 426 */
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
  forceInfo,
  forcePayload,
  clientVersionOk,
  rejectIfClientOutdated,
}

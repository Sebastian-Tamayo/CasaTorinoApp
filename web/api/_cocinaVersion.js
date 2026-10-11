/**
 * Versión mínima del cliente Cocina (PWA / todos los navegadores).
 *
 * AL DESPLEGAR un cambio de cocina, subir el MISMO valor en:
 * 1) este archivo → required
 * 2) /cocina-version.json → required
 * 3) cocina.html → COCINA_CLIENT_VERSION
 */
const required = '2026-10-11-cocina-fullscreen'
const message = 'Actualiza para seguir'

function forcePayload() {
  return {
    error: 'update_required',
    cocinaForce: { required, message },
  }
}

function clientVersionOk(req) {
  const v = String(
    (req && req.headers && req.headers['x-cocina-client-version']) || '',
  ).trim()
  return Boolean(v && v === required)
}

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

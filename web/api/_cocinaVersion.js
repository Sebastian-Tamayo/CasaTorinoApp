/**
 * Versión mínima del cliente Cocina (PWA / todos los navegadores).
 *
 * AL DESPLEGAR un cambio de cocina, subir el MISMO valor en:
 * 1) este archivo → required
 * 2) /cocina-version.json → required
 * 3) cocina.html → COCINA_CLIENT_VERSION
 *
 * El aviso llega solo (poll / SW / ticket en panel), sin refrescar a mano.
 */
const required = '2026-10-11-cocina-push-1'
const message = 'Actualiza para seguir'

function forceInfo() {
  return { required, message }
}

function forcePayload() {
  return {
    error: 'update_required',
    cocinaForce: forceInfo(),
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

/** Ticket visible en el panel aunque el cliente sea antiguo (sin overlay). */
function forceNoticeOrder() {
  const now = new Date().toISOString()
  return {
    id: '__cocina_force_update__',
    mesa: 'APP',
    createdAt: now,
    notes: message,
    kind: 'force_update',
    status: 'alert',
    items: [
      {
        name: 'ACTUALIZA PARA SEGUIR',
        qty: 1,
        note: 'Pulsa Actualizar en pantalla',
      },
    ],
  }
}

module.exports = {
  required,
  message,
  forceInfo,
  forcePayload,
  clientVersionOk,
  rejectIfClientOutdated,
  forceNoticeOrder,
}

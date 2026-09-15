/**
 * Firma mensajes de QZ Tray (impresión silenciosa).
 * POST /api/qz-sign  body: texto a firmar (text/plain)
 * Env: QZ_PRIVATE_KEY = contenido PEM de la clave privada
 */
const crypto = require('crypto')

function cleanKey(raw) {
  let t = String(raw || '').trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1)
  }
  // Soporta \n escapados en variables de entorno de Vercel
  t = t.replace(/\\n/g, '\n')
  return t.trim()
}

function readBody(req) {
  if (typeof req.body === 'string') return Promise.resolve(req.body)
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString('utf8'))
  if (req.body != null && typeof req.body === 'object') {
    // a veces el runtime parsea JSON por error
    return Promise.resolve(String(req.body.toSign || req.body.data || ''))
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') {
    res.statusCode = 405
    return res.end('method not allowed')
  }

  const pem = cleanKey(process.env.QZ_PRIVATE_KEY || '')
  if (!pem || !pem.includes('PRIVATE KEY')) {
    res.statusCode = 503
    return res.end('QZ_PRIVATE_KEY missing')
  }

  try {
    const toSign = await readBody(req)
    if (!toSign) {
      res.statusCode = 400
      return res.end('empty body')
    }
    const sign = crypto.createSign('SHA512')
    sign.update(toSign)
    sign.end()
    const signature = sign.sign(pem, 'base64')
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.end(signature)
  } catch (err) {
    console.warn('[qz-sign]', err)
    res.statusCode = 500
    return res.end('sign failed')
  }
}

/**
 * PC del restaurante (junto a QZ Tray). No usa Vercel.
 *
 *   cd scripts && npm install && npm run whatsapp
 * Escanea el QR una vez. Sesión en scripts/.wwebjs_auth (no se sube a Git).
 *
 * POST http://localhost:3001/upload-status
 *   { primero, segundo, extra, precio, dispatchGithub?: true }
 *
 * Si dispatchGithub y GITHUB_DISPATCH_TOKEN están en el entorno, también
 * dispara GitHub Actions (Instagram + TikTok). El navegador a api.github.com
 * suele bloquearse por CORS; este proceso no.
 */
const path = require('path')
const os = require('os')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const qrcode = require('qrcode-terminal')
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const { renderMenuStory } = require('./render-menu-story')

const PORT = Number(process.env.STORIES_PORT || 3001)
const REPO = process.env.GITHUB_REPOSITORY || 'Sebastian-Tamayo/CasaTorinoApp'

let waReady = false
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})

client.on('qr', (qr) => {
  console.log('Escanea este QR con WhatsApp (Dispositivos vinculados):')
  qrcode.generate(qr, { small: true })
})
client.on('ready', () => {
  waReady = true
  console.log('WhatsApp listo · estados en localhost:' + PORT)
})
client.on('auth_failure', (msg) => {
  waReady = false
  console.error('WhatsApp auth', msg)
})
client.on('disconnected', () => {
  waReady = false
  console.warn('WhatsApp desconectado')
})

async function dispatchGithub(payload) {
  const token = String(process.env.GITHUB_DISPATCH_TOKEN || '').trim()
  if (!token) {
    return { ok: false, skipped: true, error: 'Sin GITHUB_DISPATCH_TOKEN en scripts/.env' }
  }
  const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'casa-torino-stories',
    },
    body: JSON.stringify({
      event_type: 'menu-story',
      client_payload: {
        primero: payload.primero || '',
        segundo: payload.segundo || '',
        extra: payload.extra || '',
        precio: payload.precio || '',
        direccion: payload.direccion || 'Ctra. Ceares 67',
      },
    }),
  })
  if (r.status !== 204 && !r.ok) {
    const text = await r.text().catch(() => '')
    return { ok: false, status: r.status, error: text.slice(0, 300) }
  }
  return { ok: true, status: r.status }
}

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, whatsapp: waReady })
})

app.post('/upload-status', async (req, res) => {
  try {
    if (!waReady) {
      res.status(503).json({ error: 'WhatsApp no está listo. Escanea el QR en el PC.' })
      return
    }
    const body = req.body || {}
    const png = path.join(os.tmpdir(), `menu-wa-${Date.now()}.png`)
    await renderMenuStory(body, png)
    const media = MessageMedia.fromFilePath(png)
    await client.sendMessage('status@broadcast', media, {
      caption: 'Menú del día · Casa Torino',
    })
    let github = null
    if (body.dispatchGithub) {
      github = await dispatchGithub(body)
    }
    res.json({ ok: true, whatsapp: true, github })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log('Historias WhatsApp en http://127.0.0.1:' + PORT)
  client.initialize().catch((err) => console.error('WA init', err))
})

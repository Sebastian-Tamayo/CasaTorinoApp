import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataFile = path.join(root, 'data', 'reservas.json')
const staffFile = path.join(__dirname, 'staff.json')
const distDir = path.join(root, 'dist')
const PORT = Number(process.env.PORT || 8787)

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeReservas(items) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true })
  fs.writeFileSync(dataFile, JSON.stringify(items, null, 2))
}

function makeCodigo() {
  return `CT-${Math.floor(1000 + Math.random() * 9000)}`
}

function makeId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function lanIPs() {
  const nets = os.networkInterfaces()
  const out = []
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address)
    }
  }
  return out
}

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'local', staff: 4 })
})

app.get('/api/staff', (_req, res) => {
  const staff = readJson(staffFile, [])
  res.json(staff.map(({ id, name }) => ({ id, name })))
})

app.post('/api/login', (req, res) => {
  const { staffId, pin } = req.body || {}
  const staff = readJson(staffFile, [])
  const user = staff.find((s) => s.id === staffId)
  if (!user || String(user.pin) !== String(pin ?? '')) {
    return res.status(401).json({ error: 'PIN incorrecto o persona no válida' })
  }
  res.json({ id: user.id, name: user.name })
})

app.get('/api/reservas', (_req, res) => {
  const items = readJson(dataFile, [])
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  res.json(items)
})

app.post('/api/reservas', (req, res) => {
  const body = req.body || {}
  if (!body.nombre || !String(body.nombre).trim()) {
    return res.status(400).json({ error: 'Nombre obligatorio' })
  }
  const now = new Date().toISOString()
  const item = {
    id: makeId(),
    codigo: makeCodigo(),
    nombre: String(body.nombre).trim(),
    telefono: String(body.telefono || '').trim(),
    fecha: String(body.fecha || now.slice(0, 10)),
    hora: String(body.hora || '14:00'),
    personas: Math.max(1, Math.min(12, Number(body.personas) || 2)),
    notas: String(body.notas || '').trim(),
    estado: 'confirmada',
    createdAt: now,
    updatedAt: now,
    creadoPor: String(body.creadoPor || 'personal'),
  }
  const items = readJson(dataFile, [])
  items.unshift(item)
  writeReservas(items)
  res.status(201).json(item)
})

app.patch('/api/reservas/:id', (req, res) => {
  const items = readJson(dataFile, [])
  const idx = items.findIndex((r) => r.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'No encontrada' })
  const patch = req.body || {}
  items[idx] = {
    ...items[idx],
    ...('estado' in patch ? { estado: patch.estado } : {}),
    ...('notas' in patch ? { notas: patch.notas } : {}),
    updatedAt: new Date().toISOString(),
  }
  writeReservas(items)
  res.json(items[idx])
})

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  app.get('/api/ready', (_req, res) => res.json({ build: false }))
  app.use((_req, res) => {
    res.status(503).type('html').send(`
      <h1>Casa Torino — servidor local</h1>
      <p>Falta el build. En el PC del bar ejecuta:</p>
      <pre>npm run build && npm run local</pre>
    `)
  })
}

app.listen(PORT, '0.0.0.0', () => {
  const ips = lanIPs()
  console.log('\nCasa Torino — SOLO LOCAL (no publicado)')
  console.log(`PC:     http://127.0.0.1:${PORT}`)
  for (const ip of ips) console.log(`Móvil:  http://${ip}:${PORT}  (misma WiFi)`)
  console.log('Personal: Lorena, Yuli, Dayana, Claribel · PIN 1234\n')
})

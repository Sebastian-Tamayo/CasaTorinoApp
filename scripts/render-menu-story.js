/**
 * Genera la historia 1080×1920 del menú (Puppeteer).
 * Uso: node render-menu-story.js '{"primero":"...","segundo":"...","precio":"13"}' salida.png
 */
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const puppeteer = require('puppeteer')

const TEMPLATE = path.join(__dirname, 'templates', 'menu-story.html')

function storyText(raw) {
  const body = raw && typeof raw === 'object' ? raw : {}
  const primero = String(body.primero || body.primeros || '').trim() || '—'
  const segundo = String(body.segundo || body.segundos || '').trim() || '—'
  let extra = String(body.extra || body.incluye || 'Postre y bebida a elegir').trim()
  if (extra && !/✦/.test(extra)) extra = `✦ ${extra} ✦`
  let precio = String(body.precio ?? body.price ?? '').trim().replace(/€/g, '').trim()
  const precioLabel = precio ? `Precio ${precio}€` : 'Precio'
  const direccion = String(body.direccion || 'Ctra. Ceares 67').trim()
  return { primero, segundo, extra, precio: precioLabel, direccion }
}

async function renderMenuStory(raw, outPath) {
  const data = storyText(raw)
  const dest = path.resolve(outPath)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })
    await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: 'networkidle0', timeout: 60000 })
    await page.evaluate((fields) => {
      const set = (id, value) => {
        const el = document.getElementById(id)
        if (el) el.textContent = value
      }
      set('primero', fields.primero)
      set('segundo', fields.segundo)
      set('extra', fields.extra)
      set('precio', fields.precio)
      set('direccion', fields.direccion)
    }, data)
    await page.screenshot({ path: dest, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } })
    return dest
  } finally {
    await browser.close()
  }
}

module.exports = { renderMenuStory, storyText }

if (require.main === module) {
  const raw = process.argv[2] || process.env.MENU_STORY_JSON || '{}'
  const out = process.argv[3] || path.join(__dirname, 'out', 'menu-story.png')
  let payload = {}
  try {
    payload = JSON.parse(raw)
  } catch (err) {
    console.error('JSON inválido')
    process.exit(1)
  }
  renderMenuStory(payload, out)
    .then((p) => {
      console.log(p)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

/**
 * SW TPV: avisa a todas las pestañas abiertas cuando hay versión nueva.
 * No cachea. El mensaje llega sin que el usuario pulse refrescar.
 */
const VERSION_URL = '/tpv-version.json'
let lastRequired = ''

async function broadcastForce(info) {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of clients) {
    if (!/tpv\.html/i.test(client.url || '')) continue
    try {
      client.postMessage({
        type: 'tpv-force-update',
        required: info.required,
        message: info.message || 'Actualiza para seguir',
      })
    } catch {}
  }
}

async function checkVersion() {
  try {
    const r = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
    if (!r.ok) return
    const info = await r.json()
    const req = String(info.required || '')
    if (!req) return
    if (req !== lastRequired) {
      lastRequired = req
      await broadcastForce(info)
    } else {
      await broadcastForce(info)
    }
  } catch {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim()
      } catch {}
      await checkVersion()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'skip-waiting') {
    self.skipWaiting()
  }
  if (event?.data?.type === 'check-version') {
    event.waitUntil(checkVersion())
  }
})

// Sondeo en segundo plano → el aviso aparece solo
setInterval(checkVersion, 8000)

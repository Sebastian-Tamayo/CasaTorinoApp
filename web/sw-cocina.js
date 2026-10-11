/**
 * SW Cocina: avisa a todas las tablets con la app abierta.
 * Manifest fullscreen + mensaje «Actualiza para seguir» sin refrescar a mano.
 */
const SW_VERSION = '2026-10-11-cocina-push-1'
const VERSION_URL = '/cocina-version.json'
let lastRequired = ''

async function broadcastForce(info) {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of clients) {
    if (!/cocina\.html/i.test(client.url || '')) continue
    try {
      client.postMessage({
        type: 'cocina-force-update',
        required: info.required,
        message: info.message || 'Actualiza para seguir',
        swVersion: SW_VERSION,
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
    lastRequired = req
    await broadcastForce(info)
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
})

setInterval(checkVersion, 8000)

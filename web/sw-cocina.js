/**
 * SW Cocina: al activarse, recarga las tablets para recuperar sync.
 * Pass-through (sin caché).
 */
const SW_VERSION = '2026-10-11-fix-create-1'

async function reloadCocinaClients() {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of clients) {
    if (!/cocina\.html/i.test(client.url || '')) continue
    try {
      const u = new URL(client.url)
      u.searchParams.set('v', String(Date.now()))
      if (typeof client.navigate === 'function') {
        await client.navigate(u.toString())
      } else {
        client.postMessage({
          type: 'cocina-force-update',
          required: '2026-10-11-cocina-push-1',
          message: 'Actualiza para seguir',
          swVersion: SW_VERSION,
        })
      }
    } catch {}
  }
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
      await reloadCocinaClients()
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

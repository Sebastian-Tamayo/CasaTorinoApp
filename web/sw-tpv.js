/**
 * SW TPV: al activarse, recarga pestañas TPV si hace falta.
 * Pass-through (sin caché). No bloquea envío a cocina.
 */
const SW_VERSION = '2026-10-11-fix-create-1'

async function reloadTpvClients() {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of clients) {
    if (!/tpv\.html/i.test(client.url || '')) continue
    try {
      const u = new URL(client.url)
      u.searchParams.set('v', String(Date.now()))
      if (typeof client.navigate === 'function') {
        await client.navigate(u.toString())
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
      // No forzar reload masivo del TPV en servicio: solo claim.
      // El fix de cocina create es server-side.
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
  if (event?.data?.type === 'reload-tpv') {
    event.waitUntil(reloadTpvClients())
  }
})

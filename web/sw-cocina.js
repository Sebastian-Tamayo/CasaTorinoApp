/**
 * Service worker Cocina PWA.
 * Pass-through (sin caché). Al actualizar, toma control para que
 * la tablet recargue con el manifest a pantalla completa.
 */
const SW_VERSION = '2026-10-11-cocina-fullscreen'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim()
      } catch {}
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of clients) {
        try {
          client.postMessage({ type: 'cocina-sw-updated', version: SW_VERSION })
        } catch {}
      }
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

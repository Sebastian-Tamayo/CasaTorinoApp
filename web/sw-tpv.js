/**
 * SW TPV: pass-through. Sin sondeo de versión (el HTML ya hace poll lento).
 * Evita gastar cuota CDN Hobby.
 */
const SW_VERSION = '2026-10-13-plano-9'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim()
      } catch {}
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

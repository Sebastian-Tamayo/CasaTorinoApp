/**
 * Service worker mínimo para instalar Cocina como app (PWA).
 * No cachea nada: todo va a red. No altera TPV, carta ni APIs.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  // No clients.claim(): evita tomar control agresivo de otras pestañas.
  event.waitUntil(Promise.resolve())
})

self.addEventListener('fetch', (event) => {
  // Pass-through obligatorio para criterios de instalación de Chrome.
  event.respondWith(fetch(event.request))
})

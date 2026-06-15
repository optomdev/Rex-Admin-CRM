// Kill-switch service worker.
// A previous app on localhost:3000 left a service worker registered on this
// origin, which intercepted CRM requests and broke page loads. Browsers
// re-fetch /sw.js on navigation; this replacement unregisters itself and
// reloads open tabs so the stale worker disappears for good.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => Promise.all(clients.map(client => client.navigate(client.url))))
  )
})

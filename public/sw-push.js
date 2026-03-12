/**
 * Push notification event handlers for the service worker.
 * This file is imported by the vite-plugin-pwa generated service worker.
 */

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Kanoz Daily Report', body: 'New notification' }

  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: '/kanoz-icon.svg',
    badge: '/kanoz-icon.svg',
    tag: data.tag || 'kanoz-notification',
    data: {
      url: data.url || '/',
    },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Handle notification click — open the app to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.navigate(targetUrl)
          return
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl)
    })
  )
})

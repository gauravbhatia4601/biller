/*
 * Biller service worker — minimal installable PWA scope.
 *
 * Deliberately conservative: this app is auth- and data-driven (invoices are
 * fetched from the API), so the SW must never serve stale app data.
 *  - /api/* is never intercepted (always network).
 *  - Navigations are network-first with a cached offline fallback page.
 *  - Immutable /_next/static/ assets are cache-first.
 *  - Everything else passes through untouched.
 */

const CACHE_NAME = 'biller-v3'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        await cache.add(OFFLINE_URL)
      } catch (err) {
        // Install must not fail when the app is unreachable — the offline
        // page will be cached on a later navigation instead.
        console.warn('SW: offline page precache failed:', err)
      }
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never intercept API/auth traffic — always go to the network.
  if (url.pathname.startsWith('/api/')) return

  // Page navigations: network-first, fall back to cache, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(CACHE_NAME)
          cache.put(request, response.clone())
          return response
        } catch (err) {
          const cached = await caches.match(request)
          if (cached) return cached
          const offline = await caches.match(OFFLINE_URL)
          if (offline) return offline
          throw err
        }
      })()
    )
    return
  }

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(request, response.clone())
        }
        return response
      })()
    )
  }
})

/*
 * Web push: server-sent notifications arrive here even when the PWA is
 * closed. The payload is JSON {title, body, url, tag} from the notification
 * core service.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (err) {
    data = { title: 'Biller', body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Biller', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/dashboard' },
    })
  )
})

/*
 * Clicked notifications (push and local alike) land here — clicking one
 * focuses the app and navigates to the invoice.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/dashboard'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus()
          // WindowClient.navigate is not implemented in Firefox — fall
          // through to a new window rather than just focusing.
          if ('navigate' in client) {
            try {
              await client.navigate(target)
              return
            } catch (err) {
              break
            }
          }
          break
        }
      }
      await self.clients.openWindow(target)
    })()
  )
})
// Browser-notification side of the notification system. Client-only —
// never import this from server code.

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

/**
 * Registers this device for web push (toasts arrive even when the PWA is
 * closed). Best-effort: requires an HTTPS context, a service worker, and a
 * granted notification permission — every failure is swallowed.
 */
export async function subscribeToPush(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (!isNotificationSupported() || Notification.permission !== 'granted') return

    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration || !('pushManager' in registration)) return

    const configRes = await fetch('/api/push')
    if (!configRes.ok) return
    const { publicKey } = await configRes.json()
    if (!publicKey) return

    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }))

    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'subscribe', subscription: subscription.toJSON() }),
    })
  } catch (error: any) {
    // A denied/failed subscription must never break the bell or the app.
    console.warn('Push subscription failed:', error?.message || error)
  }
}

/**
 * Shows a local (non-push) OS notification. Prefers the service-worker path —
 * REQUIRED on iOS standalone mode, where the `new Notification()` constructor
 * does not exist. Best-effort: all errors are swallowed; notifications must
 * never break the UI.
 */
export async function showLocalNotification(input: {
  id: string
  title: string
  body: string
  url: string // e.g. '/invoices/<id>'
  tag: string
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(input.title, {
          body: input.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: input.tag,
          data: { url: input.url },
        })
        return
      }
    }

    new Notification(input.title, {
      body: input.body,
      icon: '/icons/icon-192.png',
      tag: input.tag,
      data: { url: input.url },
    })
  } catch (error) {
    console.warn('Local notification failed:', error)
  }
}
// Browser-notification side of the notification system. Client-only —
// never import this from server code.

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
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
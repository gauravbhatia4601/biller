'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isNotificationSupported, showLocalNotification, subscribeToPush } from '@/lib/notifications/client'
import type { NotificationDTO, NotificationListResponse } from '@/lib/notifications/types'

const LAST_SEEN_KEY = 'biller.notif.lastSeenPingAt'

export type NotificationPermissionState = NotificationPermission | 'unsupported' | 'unknown'

/**
 * Polls /api/notifications, tracks the unread badge, and raises LOCAL browser
 * notifications for genuinely-new items (no web push). Ping dedupe:
 *  - items are "new" iff their lastNotifiedAt is newer than the last-seen floor
 *  - the floor is mirrored to localStorage so only one tab pings per item
 *  - at most ONE OS notification per poll cycle (bursts collapse)
 */
export function useNotifications(options?: { pollIntervalMs?: number }) {
  const pollIntervalMs = options?.pollIntervalMs ?? 60_000

  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermissionState>('unknown')

  const lastSeenPingRef = useRef<number>(0)
  const initializedRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setPermission('unsupported')
    } else {
      setPermission(Notification.permission)
    }
  }, [])

  const processItems = useCallback((items: NotificationDTO[]) => {
    // Initialize the seen-floor on the FIRST poll even when it returns zero
    // items — otherwise the first genuinely new notification would be
    // misclassified as pre-existing and never ping.
    if (!initializedRef.current) {
      lastSeenPingRef.current = readStoredFloor()
      initializedRef.current = true
    }

    if (items.length === 0) return

    const maxPing = maxPingFloor(items)

    // Genuinely new: newer than anything seen so far. Re-check the stored
    // floor so only the first tab to observe an item pings.
    const stored = readStoredFloor()
    const fresh = items.filter((i) => Date.parse(i.lastNotifiedAt) > Math.max(lastSeenPingRef.current, stored))

    // Advance the shared floor SYNCHRONOUSLY at decision time (not after the
    // awaited showNotification round-trip) so a concurrent poll in another
    // tab can't double-ping the same items.
    if (maxPing > Math.max(lastSeenPingRef.current, stored)) {
      writeStoredFloor(maxPing)
    }
    if (maxPing > lastSeenPingRef.current) {
      lastSeenPingRef.current = maxPing
    }

    if (fresh.length > 0 && isNotificationSupported() && Notification.permission === 'granted') {
      const newest = fresh.reduce((a, b) =>
        Date.parse(b.lastNotifiedAt) > Date.parse(a.lastNotifiedAt) ? b : a
      )
      showLocalNotification({
        id: newest.id,
        title: fresh.length === 1 ? newest.title : `${fresh.length} new notifications`,
        body: newest.message,
        url: `/invoices/${newest.invoiceId}`,
        tag: fresh.length === 1 ? newest.id : 'biller-digest',
      })
    }
  }, [])

  const stoppedRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' })

      if (response.status === 401) {
        // Session expired — kill the interval AND the event listeners; the
        // login page unmounts this hook anyway.
        setError('Session expired')
        stoppedRef.current = true
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
        }
        return
      }
      if (!response.ok) throw new Error(`Failed to load notifications (${response.status})`)

      const data: NotificationListResponse = await response.json()
      setNotifications(data.items)
      setUnreadCount(data.unreadCount)
      setError(null)
      processItems(data.items)
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications')
    } finally {
      setIsLoading(false)
    }
  }, [processItems])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let lastEventRefreshAt = 0

    refresh()

    const tick = () => {
      if (!document.hidden) refresh()
    }
    pollTimerRef.current = setInterval(tick, pollIntervalMs)

    // Tab switches fire 'focus' AND 'visibilitychange' back-to-back — debounce
    // so each refocus costs a single fetch.
    const onWake = () => {
      if (stoppedRef.current || document.hidden) return
      const now = Date.now()
      if (now - lastEventRefreshAt < 2000) return
      lastEventRefreshAt = now
      refresh()
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollIntervalMs])

  const markRead = useCallback(async (id: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-read', id }),
      })
      if (!response.ok) return
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      )
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch {
      // non-fatal
    }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      })
      if (!response.ok) return
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch {
      // non-fatal
    }
  }, [])

  /** Call synchronously from a user gesture (bell onClick) — iOS PWA requires it. */
  const ensurePermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    if (Notification.permission === 'default') {
      try {
        const result = await new Promise<NotificationPermission>((resolve) => {
          const request = Notification.requestPermission(resolve as unknown as (p: NotificationPermission) => void)
          // Modern browsers return a promise; legacy Safari uses the callback.
          if (request && typeof (request as unknown as Promise<NotificationPermission>).then === 'function') {
            ;(request as unknown as Promise<NotificationPermission>).then(resolve)
          }
        })
        setPermission(result)
        // Granted for the first time → register this device for web push so
        // toasts arrive even when the PWA is closed.
        if (result === 'granted') void subscribeToPush()
        return result
      } catch {
        return Notification.permission
      }
    }
    setPermission(Notification.permission)
    return Notification.permission
  }, [])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    permission,
    refresh,
    markRead,
    markAllRead,
    ensurePermission,
  }
}

function maxPingFloor(items: NotificationDTO[]): number {
  return items.reduce((max, i) => Math.max(max, Date.parse(i.lastNotifiedAt) || 0), 0)
}

// Storage access can throw (e.g. "Block all cookies" in Safari) — fall back
// to the in-memory per-tab floor, losing only cross-tab dedupe.
function readStoredFloor(): number {
  try {
    return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

function writeStoredFloor(value: number): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(value))
  } catch {
    // storage blocked: in-memory floor still prevents per-tab duplicates
  }
}
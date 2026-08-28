'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from 'flowbite-react'
import { FiAlertTriangle, FiBell, FiFileText } from 'react-icons/fi'
import { useNotifications } from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/notifications/format'
import type { NotificationDTO } from '@/lib/notifications/types'

export function NotificationBell() {
  const router = useRouter()
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    ensurePermission,
  } = useNotifications()

  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return

    const onMouseDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleBellClick = () => {
    // Must be synchronous within the gesture — iOS PWA requires it.
    ensurePermission()
    setOpen((prev) => !prev)
  }

  const handleItemClick = (notification: NotificationDTO) => {
    if (!notification.read) {
      markRead(notification.id)
    }
    setOpen(false)
    router.push(`/invoices/${notification.invoiceId}`)
  }

  const displayCount = unreadCount > 99 ? '99+' : unreadCount

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleBellClick}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      >
        <FiBell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <Badge color="failure" size="xs">
                  {displayCount} unread
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="min-h-[44px] rounded-lg px-3 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">You&rsquo;re all caught up.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const isOverdue = notification.type === 'invoice_overdue'
                  const Icon = isOverdue ? FiAlertTriangle : FiFileText
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(notification)}
                        className={`flex w-full min-h-[44px] items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                          notification.read ? '' : 'bg-blue-50/40'
                        }`}
                      >
                        <Icon
                          className={`mt-0.5 h-5 w-5 shrink-0 ${
                            isOverdue ? 'text-red-500' : 'text-blue-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            {!notification.read && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                            )}
                            <span
                              className={`truncate text-sm ${
                                notification.read
                                  ? 'font-medium text-gray-700'
                                  : 'font-semibold text-gray-900'
                              }`}
                            >
                              {notification.title}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">
                            {notification.message}
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                            <span className="whitespace-nowrap">
                              {formatRelativeTime(notification.lastNotifiedAt)}
                            </span>
                            {notification.notifyCount > 1 && (
                              <span className="whitespace-nowrap">
                                reminded {notification.notifyCount}×
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
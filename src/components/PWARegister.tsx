'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker in production builds only — registering in
 * dev would cache HMR/chunk requests and break hot reload.
 */
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('Service worker registration failed:', err))
    }

    if (document.readyState === 'complete') {
      register()
      return
    }

    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
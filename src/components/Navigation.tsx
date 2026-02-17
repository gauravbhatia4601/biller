'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from 'flowbite-react'
import { useState } from 'react'

export default function Navigation() {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/invoices', label: 'Invoices' },
    { href: '/clients', label: 'Clients' },
    { href: '/templates', label: 'Templates' },
    { href: '/settings/security', label: 'Security' },
  ]

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <Navbar fluid className="border-b border-gray-200 bg-white shadow-sm">
      <NavbarBrand as={Link} href="/dashboard">
        <span className="self-center whitespace-nowrap text-lg font-semibold text-gray-900">
          Biller
        </span>
      </NavbarBrand>
      <NavbarToggle />
      <NavbarCollapse>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <NavbarLink
              key={item.href}
              as={Link}
              href={item.href}
              active={isActive}
              className={isActive ? 'text-blue-600' : ''}
            >
              {item.label}
            </NavbarLink>
          )
        })}
        <button
          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
          onClick={handleLogout}
          disabled={loggingOut}
          type="button"
        >
          {loggingOut ? 'Signing out...' : 'Logout'}
        </button>
      </NavbarCollapse>
    </Navbar>
  )
}

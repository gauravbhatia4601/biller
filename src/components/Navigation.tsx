'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from 'flowbite-react'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/invoices', label: 'Invoices' },
    { href: '/clients', label: 'Clients' },
    { href: '/templates', label: 'Templates' },
  ]

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
      </NavbarCollapse>
    </Navbar>
  )
}

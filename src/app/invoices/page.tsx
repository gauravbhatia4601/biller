'use client'

import Navigation from '@/components/Navigation'
import InvoiceList from '@/components/InvoiceList'
import Link from 'next/link'
import { Button } from 'flowbite-react'
import { HiOutlinePlus } from 'react-icons/hi'

export default function InvoicesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          <Link href="/create">
            <Button size="xs" color="blue">
              <HiOutlinePlus className="h-4 w-4 mr-1" />
              New Invoice
            </Button>
          </Link>
        </div>
        <InvoiceList />
      </main>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import InvoiceForm from '@/components/InvoiceForm'

export default function CreatePage() {
  const router = useRouter()

  const handleSave = () => {
    router.push('/invoices')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Invoice</h2>
        <InvoiceForm onSave={handleSave} />
      </main>
    </div>
  )
}

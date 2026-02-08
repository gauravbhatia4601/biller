'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store'
import { fetchInvoice } from '@/store/slices/invoiceSlice'
import Navigation from '@/components/Navigation'
import InvoiceForm from '@/components/InvoiceForm'
import { Spinner } from 'flowbite-react'

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { currentInvoice, loading } = useSelector((state: RootState) => state.invoices)

  useEffect(() => {
    if (params.id) {
      dispatch(fetchInvoice(params.id as string))
    }
  }, [params.id, dispatch])

  const handleSave = () => {
    router.push('/invoices')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Invoice</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <InvoiceForm invoiceId={params.id as string} onSave={handleSave} />
        )}
      </main>
    </div>
  )
}

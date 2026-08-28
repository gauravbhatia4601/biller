'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { AppDispatch, RootState } from '@/store'
import { fetchTemplates, deleteTemplate, createInvoiceFromTemplate } from '@/store/slices/templateSlice'
import Navigation from '@/components/Navigation'
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Button, Spinner } from 'flowbite-react'
import { HiOutlineDocumentDuplicate, HiOutlineTrash } from 'react-icons/hi'

export default function TemplatesPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { templates, loading } = useSelector((state: RootState) => state.templates)
  const router = useRouter()
  const [creatingId, setCreatingId] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchTemplates())
  }, [dispatch])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await dispatch(deleteTemplate(id))
      dispatch(fetchTemplates())
    }
  }

  const handleUse = async (id: string) => {
    if (creatingId) return
    setCreatingId(id)
    try {
      // Fetch the next invoice number so the clone follows the INV-YYYY-NNN
      // sequence instead of the API's INV-<timestamp> fallback.
      let data: any = {}
      try {
        const res = await fetch('/api/invoices/next-number')
        if (res.ok) {
          const json = await res.json()
          if (json.invoiceNumber) data = { invoice: { number: json.invoiceNumber } }
        }
      } catch {}
      const invoice = await dispatch(createInvoiceFromTemplate({ id, data })).unwrap()
      router.push(`/invoices/${invoice._id}`)
    } catch (err) {
      console.error('Failed to create invoice from template:', err)
      alert('Failed to create invoice from template. Please try again.')
    } finally {
      setCreatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Templates</h2>
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No templates yet</h3>
            <p className="text-gray-500 text-sm">Save an invoice as a template to reuse it</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 sm:hidden">
            {templates.map((template) => (
              <div key={template._id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {template.templateName || 'Untitled Template'}
                  </p>
                  <p className="text-sm text-gray-900 truncate">{template.customer?.name}</p>
                  {template.customer?.company && (
                    <p className="text-xs text-gray-500 truncate">{template.customer.company}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(template.createdAt || '').toLocaleDateString()}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="xs"
                    color="blue"
                    title="Use Template"
                    className="py-2.5 px-4 text-sm"
                    disabled={creatingId === template._id}
                    onClick={() => handleUse(template._id!)}
                  >
                    <HiOutlineDocumentDuplicate className="h-4 w-4 mr-1" />
                    {creatingId === template._id ? 'Creating...' : 'Use'}
                  </Button>
                  <Button
                    size="xs"
                    color="failure"
                    onClick={() => handleDelete(template._id!)}
                    title="Delete"
                    className="p-2.5 ml-1"
                  >
                    <HiOutlineTrash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableHeadCell>Template Name</TableHeadCell>
                <TableHeadCell>Customer</TableHeadCell>
                <TableHeadCell>Created</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {templates.map((template) => (
                  <TableRow key={template._id} className="bg-white">
                    <TableCell className="font-medium text-gray-900">
                      {template.templateName || 'Untitled Template'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-gray-900">{template.customer?.name}</p>
                        {template.customer?.company && (
                          <p className="text-xs text-gray-500">{template.customer.company}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(template.createdAt || '').toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          color="blue"
                          title="Use Template"
                          disabled={creatingId === template._id}
                          onClick={() => handleUse(template._id!)}
                        >
                          <HiOutlineDocumentDuplicate className="h-4 w-4 mr-1" />
                          {creatingId === template._id ? 'Creating...' : 'Use'}
                        </Button>
                        <Button
                          size="xs"
                          color="failure"
                          onClick={() => handleDelete(template._id!)}
                          title="Delete"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </main>
    </div>
  )
}

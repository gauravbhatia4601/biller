'use client'

import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store'
import { fetchTemplates, deleteTemplate } from '@/store/slices/templateSlice'
import Navigation from '@/components/Navigation'
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Button, Spinner } from 'flowbite-react'
import { HiOutlineDocumentDuplicate, HiOutlineTrash } from 'react-icons/hi'

export default function TemplatesPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { templates, loading } = useSelector((state: RootState) => state.templates)

  useEffect(() => {
    dispatch(fetchTemplates())
  }, [dispatch])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await dispatch(deleteTemplate(id))
      dispatch(fetchTemplates())
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
          <div className="overflow-x-auto">
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
                      <div className="flex items-center gap-1">
                        <Button size="xs" color="blue" title="Use Template">
                          <HiOutlineDocumentDuplicate className="h-4 w-4 mr-1" />
                          Use
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
        )}
      </main>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store'
import { deleteInvoice, generatePDF, fetchInvoices, updateInvoiceStatus } from '@/store/slices/invoiceSlice'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Badge, Button, Spinner, Modal, ModalHeader, ModalBody, TextInput, Label } from 'flowbite-react'
import { HiOutlineDocumentDownload, HiOutlinePencil, HiOutlineTrash, HiOutlineEye } from 'react-icons/hi'

export default function InvoiceList() {
  const dispatch = useDispatch<AppDispatch>()
  const { invoices, loading } = useSelector((state: RootState) => state.invoices)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  useEffect(() => {
    dispatch(fetchInvoices())
  }, [dispatch])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      await dispatch(deleteInvoice(id))
      dispatch(fetchInvoices())
    }
  }

  const handleGeneratePDF = async (id: string) => {
    try {
      await dispatch(generatePDF(id))
      alert('PDF generated successfully!')
    } catch (error) {
      alert('Error generating PDF')
    }
  }

  const handleStatusClick = (invoice: any) => {
    const subtotal = invoice.items.reduce(
      (sum: number, item: any) => sum + (item.quantity * item.unit_cost), 0
    )
    setSelectedInvoice({ ...invoice, calculatedTotal: subtotal })
    setPaymentAmount(String(invoice.amountPaid || 0))
    setShowPaymentModal(true)
  }

  const handleStatusUpdate = async (newStatus: 'unpaid' | 'partial' | 'paid') => {
    if (!selectedInvoice) return

    const total = selectedInvoice.calculatedTotal
    const amount = newStatus === 'partial' ? parseFloat(paymentAmount) || 0
      : newStatus === 'paid' ? total
      : 0

    if (newStatus === 'partial' && (amount <= 0 || amount >= total)) {
      alert('Partial amount must be greater than 0 and less than the invoice total.')
      return
    }

    await dispatch(updateInvoiceStatus({ id: selectedInvoice._id, status: newStatus, amountPaid: amount }))
    setShowPaymentModal(false)
    setSelectedInvoice(null)
    dispatch(fetchInvoices())
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return { color: 'success' as const, label: 'Paid' }
      case 'partial': return { color: 'warning' as const, label: 'Partial' }
      default: return { color: 'failure' as const, label: 'Unpaid' }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No invoices yet</h3>
        <p className="text-gray-500 text-sm mb-4">Create your first invoice to get started</p>
        <Link href="/create">
          <Button size="sm" color="blue">Create Invoice</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableHeadCell>Invoice #</TableHeadCell>
            <TableHeadCell>Customer</TableHeadCell>
            <TableHeadCell>Date</TableHeadCell>
            <TableHeadCell>Amount</TableHeadCell>
            <TableHeadCell>Paid</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell>Actions</TableHeadCell>
          </TableHead>
          <TableBody className="divide-y">
            {invoices.map((invoice) => {
              const subtotal = invoice.items.reduce(
                (sum, item) => sum + (item.quantity * item.unit_cost),
                0
              )
              const badge = getStatusBadge(invoice.status || 'unpaid')
              return (
                <TableRow key={invoice._id} className="bg-white">
                  <TableCell className="font-medium text-gray-900">
                    {invoice.invoice.number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm text-gray-900">{invoice.customer.name}</p>
                      {invoice.customer.company && (
                        <p className="text-xs text-gray-500">{invoice.customer.company}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{invoice.invoice.date}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {invoice.invoice.currency} {subtotal.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {invoice.status === 'partial' ? (
                      <span className="text-amber-600 font-medium">
                        {invoice.invoice.currency} {(invoice.amountPaid || 0).toFixed(2)}
                      </span>
                    ) : invoice.status === 'paid' ? (
                      <span className="text-green-600 font-medium">
                        {invoice.invoice.currency} {subtotal.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button onClick={() => handleStatusClick(invoice)}>
                      <Badge color={badge.color} className="cursor-pointer">
                        {badge.label}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {invoice.pdfPath && (
                        <a
                          href={invoice.pdfPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View PDF"
                        >
                          <Button size="xs" color="light">
                            <HiOutlineEye className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Link href={`/invoices/${invoice._id}`}>
                        <Button size="xs" color="light" title="Edit">
                          <HiOutlinePencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        size="xs"
                        color="light"
                        onClick={() => handleGeneratePDF(invoice._id!)}
                        title="Generate PDF"
                      >
                        <HiOutlineDocumentDownload className="h-4 w-4" />
                      </Button>
                      <Button
                        size="xs"
                        color="failure"
                        onClick={() => handleDelete(invoice._id!)}
                        title="Delete"
                      >
                        <HiOutlineTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Payment Status Modal */}
      <Modal show={showPaymentModal} onClose={() => setShowPaymentModal(false)} size="md">
        <ModalHeader>Update Payment Status</ModalHeader>
        <ModalBody>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invoice:</span>
                <span className="font-medium">{selectedInvoice.invoice.number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total:</span>
                <span className="font-medium">
                  {selectedInvoice.invoice.currency} {selectedInvoice.calculatedTotal.toFixed(2)}
                </span>
              </div>
              {selectedInvoice.status === 'partial' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Already Paid:</span>
                  <span className="font-medium text-amber-600">
                    {selectedInvoice.invoice.currency} {(selectedInvoice.amountPaid || 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="paymentAmountList">Amount Paid</Label>
                </div>
                <TextInput
                  id="paymentAmountList"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="0"
                  max={selectedInvoice.calculatedTotal}
                  step="0.01"
                  placeholder="Enter amount paid"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  color="failure"
                  size="sm"
                  onClick={() => handleStatusUpdate('unpaid')}
                  className="flex-1"
                >
                  Unpaid
                </Button>
                <Button
                  color="warning"
                  size="sm"
                  onClick={() => handleStatusUpdate('partial')}
                  className="flex-1"
                >
                  Partial
                </Button>
                <Button
                  color="success"
                  size="sm"
                  onClick={() => handleStatusUpdate('paid')}
                  className="flex-1"
                >
                  Paid
                </Button>
              </div>
              <Button
                color="gray"
                size="sm"
                onClick={() => setShowPaymentModal(false)}
                className="w-full mt-2"
              >
                Cancel
              </Button>
            </div>
          )}
        </ModalBody>
      </Modal>
    </>
  )
}

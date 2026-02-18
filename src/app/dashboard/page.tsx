'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store'
import { fetchStats, updateInvoiceStatus } from '@/store/slices/invoiceSlice'
import Navigation from '@/components/Navigation'
import Link from 'next/link'
import { Card, Badge, Spinner, Modal, ModalHeader, ModalBody, Button, TextInput, Label } from 'flowbite-react'
import { HiOutlineDocumentText, HiOutlineTemplate, HiOutlineCurrencyDollar } from 'react-icons/hi'

export default function DashboardPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { stats, loading } = useSelector((state: RootState) => state.invoices)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  useEffect(() => {
    dispatch(fetchStats())
  }, [dispatch])

  const handleStatusClick = (invoice: any) => {
    setSelectedInvoice(invoice)
    setPaymentAmount(String(invoice.amountPaid || 0))
    setShowPaymentModal(true)
  }

  const handleStatusUpdate = async (newStatus: 'unpaid' | 'partial' | 'paid') => {
    if (!selectedInvoice) return

    const amount = newStatus === 'partial' ? parseFloat(paymentAmount) || 0
      : newStatus === 'paid' ? selectedInvoice.total
      : 0

    if (newStatus === 'partial' && (amount <= 0 || amount >= selectedInvoice.total)) {
      alert('Partial amount must be greater than 0 and less than the invoice total.')
      return
    }

    await dispatch(updateInvoiceStatus({ id: selectedInvoice._id, status: newStatus, amountPaid: amount }))
    setShowPaymentModal(false)
    setSelectedInvoice(null)
    dispatch(fetchStats())
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return { color: 'success' as const, label: 'Paid' }
      case 'partial': return { color: 'warning' as const, label: 'Partial' }
      default: return { color: 'failure' as const, label: 'Unpaid' }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dashboard</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="!p-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <HiOutlineDocumentText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Total Invoices</p>
                    <p className="text-xl font-bold text-gray-900">{stats?.totalInvoices || 0}</p>
                  </div>
                </div>
              </Card>
              <Card className="!p-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <HiOutlineTemplate className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Templates</p>
                    <p className="text-xl font-bold text-gray-900">{stats?.totalTemplates || 0}</p>
                  </div>
                </div>
              </Card>
              <Card className="!p-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <HiOutlineCurrencyDollar className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Unpaid</p>
                    <p className="text-xl font-bold text-red-500">
                      {stats?.totalUnpaidRevenue && stats.totalUnpaidRevenue > 0
                        ? `AED ${stats.totalUnpaidRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '0.00'}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="!p-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <HiOutlineCurrencyDollar className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Collected</p>
                    <p className="text-xl font-bold text-green-500">
                      {stats?.totalRevenue
                        ? `AED ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'AED 0.00'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Invoices */}
            <Card>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Recent Invoices</h3>
                <Link
                  href="/invoices"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All →
                </Link>
              </div>
              {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentInvoices.map((invoice: any) => {
                    const badge = getStatusBadge(invoice.status)
                    const isRecurringSource = Boolean(invoice.recurring?.enabled)
                    const isGeneratedFromRecurring =
                      Boolean(invoice.recurring?.sourceInvoiceId) && !isRecurringSource
                    return (
                      <div
                        key={invoice._id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/invoices/${invoice._id}`}
                              className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
                            >
                              {invoice.invoice.number}
                            </Link>
                            {isRecurringSource && (
                              <Badge color="info" className="text-[10px] leading-none">
                                Recurring
                              </Badge>
                            )}
                            {isGeneratedFromRecurring && (
                              <Badge color="purple" className="text-[10px] leading-none">
                                Generated
                              </Badge>
                            )}
                            {invoice.pdfPath && (
                              <a
                                href={invoice.pdfPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-green-600 hover:text-green-700"
                                title="View PDF"
                              >
                                📄
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {invoice.customer.name}
                            {invoice.customer.company && ` - ${invoice.customer.company}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {invoice.invoice.currency} {invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {isRecurringSource && (
                            <span className="text-xs text-blue-600 whitespace-nowrap">
                              Next: {invoice.recurring?.nextRunDate || '-'}
                            </span>
                          )}
                          {invoice.status === 'partial' && (
                            <span className="text-xs text-amber-600 whitespace-nowrap">
                              Paid: {invoice.invoice.currency} {(invoice.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                          <button onClick={() => handleStatusClick(invoice)}>
                            <Badge color={badge.color} className="cursor-pointer">
                              {badge.label}
                            </Badge>
                          </button>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(invoice.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 mb-3">No recent invoices</p>
                  <Link
                    href="/create"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first invoice →
                  </Link>
                </div>
              )}
            </Card>
          </>
        )}
      </main>

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
                  {selectedInvoice.invoice.currency} {selectedInvoice.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {selectedInvoice.status === 'partial' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Already Paid:</span>
                  <span className="font-medium text-amber-600">
                    {selectedInvoice.invoice.currency} {(selectedInvoice.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="paymentAmount">Amount Paid</Label>
                </div>
                <TextInput
                  id="paymentAmount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="0"
                  max={selectedInvoice.total}
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
    </div>
  )
}

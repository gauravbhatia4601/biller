'use client'

import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store'
import { createInvoice, updateInvoice, setCurrentInvoice } from '@/store/slices/invoiceSlice'
import { fetchClients } from '@/store/slices/clientSlice'
import { defaultCompany, defaultAccountDetails } from '@/lib/constants'
import { Card, TextInput, Textarea, Select, Button, Spinner } from 'flowbite-react'
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'

interface InvoiceFormProps {
  invoiceId?: string
  onSave?: () => void
}

export default function InvoiceForm({ invoiceId, onSave }: InvoiceFormProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { currentInvoice, loading } = useSelector((state: RootState) => state.invoices)
  const { clients } = useSelector((state: RootState) => state.clients)

  const [formData, setFormData] = useState({
    company: { ...defaultCompany },
    customer: {
      name: '',
      company: '',
      address: '',
      city: '',
      country: '',
      phone: '',
      email: '',
      vatId: '',
    },
    invoice: {
      number: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split('T')[0],
      currency: 'AED',
      paymentTerms: '',
      purchaseOrder: '',
    },
    items: [
      { name: '', description: '', quantity: 0, unit_cost: 0 },
    ],
    fields: {
      tax: '%',
      discounts: false,
      shipping: false,
    },
    financial: {
      tax: 0,
      shipping: 0,
      discounts: 0,
      amountPaid: 0,
    },
    accountDetails: { ...defaultAccountDetails },
    notes: '',
    terms: '',
    status: 'unpaid' as 'unpaid' | 'partial' | 'paid',
    recurring: {
      enabled: false,
      frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'every_n_days',
      intervalDays: 4,
      dueInDays: 14,
      autoGeneratePdf: true,
    },
  })

  useEffect(() => {
    dispatch(fetchClients())
  }, [dispatch])

  useEffect(() => {
    if (invoiceId && currentInvoice) {
      setFormData({
        company: {
          name: currentInvoice.company?.name || defaultCompany.name,
          tagline: currentInvoice.company?.tagline || defaultCompany.tagline,
          logo: currentInvoice.company?.logo || defaultCompany.logo,
          phone: currentInvoice.company?.phone || defaultCompany.phone,
          email: currentInvoice.company?.email || defaultCompany.email,
          address: currentInvoice.company?.address || defaultCompany.address,
          city: currentInvoice.company?.city || defaultCompany.city,
          country: currentInvoice.company?.country || defaultCompany.country,
          vatId: currentInvoice.company?.vatId || defaultCompany.vatId,
        },
        customer: {
          name: currentInvoice.customer?.name || '',
          company: currentInvoice.customer?.company || '',
          address: currentInvoice.customer?.address || '',
          city: currentInvoice.customer?.city || '',
          country: currentInvoice.customer?.country || '',
          phone: currentInvoice.customer?.phone || '',
          email: currentInvoice.customer?.email || '',
          vatId: currentInvoice.customer?.vatId || '',
        },
        invoice: {
          number: currentInvoice.invoice?.number || '',
          date: currentInvoice.invoice?.date || new Date().toISOString().split('T')[0],
          dueDate: currentInvoice.invoice?.dueDate || '',
          currency: currentInvoice.invoice?.currency || 'AED',
          paymentTerms: currentInvoice.invoice?.paymentTerms || '',
          purchaseOrder: currentInvoice.invoice?.purchaseOrder || '',
        },
        items: (currentInvoice.items || formData.items).map(item => ({
          name: item.name || '',
          description: item.description || '',
          quantity: item.quantity || 0,
          unit_cost: item.unit_cost || 0,
        })),
        fields: {
          tax: currentInvoice.fields?.tax || '%',
          discounts: currentInvoice.fields?.discounts || false,
          shipping: currentInvoice.fields?.shipping || false,
        },
        financial: {
          tax: currentInvoice.financial?.tax || 0,
          shipping: currentInvoice.financial?.shipping || 0,
          discounts: currentInvoice.financial?.discounts || 0,
          amountPaid: currentInvoice.financial?.amountPaid || 0,
        },
        accountDetails: {
          bankName: currentInvoice.accountDetails?.bankName || defaultAccountDetails.bankName,
          accountHolderName: currentInvoice.accountDetails?.accountHolderName || defaultAccountDetails.accountHolderName,
          accountNumber: currentInvoice.accountDetails?.accountNumber || defaultAccountDetails.accountNumber,
          iban: currentInvoice.accountDetails?.iban || defaultAccountDetails.iban,
          swiftBic: currentInvoice.accountDetails?.swiftBic || defaultAccountDetails.swiftBic,
          branchName: currentInvoice.accountDetails?.branchName || defaultAccountDetails.branchName,
          branchAddress: currentInvoice.accountDetails?.branchAddress || defaultAccountDetails.branchAddress,
        },
        notes: currentInvoice.notes || '',
        terms: currentInvoice.terms || '',
        status: currentInvoice.status || 'unpaid',
        recurring: {
          enabled: currentInvoice.recurring?.enabled || false,
          frequency: currentInvoice.recurring?.frequency || 'monthly',
          intervalDays: currentInvoice.recurring?.intervalDays || 4,
          dueInDays: currentInvoice.recurring?.dueInDays || 14,
          autoGeneratePdf: currentInvoice.recurring?.autoGeneratePdf !== false,
        },
      })
    } else if (!invoiceId) {
      const currentYear = new Date().getFullYear()
      const generateInvoiceNumber = async () => {
        try {
          const response = await fetch('/api/invoices/next-number')
          if (response.ok) {
            const data = await response.json()
            if (data.invoiceNumber) {
              setFormData((prev) => ({
                ...prev,
                invoice: { ...prev.invoice, number: data.invoiceNumber },
              }))
            }
          }
        } catch (error) {
          const fallbackNumber = `INV-${currentYear}-001`
          setFormData((prev) => ({
            ...prev,
            invoice: { ...prev.invoice, number: fallbackNumber },
          }))
        }
      }
      generateInvoiceNumber()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, currentInvoice])

  const handleChange = (section: string, field: string, value: any) => {
    setFormData((prev) => {
      const sectionData = prev[section as keyof typeof prev]
      if (typeof sectionData === 'object' && sectionData !== null && !Array.isArray(sectionData)) {
        return {
          ...prev,
          [section]: {
            ...(sectionData as Record<string, any>),
            [field]: value,
          },
        }
      }
      return prev
    })
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData((prev) => ({ ...prev, items: newItems }))
  }

  const handleClientSelect = (clientId: string) => {
    if (!clientId) return
    const selectedClient = clients.find((client) => client._id === clientId)
    if (selectedClient) {
      setFormData((prev) => ({
        ...prev,
        customer: {
          name: selectedClient.name || '',
          company: selectedClient.company || '',
          address: selectedClient.address || '',
          city: selectedClient.city || '',
          country: selectedClient.country || '',
          phone: selectedClient.phone || '',
          email: selectedClient.email || '',
          vatId: selectedClient.vatId || '',
        },
      }))
    }
  }

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { name: '', description: '', quantity: 0, unit_cost: 0 }],
    }))
  }

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const submitData = {
        ...formData,
        accountDetails: formData.accountDetails || {},
      }
      if (invoiceId) {
        await dispatch(updateInvoice({ id: invoiceId, data: submitData }))
      } else {
        await dispatch(createInvoice(submitData))
      }
      onSave?.()
    } catch (error) {
      console.error('Error saving invoice:', error)
    }
  }

  const calculateTotals = () => {
    const subtotal = formData.items.reduce(
      (sum, item) => sum + (item.quantity * item.unit_cost),
      0
    )
    let total = subtotal - formData.financial.discounts
    if (formData.fields.tax === '%' && formData.financial.tax > 0) {
      total += (total * formData.financial.tax / 100)
    } else {
      total += formData.financial.tax
    }
    if (formData.fields.shipping) {
      total += formData.financial.shipping
    }
    return { subtotal, total }
  }

  const { subtotal, total } = calculateTotals()

  const currencies = [
    { value: 'AED', label: 'AED - UAE Dirham' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'SAR', label: 'SAR - Saudi Riyal' },
    { value: 'INR', label: 'INR - Indian Rupee' },
    { value: 'PKR', label: 'PKR - Pakistani Rupee' },
    { value: 'BHD', label: 'BHD - Bahraini Dinar' },
    { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
    { value: 'OMR', label: 'OMR - Omani Rial' },
    { value: 'QAR', label: 'QAR - Qatari Riyal' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Company Information */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(formData.company).map(([key, value]) => (
            <div key={key}>
              <label htmlFor={`company-${key}`} className="block mb-1 text-xs font-medium text-gray-700">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              <TextInput
                id={`company-${key}`}
                type="text"
                sizing="sm"
                value={value as string}
                onChange={(e) => handleChange('company', key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Customer Information */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Information</h3>
        <div className="mb-3">
          <label htmlFor="client-select" className="block mb-1 text-xs font-medium text-gray-700">
            Select Existing Client
          </label>
          <Select
            id="client-select"
            sizing="sm"
            onChange={(e) => handleClientSelect(e.target.value)}
            value=""
          >
            <option value="">-- Select Client --</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>
                {client.name} {client.company ? ` - ${client.company}` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(formData.customer).map(([key, value]) => (
            <div key={key}>
              <label htmlFor={`customer-${key}`} className="block mb-1 text-xs font-medium text-gray-700">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              <TextInput
                id={`customer-${key}`}
                type="text"
                sizing="sm"
                value={value as string}
                onChange={(e) => handleChange('customer', key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Invoice Details */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Invoice Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(formData.invoice).map(([key, value]) => (
            <div key={key}>
              <label htmlFor={`invoice-${key}`} className="block mb-1 text-xs font-medium text-gray-700">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              {key === 'currency' ? (
                <Select
                  id={`invoice-${key}`}
                  sizing="sm"
                  value={value as string}
                  onChange={(e) => handleChange('invoice', key, e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  id={`invoice-${key}`}
                  type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                  sizing="sm"
                  value={value as string}
                  onChange={(e) => handleChange('invoice', key, e.target.value)}
                  required={key === 'number' || key === 'date'}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Recurring Schedule */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recurring (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="recurring-enabled" className="block mb-1 text-xs font-medium text-gray-700">
              Enable Recurring
            </label>
            <Select
              id="recurring-enabled"
              sizing="sm"
              value={formData.recurring.enabled ? 'true' : 'false'}
              onChange={(e) => handleChange('recurring', 'enabled', e.target.value === 'true')}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </Select>
          </div>
          <div>
            <label htmlFor="recurring-frequency" className="block mb-1 text-xs font-medium text-gray-700">
              Frequency
            </label>
            <Select
              id="recurring-frequency"
              sizing="sm"
              value={formData.recurring.frequency}
              disabled={!formData.recurring.enabled}
              onChange={(e) =>
                handleChange(
                  'recurring',
                  'frequency',
                  e.target.value as 'daily' | 'weekly' | 'monthly' | 'every_n_days'
                )
              }
            >
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
              <option value="every_n_days">Every N days</option>
            </Select>
          </div>
          <div>
            <label htmlFor="recurring-intervalDays" className="block mb-1 text-xs font-medium text-gray-700">
              Every N Days
            </label>
            <TextInput
              id="recurring-intervalDays"
              sizing="sm"
              type="number"
              min={1}
              value={formData.recurring.intervalDays}
              disabled={!formData.recurring.enabled || formData.recurring.frequency !== 'every_n_days'}
              onChange={(e) => handleChange('recurring', 'intervalDays', Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div>
            <label htmlFor="recurring-dueInDays" className="block mb-1 text-xs font-medium text-gray-700">
              Due In (Days)
            </label>
            <TextInput
              id="recurring-dueInDays"
              sizing="sm"
              type="number"
              min={0}
              value={formData.recurring.dueInDays}
              disabled={!formData.recurring.enabled}
              onChange={(e) => handleChange('recurring', 'dueInDays', Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="recurring-autoPdf" className="block mb-1 text-xs font-medium text-gray-700">
              Auto Generate PDF
            </label>
            <Select
              id="recurring-autoPdf"
              sizing="sm"
              value={formData.recurring.autoGeneratePdf ? 'true' : 'false'}
              disabled={!formData.recurring.enabled}
              onChange={(e) => handleChange('recurring', 'autoGeneratePdf', e.target.value === 'true')}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Items */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Items</h3>
        <div className="space-y-3">
          {formData.items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-3">
                {index === 0 && <label className="block mb-1 text-xs font-medium text-gray-700">Item Name</label>}
                <TextInput
                  sizing="sm"
                  placeholder="Item Name"
                  value={item.name}
                  onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-4">
                {index === 0 && <label className="block mb-1 text-xs font-medium text-gray-700">Description</label>}
                <Textarea
                  rows={2}
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  className="text-sm p-2"
                  style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                />
              </div>
              <div className="col-span-2">
                {index === 0 && <label className="block mb-1 text-xs font-medium text-gray-700">Qty</label>}
                <TextInput
                  sizing="sm"
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                  required
                />
              </div>
              <div className="col-span-2">
                {index === 0 && <label className="block mb-1 text-xs font-medium text-gray-700">Unit Cost</label>}
                <TextInput
                  sizing="sm"
                  type="number"
                  placeholder="Unit Cost"
                  value={item.unit_cost}
                  onChange={(e) => handleItemChange(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                  required
                />
              </div>
              <div className="col-span-1 flex items-end gap-1">
                {index === 0 && <label className="block mb-1 text-xs font-medium text-gray-700 invisible">&nbsp;</label>}
                <div className="flex items-center gap-1 h-[34px]">
                  <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                    {(item.quantity * item.unit_cost).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700"
                    title="Remove item"
                  >
                    <HiOutlineTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button size="xs" color="light" onClick={addItem} className="mt-3">
          <HiOutlinePlus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </Card>

      {/* Financial */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Financial Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="tax" className="block mb-1 text-xs font-medium text-gray-700">Tax %</label>
            <TextInput
              id="tax"
              sizing="sm"
              type="number"
              value={formData.financial.tax}
              onChange={(e) => handleChange('financial', 'tax', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label htmlFor="shipping" className="block mb-1 text-xs font-medium text-gray-700">Shipping</label>
            <TextInput
              id="shipping"
              sizing="sm"
              type="number"
              value={formData.financial.shipping}
              onChange={(e) => handleChange('financial', 'shipping', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label htmlFor="discount" className="block mb-1 text-xs font-medium text-gray-700">Discount</label>
            <TextInput
              id="discount"
              sizing="sm"
              type="number"
              value={formData.financial.discounts}
              onChange={(e) => handleChange('financial', 'discounts', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal:</span>
            <span>{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-gray-900 mt-1">
            <span>Total:</span>
            <span>{total.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Account Details */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="bankName" className="block mb-1 text-xs font-medium text-gray-700">Bank Name</label>
            <TextInput
              id="bankName"
              sizing="sm"
              value={formData.accountDetails.bankName}
              onChange={(e) => handleChange('accountDetails', 'bankName', e.target.value)}
              placeholder="Bank Name"
            />
          </div>
          <div>
            <label htmlFor="accountHolderName" className="block mb-1 text-xs font-medium text-gray-700">Account Holder Name</label>
            <TextInput
              id="accountHolderName"
              sizing="sm"
              value={formData.accountDetails.accountHolderName}
              onChange={(e) => handleChange('accountDetails', 'accountHolderName', e.target.value)}
              placeholder="Account Holder Name"
            />
          </div>
          <div>
            <label htmlFor="accountNumber" className="block mb-1 text-xs font-medium text-gray-700">Account Number</label>
            <TextInput
              id="accountNumber"
              sizing="sm"
              value={formData.accountDetails.accountNumber}
              onChange={(e) => handleChange('accountDetails', 'accountNumber', e.target.value)}
              placeholder="Account Number"
            />
          </div>
          <div>
            <label htmlFor="iban" className="block mb-1 text-xs font-medium text-gray-700">IBAN</label>
            <TextInput
              id="iban"
              sizing="sm"
              value={formData.accountDetails.iban}
              onChange={(e) => handleChange('accountDetails', 'iban', e.target.value)}
              placeholder="IBAN"
            />
          </div>
          <div>
            <label htmlFor="swiftBic" className="block mb-1 text-xs font-medium text-gray-700">SWIFT/BIC Code</label>
            <TextInput
              id="swiftBic"
              sizing="sm"
              value={formData.accountDetails.swiftBic}
              onChange={(e) => handleChange('accountDetails', 'swiftBic', e.target.value)}
              placeholder="SWIFT/BIC Code"
            />
          </div>
          <div>
            <label htmlFor="branchName" className="block mb-1 text-xs font-medium text-gray-700">Branch Name</label>
            <TextInput
              id="branchName"
              sizing="sm"
              value={formData.accountDetails.branchName}
              onChange={(e) => handleChange('accountDetails', 'branchName', e.target.value)}
              placeholder="Branch Name"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="branchAddress" className="block mb-1 text-xs font-medium text-gray-700">Branch Address</label>
            <TextInput
              id="branchAddress"
              sizing="sm"
              value={formData.accountDetails.branchAddress}
              onChange={(e) => handleChange('accountDetails', 'branchAddress', e.target.value)}
              placeholder="Branch Address"
            />
          </div>
        </div>
      </Card>

      {/* Notes & Terms */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Notes & Terms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="notes" className="block mb-1 text-xs font-medium text-gray-700">Notes</label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="text-sm"
            />
          </div>
          <div>
            <label htmlFor="terms" className="block mb-1 text-xs font-medium text-gray-700">Terms</label>
            <Textarea
              id="terms"
              rows={3}
              value={formData.terms}
              onChange={(e) => setFormData((prev) => ({ ...prev, terms: e.target.value }))}
              className="text-sm"
            />
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="sm" color="blue" disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            invoiceId ? 'Update Invoice' : 'Save Invoice'
          )}
        </Button>
      </div>
    </form>
  )
}

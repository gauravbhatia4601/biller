import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'
import { config } from '@/config/config'
import { getNextInvoiceNumber } from '@/lib/invoice-number'
import { normalizeRecurringConfig, processRecurringInvoices } from '@/lib/recurring-invoices'

// GET /api/invoices - Get all invoices
export async function GET() {
  try {
    await connectDB()
    await processRecurringInvoices()
    const invoices = await Invoice.find().sort({ createdAt: -1 })
    return NextResponse.json(invoices)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/invoices - Create new invoice
export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    
    // Generate invoice number if not provided
    let invoiceNumber = body.invoice?.number
    if (!invoiceNumber || invoiceNumber.trim() === '') {
      invoiceNumber = await getNextInvoiceNumber()
    }
    
    // Merge with default company data
    const invoiceData: any = {
      ...body,
      company: {
        ...config.company,
        ...(body.company || {}),
      },
      invoice: {
        ...body.invoice,
        number: invoiceNumber,
      },
      status: body.status || 'unpaid',
      recurring: normalizeRecurringConfig(
        body.recurring || {},
        body.invoice?.date,
        body.invoice?.dueDate
      ),
    }
    
    // Merge with default account details if not provided
    if (!body.accountDetails || Object.values(body.accountDetails).every(v => !v || v === '')) {
      const { defaultAccountDetails } = await import('@/lib/constants')
      invoiceData.accountDetails = { ...defaultAccountDetails, ...(body.accountDetails || {}) }
    } else {
      invoiceData.accountDetails = body.accountDetails
    }
    
    // Check if invoice number already exists
    const existing = await Invoice.findOne({ 'invoice.number': invoiceNumber })
    if (existing) {
      return NextResponse.json({ error: 'Invoice number already exists' }, { status: 400 })
    }
    
    const invoice = new Invoice(invoiceData)
    await invoice.save()
    return NextResponse.json(invoice, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

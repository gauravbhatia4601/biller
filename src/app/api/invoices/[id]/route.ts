import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'
import { config } from '@/config/config'
import { normalizeRecurringConfig } from '@/lib/recurring-invoices'

// GET /api/invoices/[id] - Get single invoice
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const invoice = await Invoice.findById(params.id)
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    
    return NextResponse.json(invoice)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/invoices/[id] - Update invoice
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const body = await request.json()
    
    // Merge with default company data
    const invoiceData: any = {
      ...body,
      company: {
        ...config.company,
        ...(body.company || {}),
      },
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
    
    const invoice = await Invoice.findByIdAndUpdate(
      params.id,
      invoiceData,
      { new: true, runValidators: true }
    )
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    
    return NextResponse.json(invoice)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/invoices/[id] - Delete invoice
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const invoice = await Invoice.findByIdAndDelete(params.id)
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    
    return NextResponse.json({ message: 'Invoice deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

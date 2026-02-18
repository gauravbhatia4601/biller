import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const { status, amountPaid } = await request.json()
    
    if (!status || !['unpaid', 'partial', 'paid'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const existingInvoice: any = await Invoice.findById(params.id).select('recurring')
    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const updateData: any = { status }

    if (status === 'partial') {
      if (amountPaid === undefined || amountPaid === null || amountPaid < 0) {
        return NextResponse.json({ error: 'amountPaid is required for partial status and must be >= 0' }, { status: 400 })
      }
      updateData.amountPaid = amountPaid
    } else if (status === 'paid') {
      // For fully paid, amountPaid = invoice total (will be set by the caller or we leave it)
      if (amountPaid !== undefined) {
        updateData.amountPaid = amountPaid
      }
    } else {
      // unpaid
      updateData.amountPaid = 0
    }

    // Generated invoices (children of recurring templates) must stay non-recurring.
    if (existingInvoice?.recurring?.sourceInvoiceId) {
      updateData['recurring.enabled'] = false
    }

    const invoice = await Invoice.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true }
    )

    return NextResponse.json({ success: true, status: invoice.status, amountPaid: invoice.amountPaid })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

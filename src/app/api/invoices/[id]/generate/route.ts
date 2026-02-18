import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { generatePdfForInvoice } from '@/lib/invoice-pdf'
import { connectDB } from '@/lib/db'

// POST /api/invoices/[id]/generate - Generate PDF
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const invoice = await Invoice.findById(params.id)
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    
    const result = await generatePdfForInvoice(invoice)
    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 500 })
    }

    invoice.pdfPath = result.pdfPath
    await invoice.save()
    
    // Return PDF URL
    return NextResponse.json({
      message: 'Invoice generated successfully',
      pdfUrl: invoice.pdfPath,
      invoice: invoice,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

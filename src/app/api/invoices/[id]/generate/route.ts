import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import InvoiceGenerator from '@/services/invoiceGenerator'
import { InvoiceBuilder } from '@/services/invoiceBuilder'
import { connectDB } from '@/lib/db'
import path from 'path'
import fs from 'fs'

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
    
    const apiKey = process.env.INVOICE_GENERATOR_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }
    
    const generator = new InvoiceGenerator(apiKey)
    const builder = new InvoiceBuilder(generator)
    
    // Convert invoice to invoice data format
    const invoiceData = invoice.toObject()
    
    // Generate PDF
    const invoiceFileName = `invoice_${invoice.invoice.number.replace(/\s+/g, '_')}.pdf`
    const invoiceDir = path.join(process.cwd(), 'public', 'invoices')
    
    // Ensure directory exists
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true })
    }
    
    const outputPath = path.resolve(invoiceDir, invoiceFileName)
    
    await builder.generateInvoice(invoiceData, outputPath)
    
    // Update invoice with PDF path
    invoice.pdfPath = `/invoices/${path.basename(outputPath)}`
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

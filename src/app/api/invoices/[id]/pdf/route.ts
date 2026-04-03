import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'

// GET /api/invoices/[id]/pdf - Serve the invoice PDF file
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const invoice = await Invoice.findById(params.id)

    if (!invoice || !invoice.pdfPath) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    // pdfPath can be /invoices/xxx.pdf (legacy) or /pdf/invoices/xxx.pdf (new)
    const filename = path.basename(invoice.pdfPath)
    const legacyPath = path.join(process.cwd(), 'public', 'invoices', filename)
    const newPath = path.join(process.cwd(), 'public', 'pdf', 'invoices', filename)

    const filePath = fs.existsSync(newPath) ? newPath : legacyPath

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

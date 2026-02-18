import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getNextInvoiceNumber } from '@/lib/invoice-number'

// GET /api/invoices/next-number - Get next available invoice number
export async function GET() {
  try {
    await connectDB()
    const invoiceNumber = await getNextInvoiceNumber()
    return NextResponse.json({ invoiceNumber })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

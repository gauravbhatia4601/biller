import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'

// GET /api/invoices/next-number - Get next available invoice number
export async function GET() {
  try {
    await connectDB()
    const currentYear = new Date().getFullYear()
    const yearPrefix = `INV-${currentYear}-`
    
    // Find the highest invoice number for this year
    const lastInvoice = await Invoice.findOne({
      'invoice.number': { $regex: `^${yearPrefix}` }
    })
    .sort({ 'invoice.number': -1 })
    .select('invoice.number')
    
    let nextNumber = 1
    if (lastInvoice && lastInvoice.invoice?.number) {
      // Extract the number part (e.g., "INV-2026-003" -> 3)
      const match = lastInvoice.invoice.number.match(/-(\d+)$/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    
    const invoiceNumber = `${yearPrefix}${nextNumber.toString().padStart(3, '0')}`
    return NextResponse.json({ invoiceNumber })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

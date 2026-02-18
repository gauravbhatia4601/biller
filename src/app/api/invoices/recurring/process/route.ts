import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { processRecurringInvoices } from '@/lib/recurring-invoices'

// POST /api/invoices/recurring/process - Trigger recurring invoice generation manually (cron-friendly).
export async function POST() {
  try {
    await connectDB()
    await processRecurringInvoices()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Recurring processing failed' }, { status: 500 })
  }
}


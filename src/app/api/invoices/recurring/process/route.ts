import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { processRecurringInvoices } from '@/lib/recurring-invoices'

// POST /api/invoices/recurring/process - Trigger recurring invoice generation manually (cron-friendly).
export async function POST(request: Request) {
  try {
    const secret = process.env.RECURRING_CRON_SECRET
    const providedSecret = request.headers.get('x-recurring-cron-secret')
    if (!secret) {
      return NextResponse.json({ error: 'Recurring cron secret is not configured' }, { status: 500 })
    }
    if (!providedSecret || providedSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    await processRecurringInvoices()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Recurring processing failed' }, { status: 500 })
  }
}


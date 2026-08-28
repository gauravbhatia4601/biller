import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'
import { processRecurringInvoices } from '@/lib/recurring-invoices'
import { computeInvoiceTotals } from '@/lib/invoice-totals'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    await connectDB()
    await processRecurringInvoices()

    const [totalInvoices, totalTemplates] = await Promise.all([
      Invoice.countDocuments({ isTemplate: false }),
      Invoice.countDocuments({ isTemplate: true }),
    ])

    const allInvoices = await Invoice.find({ isTemplate: false })
      .select('items fields financial status amountPaid')
      .lean()

    let totalRevenue = 0
    let totalUnpaidRevenue = 0
    let totalPartialRevenue = 0

    for (const invoice of allInvoices as any[]) {
      const { total } = computeInvoiceTotals(invoice)
      const paid = Number(invoice.amountPaid) || 0

      if (invoice.status === 'paid') {
        totalRevenue += total
      } else if (invoice.status === 'partial') {
        totalPartialRevenue += paid
        // Clamp so an over-recorded payment can't make the business look "owed" negative money.
        totalUnpaidRevenue += Math.max(0, total - paid)
      } else {
        totalUnpaidRevenue += total
      }
    }

    const recentInvoices = await Invoice.find({ isTemplate: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        'invoice.number invoice.date invoice.currency customer.name customer.company items fields financial createdAt pdfPath status amountPaid recurring.enabled recurring.nextRunDate recurring.sourceInvoiceId'
      )
      .lean()

    const formattedInvoices = recentInvoices.map((invoice: any) => {
      const { subtotal, total } = computeInvoiceTotals(invoice)

      return {
        _id: invoice._id,
        invoice: {
          number: invoice.invoice?.number || '',
          date: invoice.invoice?.date || '',
          currency: invoice.invoice?.currency || 'USD',
        },
        customer: {
          name: invoice.customer?.name || '',
          company: invoice.customer?.company || '',
        },
        total,
        subtotal,
        pdfPath: invoice.pdfPath,
        status: invoice.status || 'unpaid',
        amountPaid: Number(invoice.amountPaid) || 0,
        recurring: {
          enabled: Boolean(invoice?.recurring?.enabled),
          nextRunDate: invoice?.recurring?.nextRunDate || '',
          sourceInvoiceId: invoice?.recurring?.sourceInvoiceId || null,
        },
        createdAt: invoice.createdAt,
      }
    })

    return NextResponse.json(
      {
        totalInvoices,
        totalTemplates,
        totalRevenue: Math.round((totalRevenue + totalPartialRevenue) * 100) / 100,
        totalUnpaidRevenue: Math.round(totalUnpaidRevenue * 100) / 100,
        recentInvoices: formattedInvoices,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    )
  } catch (error) {
    console.error('Failed to load invoice stats:', error)
    return NextResponse.json(
      { error: 'Failed to load invoice stats' },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    )
  }
}
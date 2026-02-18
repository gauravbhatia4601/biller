import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'
import { processRecurringInvoices } from '@/lib/recurring-invoices'

// GET /api/invoices/stats/summary - Get invoice statistics
export async function GET() {
  try {
    await connectDB()
    await processRecurringInvoices()
    
    const totalInvoices = await Invoice.countDocuments({ isTemplate: false })
    const totalTemplates = await Invoice.countDocuments({ isTemplate: true })
    
    // Calculate total revenue from all invoices
    const allInvoices = await Invoice.find({ isTemplate: false })
      .select('items financial status amountPaid')
    
    let totalRevenue = 0
    let totalUnpaidRevenue = 0
    let totalPartialRevenue = 0
    allInvoices.forEach((invoice: any) => {
      const subtotal = invoice.items.reduce(
        (sum: number, item: any) => sum + (item.quantity * item.unit_cost),
        0
      )
      const tax = invoice.financial?.tax || 0
      const shipping = invoice.financial?.shipping || 0
      const discounts = invoice.financial?.discounts || 0
      const total = subtotal + tax + shipping - discounts
      
      if (invoice.status === 'paid') {
        totalRevenue += total
      } else if (invoice.status === 'partial') {
        const paid = invoice.amountPaid || 0
        totalPartialRevenue += paid
        totalUnpaidRevenue += (total - paid)
      } else {
        totalUnpaidRevenue += total
      }
    })
    
    // Get recent invoices with more details
    const recentInvoices = await Invoice.find({ isTemplate: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        'invoice.number invoice.date invoice.currency customer.name customer.company items financial createdAt pdfPath status amountPaid recurring.enabled recurring.nextRunDate recurring.sourceInvoiceId'
      )
    
    // Format recent invoices with calculated totals
    const formattedInvoices = recentInvoices.map((invoice: any) => {
      const subtotal = invoice.items.reduce(
        (sum: number, item: any) => sum + (item.quantity * item.unit_cost),
        0
      )
      const tax = invoice.financial?.tax || 0
      const shipping = invoice.financial?.shipping || 0
      const discounts = invoice.financial?.discounts || 0
      const total = subtotal + tax + shipping - discounts
      
      return {
        _id: invoice._id,
        invoice: {
          number: invoice.invoice.number,
          date: invoice.invoice.date,
          currency: invoice.invoice.currency || 'USD',
        },
        customer: {
          name: invoice.customer.name,
          company: invoice.customer.company,
        },
        total,
        subtotal,
        pdfPath: invoice.pdfPath,
        status: invoice.status || 'unpaid',
        amountPaid: invoice.amountPaid || 0,
        recurring: {
          enabled: Boolean(invoice?.recurring?.enabled),
          nextRunDate: invoice?.recurring?.nextRunDate || '',
          sourceInvoiceId: invoice?.recurring?.sourceInvoiceId || null,
        },
        createdAt: invoice.createdAt,
      }
    })
    
    return NextResponse.json({
      totalInvoices,
      totalTemplates,
      totalRevenue: Math.round((totalRevenue + totalPartialRevenue) * 100) / 100,
      totalUnpaidRevenue: Math.round(totalUnpaidRevenue * 100) / 100,
      recentInvoices: formattedInvoices,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import fs from 'fs'
import path from 'path'
import InvoiceGenerator from '@/services/invoiceGenerator'
import { InvoiceBuilder } from '@/services/invoiceBuilder'

export async function generatePdfForInvoice(invoiceDoc: any) {
  const apiKey = process.env.INVOICE_GENERATOR_API_KEY
  if (!apiKey) {
    return { success: false, reason: 'API key not configured' as const }
  }

  const generator = new InvoiceGenerator(apiKey)
  const builder = new InvoiceBuilder(generator)
  const invoiceData = invoiceDoc.toObject ? invoiceDoc.toObject() : invoiceDoc

  const invoiceFileName = `invoice_${invoiceData.invoice.number.replace(/\s+/g, '_')}.pdf`
  const invoiceDir = path.join(process.cwd(), 'public', 'invoices')
  if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir, { recursive: true })
  }

  const outputPath = path.resolve(invoiceDir, invoiceFileName)
  await builder.generateInvoice(invoiceData, outputPath)
  return { success: true, pdfPath: `/invoices/${path.basename(outputPath)}` }
}


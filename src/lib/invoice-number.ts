import Invoice from '@/models/Invoice'

export async function getNextInvoiceNumber() {
  const currentYear = new Date().getFullYear()
  const yearPrefix = `INV-${currentYear}-`

  const lastInvoice = await Invoice.findOne({
    'invoice.number': { $regex: `^${yearPrefix}` },
  })
    .sort({ 'invoice.number': -1 })
    .select('invoice.number')

  let nextNumber = 1
  if (lastInvoice && lastInvoice.invoice?.number) {
    const match = lastInvoice.invoice.number.match(/-(\d+)$/)
    if (match) nextNumber = parseInt(match[1], 10) + 1
  }

  return `${yearPrefix}${nextNumber.toString().padStart(3, '0')}`
}


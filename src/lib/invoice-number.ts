import Invoice from '@/models/Invoice'

export async function getNextInvoiceNumber() {
  // Use the UTC year so numbering stays consistent with the recurring
  // invoice engine, which generates dates in UTC.
  const currentYear = new Date().getUTCFullYear()
  const yearPrefix = `INV-${currentYear}-`

  // Fetch every number for the year and take the max numeric suffix.
  // A lexicographic string sort would order 'INV-2026-999' above
  // 'INV-2026-1000' and stall the sequence at the 999 -> 1000 boundary.
  const numbers: string[] = await Invoice.find({
    'invoice.number': { $regex: `^${yearPrefix}` },
  }).distinct('invoice.number')

  let maxSequence = 0
  for (const number of numbers) {
    if (typeof number !== 'string') continue
    const match = number.match(/-(\d+)$/)
    if (match) {
      maxSequence = Math.max(maxSequence, parseInt(match[1], 10))
    }
  }

  return `${yearPrefix}${(maxSequence + 1).toString().padStart(3, '0')}`
}
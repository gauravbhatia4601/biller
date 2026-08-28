// Single source of truth for invoice subtotal/total math.
// Used by the Invoice model virtuals, the stats API, and anywhere else
// totals must be derived from raw invoice data (lean docs, form drafts).

export function computeInvoiceTotals(invoice: any): { subtotal: number; total: number } {
  const items = Array.isArray(invoice?.items) ? invoice.items : []

  const subtotal = items.reduce((sum: number, item: any) => {
    const quantity = Number(item?.quantity) || 0
    const unitCost = Number(item?.unit_cost) || 0
    return sum + quantity * unitCost
  }, 0)

  const fields = invoice?.fields || {}
  const financial = invoice?.financial || {}
  const tax = Number(financial.tax) || 0
  const shipping = Number(financial.shipping) || 0
  const discounts = Number(financial.discounts) || 0

  let total = subtotal

  // Apply discount (only when the discounts field is enabled on the invoice)
  if (fields.discounts && discounts) {
    total -= discounts
  }

  // Apply tax — as a percentage when fields.tax is '%', otherwise flat
  if (fields.tax === '%' && tax > 0) {
    total += (total * tax) / 100
  } else if (tax > 0) {
    total += tax
  }

  // Apply shipping (only when the shipping field is enabled on the invoice)
  if (fields.shipping && shipping) {
    total += shipping
  }

  return { subtotal, total }
}
import Invoice from '@/models/Invoice'
import { generatePdfForInvoice } from '@/lib/invoice-pdf'
import { getNextInvoiceNumber } from '@/lib/invoice-number'

type RecurringConfig = {
  enabled?: boolean
  frequency?: 'daily' | 'weekly' | 'monthly' | 'every_n_days'
  intervalDays?: number
  dueInDays?: number
  nextRunDate?: string
  autoGeneratePdf?: boolean
}

let processingPromise: Promise<void> | null = null

const parseDateString = (value?: string) => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const formatDateString = (value: Date) => value.toISOString().slice(0, 10)

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const addMonthsClamped = (date: Date, months: number) => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()

  const targetMonthDate = new Date(Date.UTC(year, month + months, 1))
  const endOfMonth = new Date(
    Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth() + 1, 0)
  ).getUTCDate()
  targetMonthDate.setUTCDate(Math.min(day, endOfMonth))
  return targetMonthDate
}

const nextRunByFrequency = (date: Date, recurring: RecurringConfig) => {
  switch (recurring.frequency) {
    case 'daily':
      return addDays(date, 1)
    case 'weekly':
      return addDays(date, 7)
    case 'every_n_days':
      return addDays(date, Math.max(1, recurring.intervalDays || 1))
    case 'monthly':
    default:
      return addMonthsClamped(date, 1)
  }
}

const computeFirstNextRunDate = (invoiceDate: string, recurring: RecurringConfig) => {
  const base = parseDateString(invoiceDate)
  if (!base) return null
  return nextRunByFrequency(base, recurring)
}

async function cloneRecurringInvoice(sourceInvoice: any, runDate: Date, dueInDays: number) {
  const invoiceObject = sourceInvoice.toObject()
  const nextNumber = await getNextInvoiceNumber()
  const issueDate = formatDateString(runDate)
  const dueDate = formatDateString(addDays(runDate, Math.max(0, dueInDays)))

  const payload = {
    ...invoiceObject,
    _id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    __v: undefined,
    invoice: {
      ...invoiceObject.invoice,
      number: nextNumber,
      date: issueDate,
      dueDate,
    },
    status: 'unpaid',
    amountPaid: 0,
    financial: {
      ...invoiceObject.financial,
      amountPaid: 0,
    },
    pdfPath: '',
    recurring: {
      enabled: false,
      sourceInvoiceId: sourceInvoice._id,
      autoGeneratePdf: true,
    },
  }

  const invoice = new Invoice(payload)
  await invoice.save()
  return invoice
}

async function processInternal() {
  const now = new Date()
  const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const recurringInvoices = await Invoice.find({
    isTemplate: false,
    'recurring.enabled': true,
  })

  for (const sourceInvoice of recurringInvoices) {
    const recurring = (sourceInvoice.recurring || {}) as RecurringConfig
    const dueInDays = Math.max(0, recurring.dueInDays ?? 14)

    let nextRun = parseDateString(recurring.nextRunDate)
    if (!nextRun) {
      nextRun = computeFirstNextRunDate(sourceInvoice.invoice?.date, recurring)
      if (!nextRun) continue
    }

    let generatedCount = 0
    // Backfill missed runs, but keep a strict cap for safety.
    while (nextRun && nextRun.getTime() <= todayDate.getTime() && generatedCount < 24) {
      const createdInvoice = await cloneRecurringInvoice(sourceInvoice, nextRun, dueInDays)
      if (recurring.autoGeneratePdf !== false) {
        try {
          const pdfResult = await generatePdfForInvoice(createdInvoice)
          if (pdfResult.success) {
            createdInvoice.pdfPath = pdfResult.pdfPath
            await createdInvoice.save()
          }
        } catch (error: any) {
          console.error('Recurring PDF generation failed:', error?.message || error)
        }
      }

      generatedCount += 1
      nextRun = nextRunByFrequency(nextRun, recurring)
    }

    await sourceInvoice.updateOne({
      $set: {
        'recurring.nextRunDate': nextRun ? formatDateString(nextRun) : '',
        'recurring.lastRunAt': generatedCount > 0 ? new Date() : sourceInvoice.recurring?.lastRunAt || null,
      },
    })
  }
}

export async function processRecurringInvoices() {
  if (!processingPromise) {
    processingPromise = processInternal().finally(() => {
      processingPromise = null
    })
  }
  await processingPromise
}

export function normalizeRecurringConfig(
  recurringInput: any,
  invoiceDate: string,
  invoiceDueDate: string
) {
  const enabled = Boolean(recurringInput?.enabled)
  const frequency =
    recurringInput?.frequency === 'daily' ||
    recurringInput?.frequency === 'weekly' ||
    recurringInput?.frequency === 'monthly' ||
    recurringInput?.frequency === 'every_n_days'
      ? recurringInput.frequency
      : 'monthly'

  const intervalDays = Math.max(1, Number(recurringInput?.intervalDays || 1))
  const autoGeneratePdf = recurringInput?.autoGeneratePdf !== false

  const invoiceDateParsed = parseDateString(invoiceDate)
  const dueDateParsed = parseDateString(invoiceDueDate)
  const requestedDueInDays = Number(recurringInput?.dueInDays)
  const dueInDays = Number.isFinite(requestedDueInDays)
    ? Math.max(0, requestedDueInDays)
    : invoiceDateParsed && dueDateParsed
      ? Math.max(0, Math.round((dueDateParsed.getTime() - invoiceDateParsed.getTime()) / (24 * 60 * 60 * 1000)))
      : 14

  let nextRunDate = ''
  if (enabled) {
    const requested = parseDateString(recurringInput?.nextRunDate)
    if (requested) {
      nextRunDate = formatDateString(requested)
    } else {
      const computed = computeFirstNextRunDate(invoiceDate, { frequency, intervalDays })
      nextRunDate = computed ? formatDateString(computed) : ''
    }
  }

  return {
    enabled,
    frequency,
    intervalDays,
    dueInDays,
    nextRunDate,
    autoGeneratePdf,
    lastRunAt: recurringInput?.lastRunAt || null,
    sourceInvoiceId: recurringInput?.sourceInvoiceId || null,
  }
}


import Invoice from '@/models/Invoice'
import Notification from '@/models/Notification'
import { computeInvoiceTotals } from '@/lib/invoice-totals'
import { diffDays, todayDateString } from './dates'
import type { NotificationDTO, NotificationType } from './types'

/*
 * Core notification service — the single owner of all server-side
 * notification logic. Write paths:
 *   1. notifyInvoiceGenerated  — pushed from cloneRecurringInvoice (recurring
 *      engine ONLY; manual/template creations must not notify)
 *   2. runOverdueScan          — pulled by the nightly cron route (force) and
 *      throttled from GET /api/notifications
 * Read/mutation paths are consumed by /api/notifications.
 */

const OVERDUE_SCAN_THROTTLE_MS = 10 * 60 * 1000 // 10 min
const RENOTIFY_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days
const RETENTION_READ_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const MAX_NOTIFICATIONS = 500
const DEFAULT_LIST_LIMIT = 50

export type OverdueScanResult = {
  ran: boolean
  skippedReason?: 'throttled' | 'already-running'
  created: number
  renotified: number
  resolved: number
}

// Module-level throttle state — mirrors the processingPromise pattern in
// src/lib/recurring-invoices.ts. lastOverdueScanAt is set BEFORE the work so
// a slow scan cannot stampede.
let lastOverdueScanAt = 0
let overdueScanPromise: Promise<OverdueScanResult> | null = null

// ---- Write paths ----------------------------------------------------------

/**
 * Called from cloneRecurringInvoice ONLY. Idempotent (one row per invoice
 * per type — racing duplicates hit the unique index and are swallowed).
 * Never throws: a notification failure must not abort invoice creation.
 */
export async function notifyInvoiceGenerated(invoice: {
  _id: unknown
  isTemplate?: boolean
  invoice?: { number?: string; dueDate?: string; currency?: string }
  customer?: { name?: string }
  amountPaid?: number
  financial?: { amountPaid?: number }
}): Promise<void> {
  try {
    if (!invoice || invoice.isTemplate) return

    const invoiceNumber = invoice.invoice?.number || ''
    const customerName = invoice.customer?.name || ''
    const now = new Date()

    await Notification.findOneAndUpdate(
      { invoiceId: invoice._id, type: 'invoice_generated' },
      {
        $setOnInsert: {
          invoiceNumber,
          customerName,
          title: 'New invoice generated',
          message: `Invoice ${invoiceNumber} was generated automatically${
            customerName ? ` for ${customerName}` : ''
          }.`,
          read: false,
          readAt: null,
          lastNotifiedAt: now,
          notifyCount: 1,
          resolvedAt: null,
        },
      },
      { upsert: true, new: true }
    )
  } catch (error: any) {
    // E11000 from a racing duplicate upsert is expected and fine.
    if (error?.code !== 11000) {
      console.error('notifyInvoiceGenerated failed:', error?.message || error)
    }
  }
}

/**
 * Throttled overdue scan. Safe to call from any request path; `force`
 * bypasses the throttle (used by the cron-secret-gated route).
 */
export async function runOverdueScan(options?: { force?: boolean }): Promise<OverdueScanResult> {
  const force = Boolean(options?.force)
  const now = Date.now()

  if (!force && now - lastOverdueScanAt < OVERDUE_SCAN_THROTTLE_MS) {
    return { ran: false, skippedReason: 'throttled', created: 0, renotified: 0, resolved: 0 }
  }

  if (overdueScanPromise) {
    // Coalesce: a scan is already in flight — wait for it.
    await overdueScanPromise
    return { ran: false, skippedReason: 'already-running', created: 0, renotified: 0, resolved: 0 }
  }

  lastOverdueScanAt = now
  overdueScanPromise = runOverdueScanInternal()
  try {
    return await overdueScanPromise
  } catch (error) {
    // Roll the throttle back so the next poll retries instead of silently
    // burning the rest of the window after a failed scan.
    lastOverdueScanAt = 0
    throw error
  } finally {
    overdueScanPromise = null
  }
}

async function runOverdueScanInternal(): Promise<OverdueScanResult> {
  const now = new Date()
  const today = todayDateString()
  let created = 0
  let renotified = 0
  let resolved = 0

  // 1. Currently-overdue invoices. Lexicographic string compare is correct
  //    for zero-padded ISO dates; the $regex guards malformed/legacy values.
  //    'partial' counts as unpaid; dueDate === today is NOT overdue.
  const overdueInvoices = await Invoice.find({
    isTemplate: false,
    status: { $ne: 'paid' },
    'invoice.dueDate': { $regex: /^\d{4}-\d{2}-\d{2}$/, $lt: today, $ne: '' },
  })
    .select(
      '_id invoice.number invoice.dueDate invoice.currency customer.name items fields financial amountPaid'
    )
    .lean()

  const overdueIds = overdueInvoices.map((i) => i._id)

  // 2. Existing overdue rows for exactly this set.
  const existing =
    overdueIds.length > 0
      ? await Notification.find({
          type: 'invoice_overdue',
          invoiceId: { $in: overdueIds },
        }).lean()
      : []
  const existingByInvoice = new Map(existing.map((n) => [String((n as any).invoiceId), n]))

  for (const invoice of overdueInvoices as any[]) {
    const existingRow = existingByInvoice.get(String(invoice._id))
    const dueDate: string = invoice.invoice?.dueDate || ''
    const daysOverdue = diffDays(dueDate, today)
    const invoiceNumber = invoice.invoice?.number || ''
    const customerName = invoice.customer?.name || ''
    const currency = invoice.invoice?.currency || 'USD'
    const total = computeAmountDue(invoice)
    const paid = Number(invoice.amountPaid ?? invoice.financial?.amountPaid ?? 0) || 0
    const amountDue = Math.max(0, total - paid)
    const message = `Invoice ${invoiceNumber}${customerName ? ` for ${customerName}` : ''} is ${daysOverdue} day${
      daysOverdue === 1 ? '' : 's'
    } overdue (due ${dueDate}).`

    if (!existingRow) {
      try {
        await Notification.create({
          type: 'invoice_overdue',
          invoiceId: invoice._id,
          invoiceNumber,
          customerName,
          amountDue,
          currency,
          dueDate,
          title: 'Invoice overdue',
          message,
          read: false,
          readAt: null,
          lastNotifiedAt: now,
          notifyCount: 1,
          firstOverdueAt: now,
          resolvedAt: null,
        })
        created += 1
      } catch (error: any) {
        // Isolate failures: one bad row must not abort the rest of the scan.
        if (error?.code !== 11000) {
          console.error(
            `Overdue notification create failed for invoice ${invoice._id}:`,
            error?.message || error
          )
        }
      }
    } else if (
      now.getTime() - new Date(existingRow.lastNotifiedAt).getTime() >= RENOTIFY_INTERVAL_MS
    ) {
      // Re-notify: the 3-day cadence elapsed since the last ping. Also
      // re-opens resolved rows whose invoice became overdue again — same
      // cadence, measured from lastNotifiedAt.
      try {
        const result = await Notification.updateOne(
          { _id: existingRow._id },
          {
            $set: {
              read: false,
              readAt: null,
              lastNotifiedAt: now,
              message,
              amountDue,
              dueDate,
              firstOverdueAt: existingRow.firstOverdueAt || now,
              resolvedAt: null, // re-opened — clear any prior resolution
            },
            $inc: { notifyCount: 1 },
          }
        )
        if (result.modifiedCount > 0) renotified += 1
      } catch (error: any) {
        console.error(
          `Overdue re-notify failed for invoice ${invoice._id}:`,
          error?.message || error
        )
      }
    }
  }

  // 3. Resolve rows that are no longer backed by an overdue invoice
  //    (invoice paid or deleted outside the DELETE route) — regardless of
  //    read state; an owner may have read the notification while the invoice
  //    was still unpaid. $nin: [] matches everything — which is exactly
  //    right when nothing is overdue.
  const resolveResult = await Notification.updateMany(
    {
      type: 'invoice_overdue',
      resolvedAt: null,
      invoiceId: { $nin: overdueIds },
    },
    { $set: { read: true, readAt: now, resolvedAt: now } }
  )
  resolved = resolveResult.modifiedCount || 0

  try {
    await pruneNotifications()
  } catch (error: any) {
    console.error('Notification pruning failed:', error?.message || error)
  }

  return { ran: true, created, renotified, resolved }
}

/** Cascade from DELETE /api/invoices/[id]. Never throws. */
export async function deleteNotificationsForInvoice(invoiceId: string): Promise<void> {
  try {
    await Notification.deleteMany({ invoiceId })
  } catch (error: any) {
    console.error('deleteNotificationsForInvoice failed:', error?.message || error)
  }
}

// ---- Read / mutation paths used by the API route --------------------------

export async function listNotifications(options?: {
  limit?: number
}): Promise<{ items: NotificationDTO[]; unreadCount: number }> {
  const limit = Math.min(Math.max(Number(options?.limit) || DEFAULT_LIST_LIMIT, 1), 100)

  const [docs, unreadCount] = await Promise.all([
    Notification.find().sort({ lastNotifiedAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ read: false }),
  ])

  return {
    items: docs.map(toDTO),
    unreadCount,
  }
}

export async function markNotificationRead(id: string): Promise<{ modifiedCount: number }> {
  const result = await Notification.updateOne(
    { _id: id },
    { $set: { read: true, readAt: new Date() } }
  )
  return { modifiedCount: result.modifiedCount || 0 }
}

export async function markAllNotificationsRead(): Promise<{ modifiedCount: number }> {
  const result = await Notification.updateMany(
    { read: false },
    { $set: { read: true, readAt: new Date() } }
  )
  return { modifiedCount: result.modifiedCount || 0 }
}

// ---- Retention ------------------------------------------------------------

/** Delete read notifications older than 30d; cap collection at MAX_NOTIFICATIONS rows. */
export async function pruneNotifications(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - RETENTION_READ_MS)
  const old = await Notification.deleteMany({ read: true, readAt: { $lt: cutoff } })
  let deleted = old.deletedCount || 0

  const total = await Notification.estimatedDocumentCount()
  if (total > MAX_NOTIFICATIONS) {
    // Keep the newest MAX_NOTIFICATIONS overall; prune the oldest rows that
    // fall outside that window — but only read ones. Unread rows are never
    // auto-deleted — they are the owner's outstanding work.
    const excess = total - MAX_NOTIFICATIONS
    const oldest = await Notification.find()
      .sort({ createdAt: 1 })
      .limit(excess)
      .select('_id read')
      .lean()
    const deletableIds = oldest.filter((d: any) => d.read).map((d: any) => d._id)
    if (deletableIds.length > 0) {
      const removed = await Notification.deleteMany({ _id: { $in: deletableIds } })
      deleted += removed.deletedCount || 0
    }
  }

  return { deleted }
}

// ---- Helpers ---------------------------------------------------------------

function computeAmountDue(invoice: any): number {
  // Same canonical totals math as the Invoice model's virtuals and the
  // dashboard (src/lib/invoice-totals.ts) — one source of truth.
  return computeInvoiceTotals(invoice).total
}

function toDTO(doc: any): NotificationDTO {
  return {
    id: String(doc._id),
    type: doc.type as NotificationType,
    invoiceId: String(doc.invoiceId),
    invoiceNumber: doc.invoiceNumber,
    customerName: doc.customerName,
    title: doc.title,
    message: doc.message,
    read: Boolean(doc.read),
    readAt: doc.readAt ? new Date(doc.readAt).toISOString() : null,
    lastNotifiedAt: new Date(doc.lastNotifiedAt).toISOString(),
    notifyCount: doc.notifyCount || 1,
    amountDue: doc.amountDue || 0,
    currency: doc.currency || 'USD',
    dueDate: doc.dueDate || null,
    resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
  }
}
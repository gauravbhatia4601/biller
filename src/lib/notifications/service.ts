import Invoice from '@/models/Invoice'
import Notification from '@/models/Notification'
import { computeInvoiceTotals } from '@/lib/invoice-totals'
import { diffDays, parseDateString, todayDateString } from './dates'
import { sendPushToAll } from './push'
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

    // Fire-and-forget web push — arrives even when the PWA is closed.
    void sendPushToAll({
      title: 'New invoice generated',
      body: `Invoice ${invoiceNumber}${
        customerName ? ` for ${customerName}` : ''
      } was generated automatically.`,
      url: `/invoices/${String(invoice._id)}`,
      tag: `generated-${String(invoice._id)}`,
    })
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

  // Filter out rows we can act on safely:
  //  - calendar-impossible dueDates (e.g. '2026-00-00' pass the $regex but
  //    break date math) — cannot notify safely, never resolve their rows
  //  - zero amount due: a 'partial' invoice where amountPaid covers the total
  //    is not owed anything and must not alarm (step 3 resolves its old row)
  const actionable: {
    invoice: any
    dueDate: string
    daysOverdue: number
    amountDue: number
    currency: string
    invoiceNumber: string
    customerName: string
  }[] = []

  for (const invoice of overdueInvoices as any[]) {
    const dueDate: string = invoice.invoice?.dueDate || ''
    const total = computeAmountDue(invoice)
    const paid = Number(invoice.amountPaid ?? invoice.financial?.amountPaid ?? 0) || 0
    const amountDue = Math.max(0, total - paid)
    if (!(amountDue > 0.005)) continue

    const daysOverdue = diffDays(dueDate, today)
    if (!parseDateString(dueDate) || !Number.isFinite(daysOverdue)) continue

    actionable.push({
      invoice,
      dueDate,
      daysOverdue,
      amountDue,
      currency: invoice.invoice?.currency || 'USD',
      invoiceNumber: invoice.invoice?.number || '',
      customerName: invoice.customer?.name || '',
    })
  }

  const overdueIds = actionable.map((e) => e.invoice._id)
  const overdueIdSet = new Set(overdueIds.map(String))

  // 2. Existing overdue rows for exactly this set.
  const existing =
    overdueIds.length > 0
      ? await Notification.find({
          type: 'invoice_overdue',
          invoiceId: { $in: overdueIds },
        }).lean()
      : []
  const existingByInvoice = new Map(existing.map((n) => [String((n as any).invoiceId), n]))

  for (const entry of actionable) {
    const { invoice, dueDate, daysOverdue, amountDue, currency, invoiceNumber, customerName } = entry
    const existingRow = existingByInvoice.get(String(invoice._id))
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
        void sendPushToAll({
          title: 'Invoice overdue',
          body: message,
          url: `/invoices/${String(invoice._id)}`,
          tag: `overdue-${String(invoice._id)}`,
        })
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
      existingRow.resolvedAt ||
      now.getTime() - new Date(existingRow.lastNotifiedAt).getTime() >= RENOTIFY_INTERVAL_MS
    ) {
      // Re-notify when the 3-day cadence has elapsed, or IMMEDIATELY when the
      // row was resolved (paid) but the invoice became overdue again — the
      // owner must not wait out the cadence on a genuine regression.
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
        if (result.modifiedCount > 0) {
          renotified += 1
          void sendPushToAll({
            title: 'Invoice overdue',
            body: message,
            url: `/invoices/${String(invoice._id)}`,
            tag: `overdue-${String(invoice._id)}`,
          })
        }
      } catch (error: any) {
        console.error(
          `Overdue re-notify failed for invoice ${invoice._id}:`,
          error?.message || error
        )
      }
    }
  }

  // 3. Rows no longer backed by an overdue invoice — regardless of read
  //    state (an owner may have read it while the invoice was unpaid):
  //    - invoice gone (deleted outside the DELETE route, or racing an
  //      in-flight scan's create) → hard-delete the orphan
  //    - invoice still exists (paid, or amountDue hit 0) → resolve
  const pendingRows = await Notification.find({
    type: 'invoice_overdue',
    resolvedAt: null,
  })
    .select('_id invoiceId')
    .lean()

  const pendingInvoiceIds = Array.from(
    new Set(pendingRows.map((r: any) => String(r.invoiceId)))
  )
  const stillExistingInvoices = pendingInvoiceIds.length
    ? await Invoice.find({ _id: { $in: pendingInvoiceIds } }).select('_id').lean()
    : []
  const existingInvoiceSet = new Set(stillExistingInvoices.map((i: any) => String(i._id)))

  const orphanInvoiceIds: string[] = []
  const resolvableRowIds: any[] = []
  for (const row of pendingRows as any[]) {
    const invoiceKey = String(row.invoiceId)
    if (!existingInvoiceSet.has(invoiceKey)) {
      orphanInvoiceIds.push(invoiceKey)
    } else if (!overdueIdSet.has(invoiceKey)) {
      resolvableRowIds.push(row._id)
    }
  }

  if (orphanInvoiceIds.length > 0) {
    await Notification.deleteMany({ invoiceId: { $in: orphanInvoiceIds } })
  }
  if (resolvableRowIds.length > 0) {
    const resolveResult = await Notification.updateMany(
      { _id: { $in: resolvableRowIds } },
      { $set: { read: true, readAt: now, resolvedAt: now } }
    )
    resolved = resolveResult.modifiedCount || 0
  }

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
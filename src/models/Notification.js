import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['invoice_generated', 'invoice_overdue'],
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    // Snapshots — notifications must survive invoice edits/deletes without joins.
    invoiceNumber: { type: String, required: true },
    customerName: { type: String, default: '' },
    amountDue: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    dueDate: { type: String, default: '' }, // 'YYYY-MM-DD', overdue only

    title: { type: String, required: true },
    message: { type: String, required: true },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },

    // Cadence / dedupe fields
    // lastNotifiedAt is the list sort key AND the client ping key — never
    // sort by createdAt/updatedAt or mark-read would reshuffle the list.
    lastNotifiedAt: { type: Date, required: true },
    notifyCount: { type: Number, default: 1, min: 1 },
    firstOverdueAt: { type: Date, default: null }, // overdue only
    resolvedAt: { type: Date, default: null }, // set when invoice paid/deleted
  },
  { timestamps: true }
);

// ONE active overdue notification per invoice for the doc's lifetime.
// Re-notify mutates this doc in place (read:false + lastNotifiedAt bump) —
// it never creates a second row. partialFilterExpression keeps rows of the
// other type out of the constraint.
notificationSchema.index(
  { invoiceId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'invoice_overdue' } }
);
// Defensive idempotency for generated invoices too (clone + notify retried).
notificationSchema.index(
  { invoiceId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'invoice_generated' } }
);

// List query: newest-pinged first; unread badge count.
notificationSchema.index({ lastNotifiedAt: -1 });
notificationSchema.index({ read: 1, lastNotifiedAt: -1 });

// Retention cleanup (read + older than 30d).
notificationSchema.index({ readAt: 1 }, { sparse: true });

notificationSchema.set('toJSON', { virtuals: true });

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
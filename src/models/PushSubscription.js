import mongoose from 'mongoose';

// One row per device/browser that granted push permission. Single-owner app,
// so every row belongs to the owner.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String, default: '' },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ createdAt: 1 });

const PushSubscription =
  mongoose.models.PushSubscription ||
  mongoose.model('PushSubscription', pushSubscriptionSchema);

export default PushSubscription;
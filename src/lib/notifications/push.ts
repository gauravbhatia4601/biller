import webpush from 'web-push'
import PushSubscription from '@/models/PushSubscription'

/*
 * Web-push sender — part of the notification core service. Fire-and-forget:
 * a push failure must never break invoice creation or the overdue scan.
 * Subscriptions that the push service reports as gone (404/410) are deleted
 * so the table self-cleans.
 */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:info@technioz.com'

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/** Send to every registered device. Never throws. */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  try {
    if (!isPushConfigured()) return

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const subscriptions = await PushSubscription.find().lean()
    if (subscriptions.length === 0) return

    const body = JSON.stringify(payload)
    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        )
      )
    )

    // Self-clean: 404/410 means the subscription is dead (app uninstalled,
    // push service expired it).
    const goneIds = results
      .map((r, i) =>
        r.status === 'rejected' &&
        [404, 410].includes((r.reason as any)?.statusCode)
          ? (subscriptions[i] as any)._id
          : null
      )
      .filter(Boolean)

    if (goneIds.length > 0) {
      await PushSubscription.deleteMany({ _id: { $in: goneIds } })
    }
  } catch (error: any) {
    console.error('sendPushToAll failed:', error?.message || error)
  }
}
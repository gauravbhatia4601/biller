import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getCurrentSession } from '@/lib/auth/session'
import { isPushConfigured } from '@/lib/notifications/push'
import PushSubscription from '@/models/PushSubscription'

export const dynamic = 'force-dynamic'

// GET /api/push - VAPID public key for the client's pushManager.subscribe()
export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isPushConfigured()) {
      return NextResponse.json({ error: 'Push is not configured' }, { status: 501 })
    }
    return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
  } catch (error: any) {
    console.error('Failed to read push config:', error)
    return NextResponse.json({ error: 'Failed to read push config' }, { status: 500 })
  }
}

// POST /api/push - { action: 'subscribe', subscription } | { action: 'unsubscribe', endpoint }
export async function POST(request: Request) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await connectDB()

    const body = await request.json().catch(() => null)

    if (body?.action === 'subscribe') {
      const subscription = body.subscription
      if (
        !subscription ||
        typeof subscription.endpoint !== 'string' ||
        !subscription.keys?.p256dh ||
        !subscription.keys?.auth
      ) {
        return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
      }

      await PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
          $set: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent: request.headers.get('user-agent') || '',
          },
        },
        { upsert: true }
      )
      return NextResponse.json({ success: true })
    }

    if (body?.action === 'unsubscribe') {
      if (typeof body.endpoint !== 'string') {
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
      }
      await PushSubscription.deleteOne({ endpoint: body.endpoint })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Failed to update push subscription:', error)
    return NextResponse.json({ error: 'Failed to update push subscription' }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getCurrentSession } from '@/lib/auth/session'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  runOverdueScan,
} from '@/lib/notifications/service'

export const dynamic = 'force-dynamic'

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

// GET /api/notifications - List notifications (also runs the throttled
// overdue scan so reminders work even if the nightly cron was missed).
export async function GET(request: Request) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await connectDB()

    const limitParam = Number(new URL(request.url).searchParams.get('limit')) || 50
    const limit = Math.min(Math.max(limitParam, 1), 100)

    // Throttled inside the service; failures must never break the list read.
    try {
      const scan = await runOverdueScan()
      if (scan.skippedReason === 'throttled' && process.env.AUTH_DEBUG === 'true') {
        console.log('Overdue scan skipped:', scan.skippedReason)
      }
    } catch (scanError) {
      console.error('Overdue scan failed:', scanError)
    }

    const { items, unreadCount } = await listNotifications({ limit })
    return NextResponse.json({ items, unreadCount, serverTime: new Date().toISOString() })
  } catch (error: any) {
    console.error('Failed to list notifications:', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

// POST /api/notifications - { action: 'mark-read', id } | { action: 'mark-all-read' }
export async function POST(request: Request) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await connectDB()

    const body = await request.json().catch(() => null)

    if (body?.action === 'mark-all-read') {
      const { modifiedCount } = await markAllNotificationsRead()
      return NextResponse.json({ success: true, modifiedCount })
    }

    if (body?.action === 'mark-read') {
      if (typeof body.id !== 'string' || !OBJECT_ID_REGEX.test(body.id)) {
        return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 })
      }
      const { modifiedCount } = await markNotificationRead(body.id)
      if (modifiedCount === 0) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, modifiedCount })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Failed to update notifications:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
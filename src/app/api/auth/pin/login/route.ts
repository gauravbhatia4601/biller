import { NextResponse } from 'next/server'
import { assertAuthEnv, authConfig } from '@/lib/auth/env'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { isPinFormatValid, verifyPin } from '@/lib/auth/pin'
import { createSessionToken, setSessionCookie } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'

const getIP = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

export async function POST(request: Request) {
  try {
    assertAuthEnv()
    const ip = getIP(request)
    const rate = checkRateLimit(`pin:${ip}`, 20, 5 * 60 * 1000)
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const body = await request.json()
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''

    if (!isPinFormatValid(pin)) {
      return NextResponse.json({ error: 'Invalid PIN format.' }, { status: 400 })
    }

    const authState: any = await getAuthState()
    const now = Date.now()
    if (authState.pinLockUntil && new Date(authState.pinLockUntil).getTime() > now) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((new Date(authState.pinLockUntil).getTime() - now) / 1000)
      )
      return NextResponse.json(
        { error: 'PIN login temporarily locked due to failed attempts.' },
        { status: 423, headers: { 'Retry-After': String(retryAfterSeconds) } }
      )
    }

    const isValid = verifyPin(pin)
    if (!isValid) {
      const failedAttempts = (authState.pinFailedAttempts || 0) + 1
      const updateData: Record<string, unknown> = { pinFailedAttempts: failedAttempts }
      if (failedAttempts >= authConfig.pinMaxAttempts) {
        updateData.pinLockUntil = new Date(Date.now() + authConfig.pinLockMs)
      }
      await authState.updateOne({ $set: updateData })

      return NextResponse.json({ error: 'Invalid PIN.' }, { status: 401 })
    }

    await authState.updateOne({
      $set: {
        pinFailedAttempts: 0,
        pinLockUntil: null,
      },
    })

    const response = NextResponse.json({ success: true, methods: ['pin'] })
    setSessionCookie(response, createSessionToken(['pin']))
    return response
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Authentication failed' }, { status: 500 })
  }
}


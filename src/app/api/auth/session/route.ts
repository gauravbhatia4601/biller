import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'

export async function GET() {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ authenticated: false, methods: [], hasBiometric: false })
  }

  const authState: any = await getAuthState()
  return NextResponse.json({
    authenticated: true,
    methods: session.methods,
    hasBiometric: (authState.webAuthnCredentials || []).length > 0,
  })
}


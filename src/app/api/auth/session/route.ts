import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'

export async function GET() {
  const authState: any = await getAuthState()
  const hasBiometric = (authState.webAuthnCredentials || []).length > 0
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ authenticated: false, methods: [], hasBiometric })
  }

  return NextResponse.json({
    authenticated: true,
    methods: session.methods,
    hasBiometric,
  })
}


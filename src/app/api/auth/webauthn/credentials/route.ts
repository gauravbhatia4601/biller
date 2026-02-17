import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'

export async function GET() {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authState: any = await getAuthState()
  const credentials = (authState.webAuthnCredentials || []).map((credential: any, index: number) => ({
    credentialID: credential.credentialID,
    label: credential.label || `Fingerprint ${index + 1}`,
    deviceType: credential.deviceType || 'singleDevice',
    backedUp: Boolean(credential.backedUp),
    transports: credential.transports || [],
    createdAt: credential.createdAt || null,
    lastUsedAt: credential.lastUsedAt || null,
  }))

  return NextResponse.json({ credentials })
}


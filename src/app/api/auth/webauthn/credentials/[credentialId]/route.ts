import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'
import AuthState from '@/models/AuthState'

export async function PATCH(request: Request, { params }: { params: { credentialId: string } }) {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const credentialID = decodeURIComponent(params.credentialId)
  const body = await request.json()
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  if (!label || label.length > 50) {
    return NextResponse.json({ error: 'Label is required and must be <= 50 chars.' }, { status: 400 })
  }

  const authState: any = await getAuthState()
  const existing = (authState.webAuthnCredentials || []).find(
    (credential: any) => credential.credentialID === credentialID
  )
  if (!existing) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  await AuthState.updateOne(
    {
      singletonKey: 'owner',
      'webAuthnCredentials.credentialID': credentialID,
    },
    {
      $set: { 'webAuthnCredentials.$.label': label },
    }
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(_: Request, { params }: { params: { credentialId: string } }) {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const credentialID = decodeURIComponent(params.credentialId)
  const authState: any = await getAuthState()
  const exists = (authState.webAuthnCredentials || []).some(
    (credential: any) => credential.credentialID === credentialID
  )
  if (!exists) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  await AuthState.updateOne(
    { singletonKey: 'owner' },
    {
      $pull: {
        webAuthnCredentials: { credentialID },
      },
    }
  )

  return NextResponse.json({ success: true })
}


import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { assertAuthEnv } from '@/lib/auth/env'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'
import { getWebAuthnConfig } from '@/lib/auth/webauthn'

export async function POST() {
  try {
    assertAuthEnv()
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authState: any = await getAuthState()
    const webAuthnConfig = getWebAuthnConfig()

    const options = await generateRegistrationOptions({
      rpName: webAuthnConfig.rpName,
      rpID: webAuthnConfig.rpID,
      userID: new TextEncoder().encode('owner'),
      userName: 'owner',
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: (authState.webAuthnCredentials || []).map((credential: any) => ({
        id: credential.credentialID,
        transports: credential.transports || [],
      })),
    })

    await authState.updateOne({
      $set: {
        currentChallenge: options.challenge,
        challengeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    return NextResponse.json(options)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate registration options' },
      { status: 500 }
    )
  }
}


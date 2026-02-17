import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { assertAuthEnv } from '@/lib/auth/env'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'
import { getWebAuthnConfig } from '@/lib/auth/webauthn'
import { authErrorPayload, authLog } from '@/lib/auth/debug'

export async function POST() {
  try {
    authLog('register.options.start')
    assertAuthEnv()
    const session = await getCurrentSession()
    if (!session) {
      authLog('register.options.unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authState: any = await getAuthState()
    const webAuthnConfig = getWebAuthnConfig()
    authLog('register.options.config', {
      rpID: webAuthnConfig.rpID,
      origin: webAuthnConfig.origin,
      existingCredentialCount: (authState.webAuthnCredentials || []).length,
    })

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

    authLog('register.options.success')
    return NextResponse.json(options)
  } catch (error: any) {
    authLog('register.options.error', { message: error?.message || 'unknown error' })
    return NextResponse.json(authErrorPayload(error, 'Failed to generate registration options'), {
      status: 500,
    })
  }
}


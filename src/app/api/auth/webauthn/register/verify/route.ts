import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { assertAuthEnv } from '@/lib/auth/env'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'
import { getWebAuthnConfig, toBase64Url } from '@/lib/auth/webauthn'

export async function POST(request: Request) {
  try {
    assertAuthEnv()
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authState: any = await getAuthState()
    if (!authState.currentChallenge || !authState.challengeExpiresAt) {
      return NextResponse.json({ error: 'No active challenge' }, { status: 400 })
    }
    if (new Date(authState.challengeExpiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 })
    }

    const { response } = await request.json()
    const webAuthnConfig = getWebAuthnConfig()

    const verification: any = await verifyRegistrationResponse({
      response,
      expectedChallenge: authState.currentChallenge,
      expectedOrigin: webAuthnConfig.origin,
      expectedRPID: webAuthnConfig.rpID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 })
    }

    const regInfo = verification.registrationInfo
    const credential = regInfo.credential || {
      id: regInfo.credentialID,
      publicKey: regInfo.credentialPublicKey,
      counter: regInfo.counter,
      transports: regInfo.transports || [],
    }

    const credentialID = typeof credential.id === 'string' ? credential.id : toBase64Url(credential.id)
    const credentialPublicKey =
      typeof credential.publicKey === 'string'
        ? credential.publicKey
        : toBase64Url(credential.publicKey)

    await authState.updateOne({
      $set: {
        currentChallenge: null,
        challengeExpiresAt: null,
      },
      $pull: {
        webAuthnCredentials: { credentialID },
      },
    })

    await authState.updateOne({
      $push: {
        webAuthnCredentials: {
          credentialID,
          credentialPublicKey,
          counter: credential.counter || 0,
          transports: credential.transports || [],
          deviceType: regInfo.credentialDeviceType || 'singleDevice',
          backedUp: regInfo.credentialBackedUp || false,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to verify registration response' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { assertAuthEnv } from '@/lib/auth/env'
import { getCurrentSession } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'
import { getWebAuthnConfig, toBase64Url } from '@/lib/auth/webauthn'
import { authErrorPayload, authLog } from '@/lib/auth/debug'

export async function POST(request: Request) {
  try {
    authLog('register.verify.start')
    assertAuthEnv()
    const session = await getCurrentSession()
    if (!session) {
      authLog('register.verify.unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authState: any = await getAuthState()
    if (!authState.currentChallenge || !authState.challengeExpiresAt) {
      authLog('register.verify.no_challenge')
      return NextResponse.json({ error: 'No active challenge' }, { status: 400 })
    }
    if (new Date(authState.challengeExpiresAt).getTime() < Date.now()) {
      authLog('register.verify.challenge_expired')
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 })
    }

    const { response } = await request.json()
    const webAuthnConfig = getWebAuthnConfig()
    authLog('register.verify.request', {
      rpID: webAuthnConfig.rpID,
      origin: webAuthnConfig.origin,
      responseId: response?.id || null,
    })

    const verification: any = await verifyRegistrationResponse({
      response,
      expectedChallenge: authState.currentChallenge,
      expectedOrigin: webAuthnConfig.origin,
      expectedRPID: webAuthnConfig.rpID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      authLog('register.verify.not_verified')
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
          label: `Fingerprint ${(authState.webAuthnCredentials || []).length + 1}`,
          credentialPublicKey,
          counter: credential.counter || 0,
          transports: credential.transports || [],
          deviceType: regInfo.credentialDeviceType || 'singleDevice',
          backedUp: regInfo.credentialBackedUp || false,
          createdAt: new Date(),
        },
      },
    })

    authLog('register.verify.success', { credentialID })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    authLog('register.verify.error', { message: error?.message || 'unknown error' })
    return NextResponse.json(authErrorPayload(error, 'Failed to verify registration response'), {
      status: 500,
    })
  }
}


import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { assertAuthEnv } from '@/lib/auth/env'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { createSessionToken, setSessionCookie } from '@/lib/auth/session'
import { getAuthState } from '@/lib/auth/state'
import { fromBase64Url, getWebAuthnConfig } from '@/lib/auth/webauthn'
import { authErrorPayload, authLog } from '@/lib/auth/debug'
import AuthState from '@/models/AuthState'

const getIP = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

export async function POST(request: Request) {
  try {
    authLog('login.verify.start')
    assertAuthEnv()
    const ip = getIP(request)
    const rate = checkRateLimit(`webauthn-verify:${ip}`, 30, 5 * 60 * 1000)
    if (!rate.ok) {
      authLog('login.verify.rate_limited', { ip, retryAfterSeconds: rate.retryAfterSeconds })
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const authState: any = await getAuthState()
    if (!authState.currentChallenge || !authState.challengeExpiresAt) {
      authLog('login.verify.no_challenge')
      return NextResponse.json({ error: 'No active challenge' }, { status: 400 })
    }
    if (new Date(authState.challengeExpiresAt).getTime() < Date.now()) {
      authLog('login.verify.challenge_expired')
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 })
    }

    const { response } = await request.json()
    const credentialID = response?.id
    if (!credentialID) {
      authLog('login.verify.invalid_response')
      return NextResponse.json({ error: 'Invalid credential response' }, { status: 400 })
    }

    const storedCredential = (authState.webAuthnCredentials || []).find(
      (credential: any) => credential.credentialID === credentialID
    )
    if (!storedCredential) {
      authLog('login.verify.credential_not_found', { credentialID })
      return NextResponse.json({ error: 'Credential not recognized' }, { status: 400 })
    }

    const webAuthnConfig = getWebAuthnConfig()
    authLog('login.verify.request', {
      credentialID,
      rpID: webAuthnConfig.rpID,
      origin: webAuthnConfig.origin,
    })
    const verification: any = await verifyAuthenticationResponse({
      response,
      expectedChallenge: authState.currentChallenge,
      expectedOrigin: webAuthnConfig.origin,
      expectedRPID: webAuthnConfig.rpID,
      requireUserVerification: true,
      credential: {
        id: storedCredential.credentialID,
        publicKey: fromBase64Url(storedCredential.credentialPublicKey),
        counter: storedCredential.counter || 0,
        transports: storedCredential.transports || [],
      },
    })

    if (!verification.verified) {
      authLog('login.verify.not_verified')
      return NextResponse.json({ error: 'Fingerprint verification failed' }, { status: 401 })
    }

    const newCounter = verification.authenticationInfo?.newCounter
    await authState.updateOne({
      $set: {
        currentChallenge: null,
        challengeExpiresAt: null,
      },
    })

    if (typeof newCounter === 'number') {
      await AuthState.updateOne(
        {
          singletonKey: 'owner',
          'webAuthnCredentials.credentialID': storedCredential.credentialID,
        },
        {
          $set: {
            'webAuthnCredentials.$.counter': newCounter,
            'webAuthnCredentials.$.lastUsedAt': new Date(),
          },
        }
      )
    } else {
      await AuthState.updateOne(
        {
          singletonKey: 'owner',
          'webAuthnCredentials.credentialID': storedCredential.credentialID,
        },
        {
          $set: {
            'webAuthnCredentials.$.lastUsedAt': new Date(),
          },
        }
      )
    }

    const responseJson = NextResponse.json({ success: true, methods: ['webauthn'] })
    setSessionCookie(responseJson, createSessionToken(['webauthn']))
    authLog('login.verify.success', { credentialID })
    return responseJson
  } catch (error: any) {
    authLog('login.verify.error', { message: error?.message || 'unknown error' })
    return NextResponse.json(authErrorPayload(error, 'Failed to verify fingerprint'), {
      status: 500,
    })
  }
}


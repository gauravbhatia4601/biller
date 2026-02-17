import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { assertAuthEnv } from '@/lib/auth/env'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { getAuthState } from '@/lib/auth/state'
import { getWebAuthnConfig } from '@/lib/auth/webauthn'
import { authErrorPayload, authLog } from '@/lib/auth/debug'

const getIP = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

export async function POST(request: Request) {
  try {
    authLog('login.options.start')
    assertAuthEnv()
    const ip = getIP(request)
    const rate = checkRateLimit(`webauthn-options:${ip}`, 30, 5 * 60 * 1000)
    if (!rate.ok) {
      authLog('login.options.rate_limited', { ip, retryAfterSeconds: rate.retryAfterSeconds })
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const authState: any = await getAuthState()
    const credentials = authState.webAuthnCredentials || []
    if (!credentials.length) {
      authLog('login.options.no_credentials')
      return NextResponse.json({ error: 'No fingerprint credential registered yet.' }, { status: 400 })
    }

    const webAuthnConfig = getWebAuthnConfig()
    authLog('login.options.config', {
      rpID: webAuthnConfig.rpID,
      origin: webAuthnConfig.origin,
      credentialCount: credentials.length,
    })
    const options = await generateAuthenticationOptions({
      rpID: webAuthnConfig.rpID,
      userVerification: 'required',
      timeout: 60000,
      allowCredentials: credentials.map((credential: any) => ({
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

    authLog('login.options.success')
    return NextResponse.json(options)
  } catch (error: any) {
    authLog('login.options.error', { message: error?.message || 'unknown error' })
    return NextResponse.json(authErrorPayload(error, 'Failed to generate login challenge'), {
      status: 500,
    })
  }
}


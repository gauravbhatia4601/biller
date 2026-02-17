import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { assertAuthEnv } from '@/lib/auth/env'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { getAuthState } from '@/lib/auth/state'
import { getWebAuthnConfig } from '@/lib/auth/webauthn'

const getIP = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

export async function POST(request: Request) {
  try {
    assertAuthEnv()
    const ip = getIP(request)
    const rate = checkRateLimit(`webauthn-options:${ip}`, 30, 5 * 60 * 1000)
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const authState: any = await getAuthState()
    const credentials = authState.webAuthnCredentials || []
    if (!credentials.length) {
      return NextResponse.json({ error: 'No fingerprint credential registered yet.' }, { status: 400 })
    }

    const webAuthnConfig = getWebAuthnConfig()
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

    return NextResponse.json(options)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate login challenge' },
      { status: 500 }
    )
  }
}


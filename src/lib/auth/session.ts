import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authConfig } from '@/lib/auth/env'
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants'
const isProd = process.env.NODE_ENV === 'production'
const SESSION_ALG = 'HS256'

export type SessionMethod = 'pin' | 'webauthn'
export type SessionPayload = {
  sub: 'owner'
  methods: SessionMethod[]
  iat: number
  exp: number
  jti: string
}

const encodePart = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

const sign = (headerPart: string, payloadPart: string) =>
  createHmac('sha256', authConfig.sessionSecret).update(`${headerPart}.${payloadPart}`).digest('base64url')

export function createSessionToken(methods: SessionMethod[]) {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    sub: 'owner',
    methods,
    iat: now,
    exp: now + authConfig.sessionTtlSeconds,
    jti: randomBytes(16).toString('hex'),
  }

  const headerPart = encodePart({ alg: SESSION_ALG, typ: 'JWT' })
  const payloadPart = encodePart(payload)
  const signature = sign(headerPart, payloadPart)
  return `${headerPart}.${payloadPart}.${signature}`
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || !authConfig.sessionSecret) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signature] = parts

  const expected = sign(headerPart, payloadPart)
  const actualBuf = Buffer.from(signature, 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as SessionPayload
    if (payload.sub !== 'owner') return null
    if (!Array.isArray(payload.methods)) return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: authConfig.sessionTtlSeconds,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export async function getCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  return verifySessionToken(token)
}


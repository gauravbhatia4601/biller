import { authConfig } from '@/lib/auth/env'

const SESSION_ALG = 'HS256'

type SessionPayload = {
  sub: 'owner'
  methods: string[]
  iat: number
  exp: number
  jti: string
}

const textEncoder = new TextEncoder()

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

const isEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

const importHmacKey = () =>
  crypto.subtle.importKey(
    'raw',
    textEncoder.encode(authConfig.sessionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

export async function verifySessionTokenEdge(token?: string | null): Promise<SessionPayload | null> {
  if (!token || !authConfig.sessionSecret) return null
  const [headerPart, payloadPart, signature] = token.split('.')
  if (!headerPart || !payloadPart || !signature) return null

  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(headerPart))) as { alg?: string }
    if (header.alg !== SESSION_ALG) return null
  } catch {
    return null
  }

  const key = await importHmacKey()
  const signed = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${headerPart}.${payloadPart}`))
  const expectedSignature = new Uint8Array(signed)
  const actualSignature = decodeBase64Url(signature)

  if (!isEqual(actualSignature, expectedSignature)) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart))) as SessionPayload
    if (payload.sub !== 'owner') return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}


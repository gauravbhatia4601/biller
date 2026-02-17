import { authConfig } from '@/lib/auth/env'

export function toBase64Url(input: Uint8Array) {
  return Buffer.from(input).toString('base64url')
}

export function fromBase64Url(input: string) {
  return Buffer.from(input, 'base64url')
}

export function getWebAuthnConfig() {
  return {
    rpName: authConfig.webAuthnRpName,
    rpID: authConfig.webAuthnRpID,
    origin: authConfig.webAuthnOrigin,
  }
}


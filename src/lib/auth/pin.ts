import { pbkdf2Sync, timingSafeEqual } from 'crypto'
import { authConfig } from '@/lib/auth/env'

const PIN_DERIVATION_ITERATIONS = 210000
const PIN_KEY_LENGTH = 32
const PIN_DIGEST = 'sha256'

export const pinPolicy = {
  minLength: 4,
  maxLength: 12,
}

export function isPinFormatValid(pin: string) {
  return /^\d+$/.test(pin) && pin.length >= pinPolicy.minLength && pin.length <= pinPolicy.maxLength
}

export function hashPin(pin: string, salt: string) {
  return pbkdf2Sync(pin, salt, PIN_DERIVATION_ITERATIONS, PIN_KEY_LENGTH, PIN_DIGEST).toString('hex')
}

export function verifyPin(pin: string) {
  if (!authConfig.pinHash || !authConfig.pinSalt) return false

  const actual = Buffer.from(hashPin(pin, authConfig.pinSalt), 'utf8')
  const expected = Buffer.from(authConfig.pinHash, 'utf8')

  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}


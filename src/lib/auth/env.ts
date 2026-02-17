const parseNumberEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const authConfig = {
  sessionSecret: process.env.AUTH_SESSION_SECRET || '',
  pinSalt: process.env.AUTH_PIN_SALT || '',
  pinHash: process.env.AUTH_PIN_HASH || '',
  webAuthnRpID: process.env.AUTH_WEBAUTHN_RP_ID || '',
  webAuthnOrigin: process.env.AUTH_WEBAUTHN_ORIGIN || '',
  webAuthnRpName: process.env.AUTH_WEBAUTHN_RP_NAME || 'Biller',
  pinMaxAttempts: parseNumberEnv(process.env.AUTH_PIN_MAX_ATTEMPTS, 5),
  pinLockMs: parseNumberEnv(process.env.AUTH_PIN_LOCK_MS, 15 * 60 * 1000),
  sessionTtlSeconds: parseNumberEnv(process.env.AUTH_SESSION_TTL_SECONDS, 60 * 60 * 8),
}

export function assertAuthEnv() {
  const required = [
    ['AUTH_SESSION_SECRET', authConfig.sessionSecret],
    ['AUTH_PIN_SALT', authConfig.pinSalt],
    ['AUTH_PIN_HASH', authConfig.pinHash],
    ['AUTH_WEBAUTHN_RP_ID', authConfig.webAuthnRpID],
    ['AUTH_WEBAUTHN_ORIGIN', authConfig.webAuthnOrigin],
  ]

  const missing = required.filter(([, value]) => !value).map(([key]) => key)
  if (missing.length) {
    throw new Error(`Missing required auth env vars: ${missing.join(', ')}`)
  }
}


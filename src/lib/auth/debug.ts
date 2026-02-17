const isEnabled = () => process.env.AUTH_DEBUG === 'true'

export function authLog(event: string, details?: Record<string, unknown>) {
  if (!isEnabled()) return
  if (details) {
    console.info(`[AUTH_DEBUG] ${event}`, details)
    return
  }
  console.info(`[AUTH_DEBUG] ${event}`)
}

export function authErrorPayload(error: unknown, fallback: string) {
  const err = error as { name?: string; message?: string; stack?: string }
  if (!isEnabled()) {
    return { error: err?.message || fallback }
  }

  return {
    error: err?.message || fallback,
    debug: {
      name: err?.name || 'UnknownError',
      message: err?.message || fallback,
      stack: err?.stack?.split('\n').slice(0, 5).join('\n') || '',
    },
  }
}


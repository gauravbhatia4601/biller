'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, Label, TextInput } from 'flowbite-react'
import { startAuthentication } from '@simplewebauthn/browser'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pin, setPin] = useState('')
  const [loadingPin, setLoadingPin] = useState(false)
  const [loadingBio, setLoadingBio] = useState(false)
  const [message, setMessage] = useState('')
  const [hasBiometric, setHasBiometric] = useState(false)

  const nextPath = searchParams.get('next') || '/dashboard'

  useEffect(() => {
    const checkSession = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) return
      const data = await res.json()
      setHasBiometric(Boolean(data.hasBiometric))
      if (data.authenticated) router.replace(nextPath)
    }
    checkSession()
  }, [nextPath, router])

  const handlePinLogin = async (event: FormEvent) => {
    event.preventDefault()
    setLoadingPin(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/pin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'PIN login failed.')
        return
      }
      router.replace(nextPath)
    } catch {
      setMessage('PIN login failed.')
    } finally {
      setLoadingPin(false)
    }
  }

  const handleFingerprintLogin = async () => {
    if (!window.PublicKeyCredential) {
      setMessage('This browser does not support fingerprint/WebAuthn.')
      return
    }
    setLoadingBio(true)
    setMessage('')
    try {
      const optionsRes = await fetch('/api/auth/webauthn/login/options', { method: 'POST' })
      const optionsData = await optionsRes.json()
      if (!optionsRes.ok) {
        setMessage(optionsData.error || 'Fingerprint sign-in unavailable.')
        return
      }

      const assertionResponse = await startAuthentication({ optionsJSON: optionsData })
      const verifyRes = await fetch('/api/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertionResponse }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) {
        setMessage(verifyData.error || 'Fingerprint verification failed.')
        return
      }
      router.replace(nextPath)
    } catch {
      setMessage('Fingerprint sign-in failed.')
    } finally {
      setLoadingBio(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Biller</h1>
          <p className="text-sm text-gray-600">Sign in with your PIN or fingerprint.</p>
        </div>

        <form onSubmit={handlePinLogin} className="space-y-3">
          <div>
            <Label htmlFor="pin">PIN</Label>
            <TextInput
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              minLength={4}
              maxLength={12}
              required
            />
          </div>
          <Button type="submit" disabled={loadingPin} className="w-full">
            {loadingPin ? 'Unlocking...' : 'Unlock with PIN'}
          </Button>
        </form>

        <div className="my-2 text-center text-xs text-gray-500">or</div>

        <Button
          color="light"
          className="w-full"
          disabled={loadingBio || !hasBiometric}
          onClick={handleFingerprintLogin}
        >
          {loadingBio ? 'Verifying...' : 'Use Fingerprint'}
        </Button>
        {!hasBiometric && (
          <p className="text-xs text-gray-500 mt-2">
            Fingerprint is not registered yet. Sign in with PIN, then open Security settings to enroll.
          </p>
        )}
        {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
      </Card>
    </main>
  )
}


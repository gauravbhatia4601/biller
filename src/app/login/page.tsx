'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, Label, TextInput, Spinner } from 'flowbite-react'
import { startAuthentication } from '@simplewebauthn/browser'

type ProcessState = 'idle' | 'loading' | 'success' | 'error'
type MessageType = 'error' | 'success' | 'info'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pin, setPin] = useState('')
  const [pinState, setPinState] = useState<ProcessState>('idle')
  const [bioState, setBioState] = useState<ProcessState>('idle')
  const [processMessage, setProcessMessage] = useState('')
  const [processType, setProcessType] = useState<MessageType>('info')
  const [bioStep, setBioStep] = useState('Idle')
  const [hasBiometric, setHasBiometric] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const nextPath = searchParams.get('next') || '/dashboard'

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session')
        if (!res.ok) return
        const data = await res.json()
        setHasBiometric(Boolean(data.hasBiometric))
        if (data.authenticated) router.replace(nextPath)
      } finally {
        setCheckingSession(false)
      }
    }
    checkSession()
  }, [nextPath, router])

  const handlePinLogin = async (event: FormEvent) => {
    event.preventDefault()
    setPinState('loading')
    setProcessType('info')
    setProcessMessage('Verifying PIN...')
    try {
      const res = await fetch('/api/auth/pin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPinState('error')
        setProcessType('error')
        setProcessMessage(data.error || 'PIN login failed.')
        return
      }
      setPinState('success')
      setProcessType('success')
      setProcessMessage('PIN verified. Redirecting...')
      router.replace(nextPath)
    } catch {
      setPinState('error')
      setProcessType('error')
      setProcessMessage('PIN login failed.')
    } finally {
      if (pinState !== 'success') {
        setTimeout(() => setPinState('idle'), 1000)
      }
    }
  }

  const handleFingerprintLogin = async () => {
    if (!window.PublicKeyCredential) {
      setBioState('error')
      setProcessType('error')
      setProcessMessage('This browser does not support fingerprint/WebAuthn.')
      return
    }
    setBioState('loading')
    setProcessType('info')
    setBioStep('Requesting secure challenge...')
    setProcessMessage('Starting fingerprint authentication...')
    try {
      const optionsRes = await fetch('/api/auth/webauthn/login/options', { method: 'POST' })
      const optionsData = await optionsRes.json()
      if (!optionsRes.ok) {
        setBioState('error')
        setProcessType('error')
        setProcessMessage(optionsData.error || 'Fingerprint sign-in unavailable.')
        return
      }

      setBioStep('Waiting for fingerprint confirmation on device...')
      const assertionResponse = await startAuthentication({ optionsJSON: optionsData })
      setBioStep('Verifying signed credential...')
      const verifyRes = await fetch('/api/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertionResponse }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) {
        setBioState('error')
        setProcessType('error')
        setProcessMessage(verifyData.error || 'Fingerprint verification failed.')
        return
      }
      setBioState('success')
      setProcessType('success')
      setBioStep('Fingerprint validated.')
      setProcessMessage('Fingerprint verified. Redirecting...')
      router.replace(nextPath)
    } catch {
      setBioState('error')
      setProcessType('error')
      setProcessMessage('Fingerprint sign-in failed.')
    } finally {
      if (bioState !== 'success') {
        setTimeout(() => {
          setBioState('idle')
          setBioStep('Idle')
        }, 1000)
      }
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-200 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-4xl !p-0 overflow-hidden border border-slate-200 shadow-xl">
        <div className="grid md:grid-cols-2">
          <div className="bg-slate-900 text-white p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-slate-300">Secure Access</p>
              <h1 className="text-4xl font-bold mt-2">Biller</h1>
              <p className="text-slate-200 mt-3">
                Protected owner access with PIN and biometric authentication.
              </p>
            </div>
            <div className="mt-10">
              <p className="text-xs text-slate-300 uppercase tracking-widest mb-2">Live Status</p>
              <div className="rounded-lg bg-slate-800/80 border border-slate-700 px-4 py-3 text-sm">
                {checkingSession ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" /> Checking session...
                  </span>
                ) : (
                  <>
                    <p className="text-slate-100">{processMessage || 'Waiting for authentication input.'}</p>
                    <p className="text-slate-300 mt-1">Biometric Step: {bioStep}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
              <p className="text-sm text-slate-600 mt-1">Use your PIN or fingerprint to unlock dashboard access.</p>
            </div>

            <form onSubmit={handlePinLogin} className="space-y-4">
              <div>
                <Label htmlFor="pin">PIN</Label>
                <TextInput
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
                  minLength={4}
                  maxLength={12}
                  required
                  placeholder="Enter your PIN"
                />
              </div>
              <Button type="submit" disabled={pinState === 'loading'} className="w-full">
                {pinState === 'loading' ? 'Verifying PIN...' : 'Sign in with PIN'}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs uppercase tracking-wider text-slate-400">Or</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <Button
              color="light"
              className="w-full"
              disabled={bioState === 'loading' || !hasBiometric}
              onClick={handleFingerprintLogin}
            >
              {bioState === 'loading' ? 'Authenticating Fingerprint...' : 'Use Fingerprint'}
            </Button>

            <p className="text-xs text-slate-500 mt-3">
              {hasBiometric
                ? 'Fingerprint is registered on this account.'
                : 'Fingerprint is not registered yet. Sign in with PIN, then enroll in Security settings.'}
            </p>

            {processMessage && (
              <div
                className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                  processType === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : processType === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {processMessage}
              </div>
            )}
          </div>
        </div>
      </Card>
    </main>
  )
}


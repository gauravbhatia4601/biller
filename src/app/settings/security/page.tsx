'use client'

import { useState } from 'react'
import { Card, Button } from 'flowbite-react'
import { startRegistration } from '@simplewebauthn/browser'
import Navigation from '@/components/Navigation'

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const registerFingerprint = async () => {
    if (!window.PublicKeyCredential) {
      setError('This browser/device does not support fingerprint/WebAuthn.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const optionsRes = await fetch('/api/auth/webauthn/register/options', { method: 'POST' })
      const optionsData = await optionsRes.json()
      if (!optionsRes.ok) {
        setError(optionsData.error || 'Unable to create fingerprint challenge.')
        return
      }

      const registrationResponse = await startRegistration({ optionsJSON: optionsData })
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: registrationResponse }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) {
        setError(verifyData.error || 'Fingerprint registration failed.')
        return
      }

      setMessage('Fingerprint registered successfully. You can now sign in biometrically.')
    } catch {
      setError('Fingerprint registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Card>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Security</h1>
          <p className="text-sm text-gray-600 mb-4">
            Register your device fingerprint (WebAuthn platform authenticator) for fast secure login.
          </p>
          <Button onClick={registerFingerprint} disabled={loading}>
            {loading ? 'Registering...' : 'Register Fingerprint'}
          </Button>
          {message && <p className="text-sm text-green-700 mt-3">{message}</p>}
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </Card>
      </main>
    </div>
  )
}


'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Button, Badge, Spinner, TextInput } from 'flowbite-react'
import { startRegistration } from '@simplewebauthn/browser'
import Navigation from '@/components/Navigation'

type SetupState = 'idle' | 'requesting' | 'awaiting_user' | 'verifying' | 'success' | 'error'
type Credential = {
  credentialID: string
  label: string
  deviceType: string
  backedUp: boolean
  transports: string[]
  createdAt: string | null
  lastUsedAt: string | null
}

export default function SecuritySettingsPage() {
  const [setupState, setSetupState] = useState<SetupState>('idle')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [hasBiometric, setHasBiometric] = useState(false)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loadingCredentials, setLoadingCredentials] = useState(true)
  const [editingCredentialId, setEditingCredentialId] = useState('')
  const [editingLabel, setEditingLabel] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const appendDebug = (log: string) => {
    setDebugLogs((prev) => [new Date().toLocaleTimeString() + ' - ' + log, ...prev].slice(0, 10))
  }

  const loadCredentials = useCallback(async () => {
    try {
      setLoadingCredentials(true)
      const res = await fetch('/api/auth/webauthn/credentials')
      const data = await res.json()
      if (!res.ok) {
        appendDebug(`Credentials load failed: HTTP ${res.status}`)
        return
      }
      setCredentials(data.credentials || [])
      appendDebug(`Loaded ${data.credentials?.length || 0} credential(s)`)
    } catch {
      appendDebug('Credentials load failed unexpectedly')
    } finally {
      setLoadingCredentials(false)
    }
  }, [])

  useEffect(() => {
    const loadState = async () => {
      try {
        appendDebug(`Current origin: ${window.location.origin}`)
        appendDebug(`Current host: ${window.location.hostname}`)
        appendDebug(`PublicKeyCredential available: ${Boolean(window.PublicKeyCredential)}`)
        if (window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
          const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          appendDebug(`Platform authenticator available: ${available}`)
        }

        const res = await fetch('/api/auth/session')
        if (!res.ok) return
        const data = await res.json()
        setHasBiometric(Boolean(data.hasBiometric))
        appendDebug(`Session loaded. hasBiometric=${Boolean(data.hasBiometric)}`)
        await loadCredentials()
      } finally {
        setLoadingProfile(false)
      }
    }
    loadState()
  }, [loadCredentials])

  const isBusy = ['requesting', 'awaiting_user', 'verifying'].includes(setupState)

  const currentStepLabel = useMemo(() => {
    if (setupState === 'requesting') return 'Requesting challenge from server...'
    if (setupState === 'awaiting_user') return 'Waiting for fingerprint confirmation on your device...'
    if (setupState === 'verifying') return 'Verifying and storing credential...'
    if (setupState === 'success') return 'Fingerprint has been registered successfully.'
    if (setupState === 'error') return 'Fingerprint registration failed.'
    return 'Ready to start enrollment.'
  }, [setupState])

  const registerFingerprint = async () => {
    if (!window.PublicKeyCredential) {
      setError('This browser/device does not support fingerprint/WebAuthn.')
      setSetupState('error')
      appendDebug('Registration blocked: PublicKeyCredential not available')
      return
    }
    setSetupState('requesting')
    setError('')
    setMessage('')

    try {
      appendDebug('Requesting registration options...')
      const optionsRes = await fetch('/api/auth/webauthn/register/options', { method: 'POST' })
      const optionsData = await optionsRes.json()
      if (!optionsRes.ok) {
        setError(optionsData.error || 'Unable to create fingerprint challenge.')
        if (optionsData?.debug?.name || optionsData?.debug?.message) {
          appendDebug(`Server debug: ${optionsData.debug.name || 'Error'} - ${optionsData.debug.message || ''}`)
        }
        appendDebug(`Options request failed: HTTP ${optionsRes.status}`)
        setSetupState('error')
        return
      }
      appendDebug('Registration challenge received successfully')

      setSetupState('awaiting_user')
      const registrationResponse = await startRegistration({ optionsJSON: optionsData })
      appendDebug('Device biometric prompt completed; verifying credential...')
      setSetupState('verifying')
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: registrationResponse }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) {
        setError(verifyData.error || 'Fingerprint registration failed.')
        if (verifyData?.debug?.name || verifyData?.debug?.message) {
          appendDebug(`Server debug: ${verifyData.debug.name || 'Error'} - ${verifyData.debug.message || ''}`)
        }
        appendDebug(`Verify request failed: HTTP ${verifyRes.status}`)
        setSetupState('error')
        return
      }

      setMessage('Fingerprint registered successfully. You can now sign in biometrically.')
      appendDebug('Fingerprint registered successfully')
      setHasBiometric(true)
      await loadCredentials()
      setSetupState('success')
    } catch (err: any) {
      setError(err?.message || 'Fingerprint registration failed.')
      appendDebug(`Browser error: ${err?.name || 'Error'} - ${err?.message || 'Unknown error'}`)
      setSetupState('error')
    }
  }

  const startRename = (credential: Credential) => {
    setEditingCredentialId(credential.credentialID)
    setEditingLabel(credential.label)
  }

  const cancelRename = () => {
    setEditingCredentialId('')
    setEditingLabel('')
  }

  const saveRename = async (credentialID: string) => {
    const nextLabel = editingLabel.trim()
    if (!nextLabel) {
      setError('Fingerprint name cannot be empty.')
      return
    }
    try {
      setActionLoadingId(credentialID)
      setError('')
      const res = await fetch(`/api/auth/webauthn/credentials/${encodeURIComponent(credentialID)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: nextLabel }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to rename fingerprint.')
        appendDebug(`Rename failed: HTTP ${res.status}`)
        return
      }
      appendDebug(`Renamed credential ${credentialID}`)
      setMessage('Fingerprint renamed successfully.')
      cancelRename()
      await loadCredentials()
    } catch {
      setError('Failed to rename fingerprint.')
    } finally {
      setActionLoadingId('')
    }
  }

  const deleteCredential = async (credentialID: string) => {
    const confirmed = window.confirm('Delete this fingerprint credential? This action cannot be undone.')
    if (!confirmed) return

    try {
      setActionLoadingId(credentialID)
      setError('')
      const res = await fetch(`/api/auth/webauthn/credentials/${encodeURIComponent(credentialID)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete fingerprint.')
        appendDebug(`Delete failed: HTTP ${res.status}`)
        return
      }
      appendDebug(`Deleted credential ${credentialID}`)
      setMessage('Fingerprint deleted successfully.')
      await loadCredentials()
      const updatedSession = await fetch('/api/auth/session')
      if (updatedSession.ok) {
        const sessionData = await updatedSession.json()
        setHasBiometric(Boolean(sessionData.hasBiometric))
      }
    } catch {
      setError('Failed to delete fingerprint.')
    } finally {
      setActionLoadingId('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-200">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="border border-slate-200 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Security Settings</h1>
              <p className="text-sm text-slate-600 mt-1">
                Enroll a platform authenticator to allow secure fingerprint sign-in.
              </p>
            </div>
            <Badge color={hasBiometric ? 'success' : 'warning'}>
              {loadingProfile ? 'Checking...' : hasBiometric ? 'Biometric Enrolled' : 'Not Enrolled'}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Process Status</p>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                {isBusy ? <Spinner size="sm" /> : <span className="h-2 w-2 rounded-full bg-slate-400" />}
                <span>{currentStepLabel}</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Security Notes</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                <li>- Uses WebAuthn platform authenticator (fingerprint/face).</li>
                <li>- Credential is bound to this domain and browser context.</li>
                <li>- Keep PIN access as backup in case device changes.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-slate-500">Enrolled Fingerprints</p>
              <Button size="xs" color="light" onClick={loadCredentials} disabled={loadingCredentials}>
                {loadingCredentials ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            {loadingCredentials ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Spinner size="sm" />
                Loading credentials...
              </div>
            ) : credentials.length === 0 ? (
              <p className="text-sm text-slate-500">No fingerprint credentials enrolled yet.</p>
            ) : (
              <div className="space-y-3">
                {credentials.map((credential) => (
                  <div
                    key={credential.credentialID}
                    className="rounded-lg border border-slate-200 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      {editingCredentialId === credential.credentialID ? (
                        <TextInput
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          maxLength={50}
                        />
                      ) : (
                        <p className="text-sm font-medium text-slate-900">{credential.label}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        Added:{' '}
                        {credential.createdAt ? new Date(credential.createdAt).toLocaleString() : 'Unknown'} | Last used:{' '}
                        {credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleString() : 'Never'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingCredentialId === credential.credentialID ? (
                        <>
                          <Button
                            size="xs"
                            color="blue"
                            disabled={actionLoadingId === credential.credentialID}
                            onClick={() => saveRename(credential.credentialID)}
                          >
                            Save
                          </Button>
                          <Button size="xs" color="light" onClick={cancelRename}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="xs" color="light" onClick={() => startRename(credential)}>
                            Rename
                          </Button>
                          <Button
                            size="xs"
                            color="failure"
                            disabled={actionLoadingId === credential.credentialID}
                            onClick={() => deleteCredential(credential.credentialID)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={registerFingerprint} disabled={isBusy} color="blue" className="w-full md:w-auto">
            {setupState === 'requesting' && 'Requesting Challenge...'}
            {setupState === 'awaiting_user' && 'Waiting for Fingerprint...'}
            {setupState === 'verifying' && 'Verifying Credential...'}
            {!isBusy && 'Register Fingerprint'}
          </Button>

          {message && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {!error && !message && (
            <p className="mt-4 text-xs text-slate-500">
              Tip: you can re-register on a new device anytime after signing in with your PIN.
            </p>
          )}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">Debug Logs</p>
            <div className="mt-2 space-y-1 text-xs text-slate-700">
              {debugLogs.length === 0 ? (
                <p>No logs yet.</p>
              ) : (
                debugLogs.map((line, idx) => (
                  <p key={`${line}-${idx}`} className="break-all">
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}


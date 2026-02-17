import mongoose from 'mongoose'

const webAuthnCredentialSchema = new mongoose.Schema(
  {
    credentialID: { type: String, required: true },
    label: { type: String, default: '' },
    credentialPublicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: [{ type: String }],
    deviceType: { type: String, default: 'singleDevice' },
    backedUp: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: null },
  },
  { _id: false }
)

const authStateSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, required: true, unique: true, default: 'owner' },
    pinFailedAttempts: { type: Number, default: 0 },
    pinLockUntil: { type: Date, default: null },
    currentChallenge: { type: String, default: null },
    challengeExpiresAt: { type: Date, default: null },
    webAuthnCredentials: { type: [webAuthnCredentialSchema], default: [] },
  },
  {
    timestamps: true,
  }
)

const AuthState = mongoose.models.AuthState || mongoose.model('AuthState', authStateSchema)

export default AuthState


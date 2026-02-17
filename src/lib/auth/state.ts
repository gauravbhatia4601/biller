import AuthState from '@/models/AuthState'
import { connectDB } from '@/lib/db'

export async function getAuthState() {
  await connectDB()
  const state = await AuthState.findOneAndUpdate(
    { singletonKey: 'owner' },
    { $setOnInsert: { singletonKey: 'owner' } },
    { upsert: true, new: true }
  )
  return state
}


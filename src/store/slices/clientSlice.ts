import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { clientsApi } from '@/lib/api'

interface Client {
  _id?: string
  name: string
  company?: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  vatId?: string
  notes?: string
}

interface ClientState {
  clients: Client[]
  loading: boolean
  error: string | null
}

const initialState: ClientState = {
  clients: [],
  loading: false,
  error: null,
}

export const fetchClients = createAsyncThunk('clients/fetchAll', async () => {
  const response = await clientsApi.getAll()
  return response.data
})

export const fetchClient = createAsyncThunk('clients/fetchOne', async (id: string) => {
  const response = await clientsApi.getById(id)
  return response.data
})

export const createClient = createAsyncThunk('clients/create', async (data: Client) => {
  const response = await clientsApi.create(data)
  return response.data
})

export const updateClient = createAsyncThunk(
  'clients/update',
  async ({ id, data }: { id: string; data: Client }) => {
    const response = await clientsApi.update(id, data)
    return response.data
  }
)

export const deleteClient = createAsyncThunk('clients/delete', async (id: string) => {
  await clientsApi.delete(id)
  return id
})

const clientSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClients.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading = false
        state.clients = action.payload
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch clients'
      })
      .addCase(createClient.fulfilled, (state, action) => {
        state.clients.unshift(action.payload)
      })
      .addCase(updateClient.fulfilled, (state, action) => {
        const index = state.clients.findIndex((c) => c._id === action.payload._id)
        if (index !== -1) {
          state.clients[index] = action.payload
        }
      })
      .addCase(deleteClient.fulfilled, (state, action) => {
        state.clients = state.clients.filter((c) => c._id !== action.payload)
      })
  },
})

export const { clearError } = clientSlice.actions
export default clientSlice.reducer

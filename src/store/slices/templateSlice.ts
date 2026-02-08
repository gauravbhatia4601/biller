import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { templatesApi } from '@/lib/api'

interface Template {
  _id?: string
  templateName: string
  company: any
  customer: any
  invoice: any
  items: any[]
  fields: any
  financial: any
  notes?: string
  terms?: string
  createdAt?: string
}

interface TemplateState {
  templates: Template[]
  loading: boolean
  error: string | null
}

const initialState: TemplateState = {
  templates: [],
  loading: false,
  error: null,
}

export const fetchTemplates = createAsyncThunk('templates/fetchAll', async () => {
  const response = await templatesApi.getAll()
  return response.data
})

export const createTemplate = createAsyncThunk('templates/create', async (data: Template) => {
  const response = await templatesApi.create(data)
  return response.data
})

export const deleteTemplate = createAsyncThunk('templates/delete', async (id: string) => {
  await templatesApi.delete(id)
  return id
})

export const createInvoiceFromTemplate = createAsyncThunk(
  'templates/createInvoice',
  async ({ id, data }: { id: string; data: any }) => {
    const response = await templatesApi.createInvoice(id, data)
    return response.data
  }
)

const templateSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading = false
        state.templates = action.payload
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch templates'
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.templates.unshift(action.payload)
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter((t) => t._id !== action.payload)
      })
  },
})

export const { clearError } = templateSlice.actions
export default templateSlice.reducer

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { invoicesApi } from '@/lib/api'

interface InvoiceItem {
  name: string
  description?: string
  quantity: number
  unit_cost: number
}

interface Invoice {
  _id?: string
  company: {
    name: string
    tagline?: string
    logo?: string
    phone?: string
    email?: string
    address?: string
    city?: string
    country?: string
    vatId?: string
  }
  customer: {
    name: string
    company?: string
    address?: string
    city?: string
    country?: string
    phone?: string
    email?: string
    vatId?: string
  }
  invoice: {
    number: string
    date: string
    dueDate?: string
    currency?: string
    paymentTerms?: string
    purchaseOrder?: string
  }
  items: InvoiceItem[]
  fields: {
    tax: string
    discounts: boolean
    shipping: boolean
  }
  financial: {
    tax: number
    shipping: number
    discounts: number
    amountPaid: number
  }
  accountDetails?: {
    bankName?: string
    accountHolderName?: string
    accountNumber?: string
    iban?: string
    swiftBic?: string
    branchName?: string
    branchAddress?: string
  }
  notes?: string
  terms?: string
  pdfPath?: string
  isTemplate?: boolean
  templateName?: string
  status?: 'unpaid' | 'partial' | 'paid'
  amountPaid?: number
  recurring?: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly' | 'every_n_days'
    intervalDays: number
    dueInDays: number
    nextRunDate?: string
    autoGeneratePdf: boolean
    lastRunAt?: string | null
    sourceInvoiceId?: string | null
  }
}

interface InvoiceState {
  invoices: Invoice[]
  currentInvoice: Invoice | null
  loading: boolean
  error: string | null
  stats: {
    totalInvoices: number
    totalTemplates: number
    totalRevenue: number
    totalUnpaidRevenue: number
    recentInvoices: (Invoice & { total: number; createdAt: string })[]
  } | null
}

const initialState: InvoiceState = {
  invoices: [],
  currentInvoice: null,
  loading: false,
  error: null,
  stats: null,
}

// Async thunks
export const fetchInvoices = createAsyncThunk('invoices/fetchAll', async () => {
  const response = await invoicesApi.getAll()
  return response.data
})

export const fetchInvoice = createAsyncThunk('invoices/fetchOne', async (id: string) => {
  const response = await invoicesApi.getById(id)
  return response.data
})

export const createInvoice = createAsyncThunk('invoices/create', async (data: Invoice) => {
  const response = await invoicesApi.create(data)
  return response.data
})

export const updateInvoice = createAsyncThunk(
  'invoices/update',
  async ({ id, data }: { id: string; data: Invoice }) => {
    const response = await invoicesApi.update(id, data)
    return response.data
  }
)

export const deleteInvoice = createAsyncThunk('invoices/delete', async (id: string) => {
  await invoicesApi.delete(id)
  return id
})

export const generatePDF = createAsyncThunk('invoices/generatePDF', async (id: string) => {
  const response = await invoicesApi.generatePDF(id)
  return response.data
})

export const fetchStats = createAsyncThunk('invoices/fetchStats', async () => {
  const response = await invoicesApi.getStats()
  return response.data
})

export const updateInvoiceStatus = createAsyncThunk(
  'invoices/updateStatus',
  async ({ id, status, amountPaid }: { id: string; status: 'unpaid' | 'partial' | 'paid'; amountPaid?: number }) => {
    const response = await invoicesApi.updateStatus(id, status, amountPaid)
    return response.data
  }
)

const invoiceSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    setCurrentInvoice: (state, action: PayloadAction<Invoice | null>) => {
      state.currentInvoice = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchInvoices.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false
        state.invoices = action.payload
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch invoices'
      })
      // Fetch one
      .addCase(fetchInvoice.fulfilled, (state, action) => {
        state.currentInvoice = action.payload
      })
      // Create
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.invoices.unshift(action.payload)
        state.currentInvoice = action.payload
      })
      // Update
      .addCase(updateInvoice.fulfilled, (state, action) => {
        const index = state.invoices.findIndex((inv) => inv._id === action.payload._id)
        if (index !== -1) {
          state.invoices[index] = action.payload
        }
        if (state.currentInvoice?._id === action.payload._id) {
          state.currentInvoice = action.payload
        }
      })
      // Delete
      .addCase(deleteInvoice.fulfilled, (state, action) => {
        state.invoices = state.invoices.filter((inv) => inv._id !== action.payload)
        if (state.currentInvoice?._id === action.payload) {
          state.currentInvoice = null
        }
      })
      // Generate PDF
      .addCase(generatePDF.fulfilled, (state, action) => {
        const invoice = state.invoices.find((inv) => inv._id === action.payload.invoice._id)
        if (invoice) {
          invoice.pdfPath = action.payload.pdfUrl
        }
        if (state.currentInvoice && state.currentInvoice._id === action.payload.invoice._id) {
          state.currentInvoice.pdfPath = action.payload.pdfUrl
        }
      })
      // Stats
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.stats = action.payload
      })
      // Update Status - just handle the async operation, don't update state
      // The listing APIs (fetchStats/fetchInvoices) will refresh the data with correct format
      .addCase(updateInvoiceStatus.fulfilled, (state) => {
        // Status update completed successfully, but don't update state here
        // The component will call fetchStats/fetchInvoices to refresh with correct format
      })
  },
})

export const { setCurrentInvoice, clearError } = invoiceSlice.actions
export default invoiceSlice.reducer

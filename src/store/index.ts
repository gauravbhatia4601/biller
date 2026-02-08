import { configureStore } from '@reduxjs/toolkit'
import invoiceReducer from './slices/invoiceSlice'
import clientReducer from './slices/clientSlice'
import templateReducer from './slices/templateSlice'

export const store = configureStore({
  reducer: {
    invoices: invoiceReducer,
    clients: clientReducer,
    templates: templateReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

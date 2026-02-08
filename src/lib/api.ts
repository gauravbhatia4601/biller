import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Invoices API
export const invoicesApi = {
  getAll: () => api.get('/invoices'),
  getById: (id: string) => api.get(`/invoices/${id}`),
  create: (data: any) => api.post('/invoices', data),
  update: (id: string, data: any) => api.put(`/invoices/${id}`, data),
  delete: (id: string) => api.delete(`/invoices/${id}`),
  generatePDF: (id: string) => api.post(`/invoices/${id}/generate`),
  getStats: () => api.get('/invoices/stats/summary'),
  getNextInvoiceNumber: () => api.get('/invoices/next-number'),
  updateStatus: (id: string, status: 'unpaid' | 'partial' | 'paid', amountPaid?: number) =>
    api.patch(`/invoices/${id}/status`, { status, amountPaid }),
}

// Clients API
export const clientsApi = {
  getAll: () => api.get('/clients'),
  getById: (id: string) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
}

// Templates API
export const templatesApi = {
  getAll: () => api.get('/templates'),
  getById: (id: string) => api.get(`/templates/${id}`),
  create: (data: any) => api.post('/templates', data),
  update: (id: string, data: any) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
  createInvoice: (id: string, data: any) => api.post(`/templates/${id}/create-invoice`, data),
}

export default api

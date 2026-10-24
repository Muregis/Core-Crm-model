import api from './api'

export const invoiceService = {
  getInvoices: (params) => api.get('/invoices', { params }),
  getInvoice: (id) => api.get(`/invoices/${id}`),
  getAgingReport: () => api.get('/invoices/aging/report'),
  createInvoice: (data) => api.post('/invoices', data),
  convertQuoteToInvoice: (id) => api.post(`/invoices/${id}/convert-to-invoice`),
}

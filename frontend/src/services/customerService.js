import api from './api'

export const customerService = {
  getCustomers: (params) => api.get('/customers', { params }),
  getCustomer: (id) => api.get(`/customers/${id}`),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  deleteCustomer: (id) => api.delete(`/customers/${id}`),
  exportKdpaData: (id) => api.get(`/customers/${id}/kdpa-export`),
  anonymizeCustomer: (id) => api.post(`/customers/${id}/anonymize`),
}

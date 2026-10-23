import api from './api'

export const mpesaService = {
  getTransactions: (params) => api.get('/mpesa', { params }),
  simulateC2B: (data) => api.post('/mpesa/c2b-simulate', data),
  getCredentials: () => api.get('/mpesa/credentials'),
  saveCredentials: (data) => api.post('/mpesa/credentials', data),
  stkPush: (data) => api.post('/mpesa/stkpush', data),
}

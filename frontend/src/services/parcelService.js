import api from './api'

export const parcelService = {
  getParcels: (params) => api.get('/parcels', { params }),
  getParcel: (id) => api.get(`/parcels/${id}`),
  createParcel: (data) => api.post('/parcels', data),
  updateParcel: (id, data) => api.put(`/parcels/${id}`, data),
  updateStatus: (id, data) => api.post(`/parcels/${id}/status`, data),
  getStatusHistory: (id) => api.get(`/parcels/${id}/history`),
  getPlotMatrix: () => api.get('/parcels/matrix/overview'),
  reserveHold: (id, data) => api.post(`/parcels/${id}/hold`, data),
  releaseHold: (id) => api.post(`/parcels/${id}/release-hold`),
  convertSale: (id, data) => api.post(`/parcels/${id}/convert-sale`, data),
  getInstallments: (params) => api.get('/parcels/installments/list', { params }),
  createInstallmentPlan: (data) => api.post('/parcels/installments/plan', data),
  matchInstallmentMpesa: (id, data) => api.post(`/parcels/installments/${id}/match-mpesa`, data),
  getSiteVisits: () => api.get('/parcels/site-visits/list'),
  createSiteVisit: (data) => api.post('/parcels/site-visits', data),
  bookSiteVisitPassenger: (id, data) => api.post(`/parcels/site-visits/${id}/book`, data),
}

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
}

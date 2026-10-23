import api from './api'

export const conveyancingService = {
  getMatters: (params) => api.get('/conveyancing', { params }),
  createMatter: (data) => api.post('/conveyancing', data),
  updateStage: (id, data) => api.put(`/conveyancing/${id}/stage`, data),
}

import api from './api'

export const matterService = {
  getMatters: (params) => api.get('/matters', { params }),
  getMatter: (id) => api.get(`/matters/${id}`),
  createMatter: (data) => api.post('/matters', data),
  updateMatter: (id, data) => api.put(`/matters/${id}`, data),
  logTimeEntry: (id, data) => api.post(`/matters/${id}/time-entries`, data),
  deleteMatter: (id) => api.delete(`/matters/${id}`),
}

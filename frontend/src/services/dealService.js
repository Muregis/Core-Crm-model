import api from './api'

export const dealService = {
  getDeals: (params) => api.get('/deals', { params }),
  getDeal: (id) => api.get(`/deals/${id}`),
  createDeal: (data) => api.post('/deals', data),
  updateDeal: (id, data) => api.put(`/deals/${id}`, data),
  deleteDeal: (id) => api.delete(`/deals/${id}`),
  updateDealStage: (id, stageId) => api.put(`/deals/${id}/stage`, { stageId }),
  getDealStages: () => api.get('/deals/stages'),
}

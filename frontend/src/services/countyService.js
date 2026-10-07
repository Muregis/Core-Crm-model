import api from './api'

export const countyService = {
  getCounties: () => api.get('/counties'),
  getSubCounties: (countyId) => api.get(`/counties/${countyId}/sub-counties`),
  getBusinessCategories: () => api.get('/counties/business-categories'),
  getCustomerTags: () => api.get('/customers/tags'),
  getDealStages: () => api.get('/deals/stages'),
}

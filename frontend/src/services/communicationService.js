import api from './api'

export const communicationService = {
  getCommunications: (params) => api.get('/communications', { params }),
  logCommunication: (data) => api.post('/communications', data),
  sendEmail: (data) => api.post('/communications/email', data),
  deleteCommunication: (id) => api.delete(`/communications/${id}`),
}

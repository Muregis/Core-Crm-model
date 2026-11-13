import api from './api'

export const ticketService = {
  getTickets: (params) => api.get('/tickets', { params }),
  getTicket: (id) => api.get(`/tickets/${id}`),
  createTicket: (data) => api.post('/tickets', data),
  updateTicket: (id, data) => api.patch(`/tickets/${id}`, data),
  deleteTicket: (id) => api.delete(`/tickets/${id}`),

  // Lifecycle & status transitions
  transitionStatus: (id, status, notes) =>
    api.patch(`/tickets/${id}/status`, { status, notes }),

  // Technician scheduling & dispatch
  scheduleTicket: (id, data) => api.post(`/tickets/${id}/schedule`, data),

  // Landlord approval workflow
  handleApproval: (id, data) => api.post(`/tickets/${id}/approval`, data),

  // Cost and margin accounting
  recordCosts: (id, data) => api.post(`/tickets/${id}/costs`, data),

  // Attachments & photos
  getAttachments: (ticketId) => api.get(`/tickets/${ticketId}/attachments`),
  addAttachment: (ticketId, data) => api.post(`/tickets/${ticketId}/attachments`, data),

  // Dashboard & analytics
  getDashboardStats: () => api.get('/tickets/dashboard/stats'),
  getClientExperienceMetrics: () =>
    api.get('/tickets/dashboard/client-experience-metrics'),
  getCompanyPlanMetrics: () => api.get('/tickets/dashboard/company-plan'),
  getFinancialModel: () => api.get('/tickets/dashboard/financial-model'),

  // Sawa Care contracts & conversion
  getRepeatCustomers: () => api.get('/tickets/sawa-care/eligible'),
  getSawaCareContracts: () => api.get('/tickets/sawa-care/contracts'),
  createSawaCareContract: (data) =>
    api.post('/tickets/sawa-care/contracts', data),
  getSawaCareContract: (id) => api.get(`/tickets/sawa-care/contracts/${id}`),
  updateSawaCareContract: (id, data) =>
    api.patch(`/tickets/sawa-care/contracts/${id}`, data)
}

export default ticketService

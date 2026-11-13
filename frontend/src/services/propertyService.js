import api from './api'

export const propertyService = {
  getProperties: (params) => api.get('/properties', { params }),
  getProperty: (id) => api.get(`/properties/${id}`),
  createProperty: (data) => api.post('/properties', data),
  updateProperty: (id, data) => api.patch(`/properties/${id}`, data),
  deleteProperty: (id) => api.delete(`/properties/${id}`),

  // Property Maintenance Memory & Health Score
  getMaintenanceMemory: (id) => api.get(`/properties/${id}/maintenance-memory`),

  // Landlord consolidated monthly statements
  getLandlordMonthlyReport: (customerId, monthYear) =>
    api.get(`/properties/landlord/${customerId}/monthly-report`, {
      params: { monthYear }
    }),

  // Preventive Maintenance Inspection Engine
  getPreventiveInspections: (propertyId = null, params = {}) =>
    propertyId
      ? api.get(`/properties/${propertyId}/preventive-inspections`, { params })
      : api.get('/properties/preventive-inspections', { params }),

  schedulePreventiveInspection: (propertyId, data) =>
    api.post(`/properties/${propertyId}/preventive-inspections`, data),

  completePreventiveInspection: (inspectionId, data) =>
    api.patch(`/properties/preventive-inspections/${inspectionId}`, data)
}

export default propertyService

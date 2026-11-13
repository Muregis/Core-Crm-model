// frontend/src/services/pricingConfigService.js
// Effective-Dated Pricing Drivers & Financial Observability Model (v2.0)
import api from './api'

export const pricingConfigService = {
  // Fetch active drivers and key-value driver map
  getActiveDrivers: (asOfDate) =>
    api.get('/pricing-config', { params: { asOfDate } }),

  // Update a specific pricing or cost driver with effective date and audit reason
  updateDriver: (key, data) =>
    api.patch(`/pricing-config/${key}`, data),

  // Audit history log for a specific driver key
  getDriverHistory: (key) =>
    api.get(`/pricing-config/${key}/history`),

  // Observable Financial Sensitivity & Break-Even Model (v2.0)
  getFinancialModel: () =>
    api.get('/pricing-config/financial-model')
}

export default pricingConfigService

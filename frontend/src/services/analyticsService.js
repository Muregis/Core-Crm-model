import api from './api'

export const analyticsService = {
  getDashboardStats: () => api.get('/analytics/dashboard'),
  getSalesPerformance: (params) => api.get('/analytics/sales-performance', { params }),
  getCustomerGrowth: (params) => api.get('/analytics/customer-growth', { params }),
  getRevenueAnalytics: (params) => api.get('/analytics/revenue', { params }),
  getConversionMetrics: (params) => api.get('/analytics/conversions', { params }),
  getTopCustomers: (params) => api.get('/analytics/top-customers', { params }),
  getSalesByCounty: (params) => api.get('/analytics/sales-by-county', { params }),
  getDealPipelineMetrics: () => api.get('/analytics/pipeline'),
}

import api from './api'

export const analyticsService = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
  getExpenses: (params) => api.get('/analytics/expenses', { params }),
  createExpense: (data) => api.post('/analytics/expenses', data),
  deleteExpense: (id) => api.delete(`/analytics/expenses/${id}`),
  getDashboardStats: () => api.get('/analytics/dashboard'),
  getSalesPerformance: (params) => api.get('/analytics/sales-performance', { params }),
  getCustomerGrowth: (params) => api.get('/analytics/customer-growth', { params }),
  getRevenueAnalytics: (params) => api.get('/analytics/revenue', { params }),
  getConversionMetrics: (params) => api.get('/analytics/conversions', { params }),
  getTopCustomers: (params) => api.get('/analytics/top-customers', { params }),
  getSalesByCounty: (params) => api.get('/analytics/sales-by-county', { params }),
  getDealPipelineMetrics: () => api.get('/analytics/pipeline'),
}

// api.js
// Central Axios client with environment-based base URL, timeouts, and global error handling.
import axios from 'axios'
import toast from 'react-hot-toast'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add loading state if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - clear persisted auth and redirect to login (avoid store import cycles).
      try {
        localStorage.removeItem('auth-storage')
      } catch {
        // Ignore storage failures (private mode, permissions, etc.).
      }

      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    } else if (error.response?.status === 403) {
      // Forbidden
      toast.error('You do not have permission to perform this action')
    } else if (error.response?.status === 404) {
      // Not found
      toast.error('Resource not found')
    } else if (error.response?.status >= 500) {
      // Server error
      toast.error('Server error. Please try again later')
    } else if (error.code === 'ECONNABORTED') {
      // Timeout
      toast.error('Request timeout. Please check your connection')
    } else if (!error.response) {
      // Network error
      toast.error('Network error. Please check your connection')
    }

    return Promise.reject(error)
  }
)

// Export the api instance
export default api

// Export specific service modules
export * from './authService'
export * from './customerService'
export * from './leadService'
export * from './dealService'
export * from './analyticsService'
export * from './countyService'

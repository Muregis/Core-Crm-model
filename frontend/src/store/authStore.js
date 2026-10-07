import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      login: async (credentials) => {
        try {
          const response = await api.post('/auth/login', credentials)
          const { user, token } = response.data.data
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          })

          // Set default authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          return { 
            success: false, 
            message: error.response?.data?.message || 'Login failed' 
          }
        }
      },

      register: async (userData) => {
        try {
          const response = await api.post('/auth/register', userData)
          const { user, token } = response.data.data
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          })

          // Set default authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          return { 
            success: false, 
            message: error.response?.data?.message || 'Registration failed' 
          }
        }
      },

      logout: () => {
        // Remove authorization header
        delete api.defaults.headers.common['Authorization']
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false
        })
      },

      updateProfile: async (userData) => {
        try {
          const response = await api.put('/auth/profile', userData)
          const { user } = response.data.data
          
          set({ user })
          
          return { success: true }
        } catch (error) {
          return { 
            success: false, 
            message: error.response?.data?.message || 'Profile update failed' 
          }
        }
      },

      changePassword: async (passwordData) => {
        try {
          await api.put('/auth/password', passwordData)
          
          return { success: true }
        } catch (error) {
          return { 
            success: false, 
            message: error.response?.data?.message || 'Password change failed' 
          }
        }
      },

      checkAuth: async () => {
        const { token } = get()
        
        if (!token) {
          set({ isLoading: false })
          return
        }

        try {
          // Set authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          const response = await api.get('/auth/me')
          const { user } = response.data.data
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          // Token is invalid, clear auth state
          get().logout()
        }
      },

      initialize: () => {
        const { token } = get()
        
        if (token) {
          get().checkAuth()
        } else {
          set({ isLoading: false })
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

export { useAuthStore }

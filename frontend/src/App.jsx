// App.jsx
// Top-level routing + auth gating for the CRM frontend.
import React from 'react'
import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Leads from './pages/Leads'
import Deals from './pages/Deals'
import Analytics from './pages/Analytics'
import Tasks from './pages/Tasks'
import Mpesa from './pages/Mpesa'
import Communications from './pages/Communications'
import Parcels from './pages/Parcels'
import Matters from './pages/Matters'
import Invoices from './pages/Invoices'
import Tickets from './pages/Tickets'
import Properties from './pages/Properties'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import LoadingSpinner from './components/LoadingSpinner'
import JobDashboard from './pages/JobDashboard'

// Sawa Repairs Role Views
import TicketTracker from './pages/public/TicketTracker'
import QuoteApproval from './pages/public/QuoteApproval'
import PropertyPassport from './pages/public/PropertyPassport'
import TechnicianApp from './pages/technician/TechnicianApp'

function App() {
  const { user, isAuthenticated, isLoading, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Routes>
      {/* --- 1. Sawa Repairs Public Client & Landlord Portals (No login required) --- */}
      <Route path="/track/:token" element={<TicketTracker />} />
      <Route path="/approve/:token" element={<QuoteApproval />} />
      <Route path="/passport/:token" element={<PropertyPassport />} />

      {/* --- 2. Sawa Field Service Technician Mobile App --- */}
      <Route path="/tech" element={isAuthenticated ? <TechnicianApp /> : <Navigate to="/login" replace />} />
      <Route path="/technician" element={isAuthenticated ? <TechnicianApp /> : <Navigate to="/login" replace />} />

      {/* --- 3. Authentication Routes --- */}
      <Route
        path="/login"
        element={
          !isAuthenticated ? (
            <Login />
          ) : (
            <Navigate to={user?.role === 'technician' ? '/tech' : '/dashboard'} replace />
          )
        }
      />
      <Route
        path="/register"
        element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" replace />}
      />

      {/* --- 4. Authenticated Core CRM Ops Views --- */}
      {isAuthenticated ? (
        <Route
          element={
            user?.role === 'technician' ? (
              <Navigate to="/tech" replace />
            ) : (
              <Layout />
            )
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/mpesa" element={<Mpesa />} />
          <Route path="/communications" element={<Communications />} />
          <Route path="/parcels" element={<Parcels />} />
          <Route path="/matters" element={<Matters />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/jobs" element={<JobDashboard />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

export default App

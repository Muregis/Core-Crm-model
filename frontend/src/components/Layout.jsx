// Layout.jsx
// Shared authenticated app shell: sidebar + header + content area.
import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileMenuOverlay from './MobileMenuOverlay'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar overlay */}
      <MobileMenuOverlay 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      {/* Main content */}
      <div className="lg:pl-64">
        <Header 
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout

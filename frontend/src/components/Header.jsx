// Header.jsx
// Top navigation bar for the authenticated dashboard (search, notifications, user menu, theme).
import React from 'react'
import { Menu, Bell, Search } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import UserDropdown from './UserDropdown'
import ThemeToggle from './ThemeToggle'

const Header = ({ onMenuClick }) => {
  const { user } = useAuthStore()

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side */}
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:hover:bg-gray-900"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search bar */}
            <div className="hidden md:block ml-4 flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search customers, leads, deals..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Theme */}
            <ThemeToggle />

            {/* Notifications */}
            <button className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:hover:bg-gray-900">
              <Bell className="h-5 w-5" />
              <span className="sr-only">View notifications</span>
            </button>

            {/* User dropdown */}
            <UserDropdown user={user} />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

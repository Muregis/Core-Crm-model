// Sidebar.jsx
// Primary navigation for the authenticated dashboard (desktop + mobile) with Industry-Pack specialization.
import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  Briefcase, 
  BarChart3, 
  CheckSquare, 
  Settings, 
  Phone,
  CreditCard,
  MessageSquare,
  Layers,
  Scale
} from 'lucide-react'
import { cn } from '../utils/cn'
import { useAuthStore } from '../store/authStore'

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation()
  const { user } = useAuthStore()

  const industry = user?.tenant_industry || 'all'

  // Dynamic navigation labels: each profession sees their own specialized terminology
  const customersLabel = industry === 'legal' ? 'Clients' : industry === 'real_estate' ? 'Buyers & Clients' : 'Customer Accounts'
  const leadsLabel = industry === 'legal' ? 'Prospective Clients' : industry === 'real_estate' ? 'Plot Inquiries' : 'Sales Leads'
  const dealsLabel = industry === 'legal' ? 'Retainers & Briefs' : industry === 'real_estate' ? 'Land Deals' : 'Deals Pipeline'

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: customersLabel, href: '/customers', icon: Users },
    { name: leadsLabel, href: '/leads', icon: Target },
    { name: dealsLabel, href: '/deals', icon: Briefcase },
    // Land & Property Pack (Active for Real Estate & Multi-Discipline firms)
    ...((industry === 'real_estate' || industry === 'all') ? [
      { name: 'Land & Parcels', href: '/parcels', icon: Layers }
    ] : []),
    // Legal Practice Pack (Active for Law Firms & Multi-Discipline firms)
    ...((industry === 'legal' || industry === 'all') ? [
      { name: 'Legal Matters', href: '/matters', icon: Scale }
    ] : []),
    { name: 'M-Pesa Vault', href: '/mpesa', icon: CreditCard },
    { name: 'Communications', href: '/communications', icon: MessageSquare },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const userInitials = user?.first_name
    ? `${user.first_name[0]}${user.last_name ? user.last_name[0] : ''}`
    : 'U'
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'User'
  const displayEmail = user?.email || 'user@example.com'
  const tenantTitle = user?.tenant_name || 'Kenya CRM'

  const editionLabel = 
    industry === 'legal' ? 'Legal Practice Edition' :
    industry === 'real_estate' ? 'Real Estate Edition' :
    industry === 'general' ? 'Commercial Core' : 'Enterprise Edition'

  return (
    <>
      {/* Sidebar for desktop */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto dark:bg-gray-950 dark:border-gray-800">
          {/* Logo & Tenant Brand */}
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm">
                  {industry === 'legal' ? (
                    <Scale className="h-5 w-5 text-white" />
                  ) : industry === 'real_estate' ? (
                    <Layers className="h-5 w-5 text-white" />
                  ) : (
                    <Phone className="h-5 w-5 text-white" />
                  )}
                </div>
              </div>
              <div className="ml-3 min-w-0">
                <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate" title={tenantTitle}>
                  {tenantTitle}
                </h1>
                <p className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
                  {editionLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-8 flex-1 px-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'sidebar-item',
                    isActive 
                      ? 'sidebar-item-active' 
                      : 'sidebar-item-inactive'
                  )}
                  onClick={onClose}
                >
                  <item.icon className="sidebar-icon" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User profile section */}
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4 dark:border-gray-800">
            <Link to="/profile" className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-sm">
                  {userInitials}
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayEmail}</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={cn(
        'lg:hidden',
        isOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 flex z-50">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-950 dark:border-r dark:border-gray-800">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={onClose}
              >
                <span className="sr-only">Close sidebar</span>
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              {/* Logo */}
              <div className="flex items-center flex-shrink-0 px-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
                      {industry === 'legal' ? (
                        <Scale className="h-5 w-5 text-white" />
                      ) : industry === 'real_estate' ? (
                        <Layers className="h-5 w-5 text-white" />
                      ) : (
                        <Phone className="h-5 w-5 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="ml-3 min-w-0">
                    <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{tenantTitle}</h1>
                    <p className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">{editionLabel}</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="mt-8 flex-1 px-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        'sidebar-item',
                        isActive 
                          ? 'sidebar-item-active' 
                          : 'sidebar-item-inactive'
                      )}
                      onClick={onClose}
                    >
                      <item.icon className="sidebar-icon" />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Mobile User profile */}
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4 dark:border-gray-800">
              <Link to="/profile" className="flex-shrink-0 group block" onClick={onClose}>
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                    {userInitials}
                  </div>
                  <div className="ml-3 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayEmail}</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar

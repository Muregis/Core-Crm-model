// Dashboard.jsx
// Primary overview page: dynamic stats, recent activity, upcoming tasks, and quick actions tailored by profession.
import React from 'react'
import { Link } from 'react-router-dom'
import { 
  Users, 
  Target, 
  Briefcase, 
  TrendingUp, 
  Phone, 
  CreditCard, 
  MessageSquare, 
  CheckSquare, 
  Layers, 
  Scale,
  Calendar,
  Clock,
  Gavel,
  ShieldAlert
} from 'lucide-react'
import { formatCurrencyKES, formatDateKe } from '../utils/formatters'
import { useAuthStore } from '../store/authStore'

const Dashboard = () => {
  const { user } = useAuthStore()
  const industry = user?.tenant_industry || 'general'

  // Dynamic dashboard configuration based on active profession
  const getDashboardConfig = () => {
    if (industry === 'legal') {
      return {
        title: 'Legal Practice Dashboard',
        subtitle: "Welcome back counsel! Here's the state of your ongoing litigation, court fixtures, and client matters.",
        stats: [
          {
            name: 'Active Matters & Litigation',
            value: '28 Cases',
            change: '+3 this month',
            changeType: 'positive',
            icon: Scale,
            color: 'bg-purple-600',
          },
          {
            name: 'Court Fixtures (Next 30 Days)',
            value: '7 Hearings',
            change: 'Milimani / ELC',
            changeType: 'positive',
            icon: Calendar,
            color: 'bg-amber-500',
          },
          {
            name: 'Fixed Fee & Retainer Pipeline',
            value: formatCurrencyKES(4850000),
            change: '+15%',
            changeType: 'positive',
            icon: TrendingUp,
            color: 'bg-emerald-600',
          },
          {
            name: 'Billable Time Recorded',
            value: '184.5 Hrs',
            change: 'This month',
            changeType: 'positive',
            icon: Clock,
            color: 'bg-blue-600',
          },
        ],
        recentActivity: [
          {
            id: 1,
            type: 'matter',
            title: 'Court Fixture Scheduled (Order 11 CPR)',
            description: 'Gachagua Properties (Plaintiff) vs Equity Bank (HCCC/E098/2026 at Milimani Commercial)',
            time: '2 hours ago',
            icon: Scale,
          },
          {
            id: 2,
            type: 'time',
            title: 'Billable Advocate Time Logged',
            description: 'Drafted Replying Affidavit - 90 mins (KES 22,500 under ARO)',
            time: '3 hours ago',
            icon: Clock,
          },
          {
            id: 3,
            type: 'payment',
            title: 'Instruction Retainer Received via M-Pesa',
            description: 'KES 150,000 from Gachagua Commercial Properties Ltd',
            time: '5 hours ago',
            icon: CreditCard,
          },
          {
            id: 4,
            type: 'communication',
            title: 'WhatsApp Client Consultation',
            description: 'Sent indexed trial bundle to instructing client',
            time: '8 hours ago',
            icon: MessageSquare,
          },
        ],
        upcomingTasks: [
          {
            id: 1,
            title: 'File trial bundle for HCCC/E098/2026 (Order 11 CPR compliance)',
            dueDate: 'Due tomorrow',
            priority: 'high',
          },
          {
            id: 2,
            title: 'Court mention before Hon. Lady Justice Chepkwony, J',
            dueDate: 'Nov 14, 2026',
            priority: 'high',
          },
          {
            id: 3,
            title: 'Client conference with Gachagua Commercial on Title ELC/2026/0542',
            dueDate: 'Nov 16, 2026',
            priority: 'medium',
          },
        ]
      }
    } else if (industry === 'real_estate') {
      return {
        title: 'Real Estate & Land Selling Dashboard',
        subtitle: "Welcome back! Here's the state of your plot inventory, site visits, and title deeds today.",
        stats: [
          {
            name: 'Total Plots in Inventory',
            value: '142 Plots',
            change: '3 Active Projects',
            changeType: 'positive',
            icon: Layers,
            color: 'bg-emerald-600',
          },
          {
            name: 'Reserved / Pending Sales',
            value: '18 Plots',
            change: 'Deposit paid',
            changeType: 'positive',
            icon: Clock,
            color: 'bg-amber-500',
          },
          {
            name: 'Total Inventory Valuation',
            value: formatCurrencyKES(84200000),
            change: '+12%',
            changeType: 'positive',
            icon: TrendingUp,
            color: 'bg-purple-600',
          },
          {
            name: 'Active Buyer Pipeline',
            value: '89 Inquiries',
            change: '+14% this month',
            changeType: 'positive',
            icon: Target,
            color: 'bg-blue-600',
          },
        ],
        recentActivity: [
          {
            id: 1,
            type: 'parcel',
            title: 'Plot Reserved',
            description: 'Acacia Heights Plot 15 reserved by James Mwangi',
            time: '1 hour ago',
            icon: Layers,
          },
          {
            id: 2,
            type: 'payment',
            title: 'Plot Deposit Received via M-Pesa',
            description: 'KES 150,000 for Acacia Heights Plot 15',
            time: '4 hours ago',
            icon: CreditCard,
          },
          {
            id: 3,
            type: 'deal',
            title: 'Letter of Offer Issued',
            description: 'Longonot Breeze Phase 3 - Plot 42',
            time: '6 hours ago',
            icon: Briefcase,
          },
          {
            id: 4,
            type: 'communication',
            title: 'WhatsApp Site Visit Confirmed',
            description: 'Confirmed Saturday site visit with 4 clients',
            time: '8 hours ago',
            icon: MessageSquare,
          },
        ],
        upcomingTasks: [
          {
            id: 1,
            title: 'Collect title deeds from Lands Registry (Ardhi House)',
            dueDate: 'Due tomorrow',
            priority: 'high',
          },
          {
            id: 2,
            title: 'Site visit convoy to Kitengela Phase 2',
            dueDate: 'Saturday 9:00 AM',
            priority: 'high',
          },
          {
            id: 3,
            title: 'Send clearance certificate to James Mwangi',
            dueDate: 'Next Monday',
            priority: 'medium',
          },
        ]
      }
    } else {
      // Commercial Core / General SME
      return {
        title: 'Commercial Operations & CRM Core',
        subtitle: "Welcome back! Here's what's happening with your customer accounts, sales pipeline, and collections today.",
        stats: [
          {
            name: 'Total Client Accounts',
            value: '1,234',
            change: '+12%',
            changeType: 'positive',
            icon: Users,
            color: 'bg-blue-600',
          },
          {
            name: 'Active Sales Leads',
            value: '89',
            change: '+5%',
            changeType: 'positive',
            icon: Target,
            color: 'bg-emerald-600',
          },
          {
            name: 'Open Pipeline Deals',
            value: '45',
            change: '-2%',
            changeType: 'negative',
            icon: Briefcase,
            color: 'bg-amber-500',
          },
          {
            name: 'Monthly Revenue Collected',
            value: formatCurrencyKES(2400000),
            change: '+18%',
            changeType: 'positive',
            icon: TrendingUp,
            color: 'bg-purple-600',
          },
        ],
        recentActivity: [
          {
            id: 1,
            type: 'customer',
            title: 'New Customer Registered',
            description: 'James Mwangi from Nairobi',
            time: '2 hours ago',
            icon: Users,
          },
          {
            id: 2,
            type: 'deal',
            title: 'Commercial Deal Won',
            description: 'Annual Supply Contract - KES 150,000',
            time: '4 hours ago',
            icon: Briefcase,
          },
          {
            id: 3,
            type: 'payment',
            title: 'M-Pesa Payment Received',
            description: 'KES 50,000 from Mwangi Enterprises',
            time: '6 hours ago',
            icon: CreditCard,
          },
          {
            id: 4,
            type: 'communication',
            title: 'WhatsApp Follow-Up Completed',
            description: 'Product catalogue sent to Sarah Ochieng',
            time: '8 hours ago',
            icon: MessageSquare,
          },
        ],
        upcomingTasks: [
          {
            id: 1,
            title: 'Follow up with James Mwangi on order delivery',
            dueDate: 'Due today',
            priority: 'high',
          },
          {
            id: 2,
            title: 'Prepare quotation for Karanja Tech Supplies',
            dueDate: 'Tomorrow',
            priority: 'medium',
          },
          {
            id: 3,
            title: 'Reconcile weekly M-Pesa Paybill statements',
            dueDate: 'Friday',
            priority: 'low',
          },
        ]
      }
    }
  }

  const { title, subtitle, stats, recentActivity, upcomingTasks } = getDashboardConfig()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
            {industry === 'legal' ? 'Legal Practice' : industry === 'real_estate' ? 'Real Estate' : 'Commercial Core'}
          </span>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="stat-card">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-md ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                  <dd className="stat-value">{stat.value}</dd>
                </dl>
              </div>
            </div>
            <div className={`stat-change ${stat.changeType === 'positive' ? 'stat-change-positive' : 'stat-change-negative'}`}>
              {stat.change}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Activity Timeline</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <activity.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activity.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-400">
                      {activity.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks / Fixtures */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {industry === 'legal' ? 'Actionable Case Deadlines' : 'Upcoming Priority Tasks'}
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        task.priority === 'high' ? 'bg-red-500' :
                        task.priority === 'medium' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{task.dueDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-footer">
              <Link to="/tasks" className="text-sm text-primary-600 hover:text-primary-500 font-medium inline-block">
                View all tasks →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Dynamically Filtered */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Quick Actions & Modules</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Link to="/customers" className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950 text-center">
              <Users className="h-7 w-7 text-primary-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {industry === 'legal' ? 'Instructing Clients' : industry === 'real_estate' ? 'Land Buyers' : 'Customer Accounts'}
              </span>
            </Link>

            <Link to="/leads" className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950 text-center">
              <Target className="h-7 w-7 text-emerald-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {industry === 'legal' ? 'Prospective Clients' : industry === 'real_estate' ? 'Plot Inquiries' : 'Sales Leads'}
              </span>
            </Link>

            <Link to="/deals" className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950 text-center">
              <Briefcase className="h-7 w-7 text-amber-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {industry === 'legal' ? 'Retainers & Briefs' : industry === 'real_estate' ? 'Land Deals' : 'Sales Pipeline'}
              </span>
            </Link>

            {(industry === 'real_estate' || industry === 'all') && (
              <Link to="/parcels" className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950 text-center">
                <Layers className="h-7 w-7 text-green-600 mb-2" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Land & Parcels</span>
              </Link>
            )}

            {(industry === 'legal' || industry === 'all') && (
              <Link to="/matters" className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950 text-center">
                <Scale className="h-7 w-7 text-purple-600 mb-2" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Legal Matters</span>
              </Link>
            )}

            <Link to="/communications" className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950 text-center">
              <MessageSquare className="h-7 w-7 text-sky-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">WhatsApp Hub</span>
            </Link>

            <Link to="/mpesa" className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950 text-center">
              <CreditCard className="h-7 w-7 text-emerald-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">M-Pesa Vault</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

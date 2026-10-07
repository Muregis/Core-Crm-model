// Dashboard.jsx
// Primary overview page: stats, recent activity, upcoming tasks, and quick actions.
import React from 'react'
import { Users, Target, Briefcase, TrendingUp, Phone, CreditCard, MessageSquare, CheckSquare } from 'lucide-react'
import { formatCurrencyKES, formatDateKe } from '../utils/formatters'

const Dashboard = () => {
  // Mock data - replace with actual API calls
  const stats = [
    {
      name: 'Total Customers',
      value: '1,234',
      change: '+12%',
      changeType: 'positive',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      name: 'Active Leads',
      value: '89',
      change: '+5%',
      changeType: 'positive',
      icon: Target,
      color: 'bg-green-500',
    },
    {
      name: 'Open Deals',
      value: '45',
      change: '-2%',
      changeType: 'negative',
      icon: Briefcase,
      color: 'bg-yellow-500',
    },
    {
      name: 'Monthly Revenue',
      value: formatCurrencyKES(2400000),
      change: '+18%',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'customer',
      title: 'New customer registered',
      description: 'James Mwangi from Nairobi',
      time: '2 hours ago',
      icon: Users,
    },
    {
      id: 2,
      type: 'deal',
      title: 'Deal won',
      description: 'Website Development - KES 150,000',
      time: '4 hours ago',
      icon: Briefcase,
    },
    {
      id: 3,
      type: 'payment',
      title: 'M-Pesa payment received',
      description: 'KES 50,000 from Mwangi Enterprises',
      time: '6 hours ago',
      icon: CreditCard,
    },
    {
      id: 4,
      type: 'communication',
      title: 'Call completed',
      description: 'Customer follow-up with Sarah Ochieng',
      time: '8 hours ago',
      icon: Phone,
    },
  ]

  const upcomingTasks = [
    {
      id: 1,
      title: 'Follow up with James Mwangi',
      dueDate: formatDateKe('2026-03-14'),
      priority: 'high',
    },
    {
      id: 2,
      title: 'Prepare proposal for Karanja Tech',
      dueDate: formatDateKe('2026-03-15'),
      priority: 'medium',
    },
    {
      id: 3,
      title: 'Schedule demo with Kiprop Logistics',
      dueDate: formatDateKe('2026-03-16'),
      priority: 'low',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening with your business today.</p>
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
              {stat.change} from last month
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Activity</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.type === 'customer' ? 'bg-blue-100' :
                        activity.type === 'deal' ? 'bg-green-100' :
                        activity.type === 'payment' ? 'bg-purple-100' :
                        'bg-gray-100'
                      }`}>
                        <activity.icon className={`h-4 w-4 ${
                          activity.type === 'customer' ? 'text-blue-600' :
                          activity.type === 'deal' ? 'text-green-600' :
                          activity.type === 'payment' ? 'text-purple-600' :
                          'text-gray-600'
                        }`} />
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

        {/* Upcoming Tasks */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Upcoming Tasks</h3>
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
              <button className="text-sm text-primary-600 hover:text-primary-500 font-medium">
                View all tasks →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950">
              <Users className="h-8 w-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Add Customer</span>
            </button>
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950">
              <Target className="h-8 w-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Create Lead</span>
            </button>
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950">
              <Briefcase className="h-8 w-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">New Deal</span>
            </button>
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-950">
              <CheckSquare className="h-8 w-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Add Task</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

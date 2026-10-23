// Tasks.jsx
// Task management, assignments, follow-up deadlines, and completion tracking.
import React, { useEffect, useState, useMemo } from 'react'
import {
  CheckSquare,
  Square,
  Clock,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Calendar,
  User,
  Trash2,
  CheckCircle2,
  Phone,
  Mail,
  Users
} from 'lucide-react'
import { taskService } from '../services/taskService'
import { customerService } from '../services/customerService'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const PRIORITY_BADGES = {
  urgent: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
}

const TYPE_ICONS = {
  call: Phone,
  email: Mail,
  meeting: Users,
  follow_up: Clock,
  demo: Calendar,
  other: CheckSquare
}

const Tasks = () => {
  const [tasks, setTasks] = useState([])
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    taskType: 'follow_up',
    priority: 'medium',
    dueDate: '',
    customerId: ''
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [tasksRes, custRes] = await Promise.all([
        taskService.getTasks(),
        customerService.getCustomers({ limit: 100 })
      ])

      if (tasksRes.data?.success) {
        setTasks(tasksRes.data.data.tasks || [])
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
    } catch (err) {
      // Fallback sample tasks
      setTasks([
        {
          id: 1,
          title: 'Follow up with James Mwangi on Title Deed dispatch',
          description: 'Client visited office last Friday. Send tracking details via WhatsApp.',
          status: 'pending',
          priority: 'high',
          task_type: 'call',
          due_date: new Date(Date.now() + 86400000).toISOString(),
          customer_name: 'James Mwangi',
          assigned_to_name: 'John Sales'
        },
        {
          id: 2,
          title: 'Prepare installment schedule for Plot #12',
          description: 'Structure 12-month payment breakdown with 20% deposit.',
          status: 'completed',
          priority: 'medium',
          task_type: 'follow_up',
          due_date: new Date().toISOString(),
          customer_name: 'Grace Wanjiru',
          assigned_to_name: 'Paul Rep'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredTasks = useMemo(() => {
    const now = new Date()
    return tasks.filter((t) => {
      const matchSearch = `${t.title || ''} ${t.description || ''} ${t.customer_name || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())

      let matchStatus = true
      if (statusFilter === 'pending') matchStatus = t.status === 'pending'
      else if (statusFilter === 'completed') matchStatus = t.status === 'completed'
      else if (statusFilter === 'overdue') {
        matchStatus = t.status !== 'completed' && t.due_date && new Date(t.due_date) < now
      }

      const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter

      return matchSearch && matchStatus && matchPriority
    })
  }, [tasks, searchTerm, statusFilter, priorityFilter])

  const metrics = useMemo(() => {
    const now = new Date()
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === 'completed').length
    const pending = tasks.filter((t) => t.status === 'pending').length
    const overdue = tasks.filter(
      (t) => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now
    ).length
    return { total, completed, pending, overdue }
  }, [tasks])

  const handleToggleStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      await taskService.updateTask(task.id, { status: newStatus })
      toast.success(newStatus === 'completed' ? 'Task marked complete!' : 'Task re-opened')
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      )
    } catch {
      toast.error('Failed to update task status')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return
    try {
      await taskService.deleteTask(id)
      toast.success('Task deleted')
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Task title is required')
      return
    }

    try {
      await taskService.createTask({
        title: form.title,
        description: form.description,
        taskType: form.taskType,
        priority: form.priority,
        dueDate: form.dueDate || null,
        customerId: form.customerId ? parseInt(form.customerId, 10) : null
      })
      toast.success('Task created successfully')
      setShowCreateModal(false)
      setForm({
        title: '',
        description: '',
        taskType: 'follow_up',
        priority: 'medium',
        dueDate: '',
        customerId: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tasks & Follow-Ups</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Keep track of client call reminders, deal milestones, document collections, and team to-dos.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Total Tasks</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{metrics.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 uppercase">Pending</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.pending}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-red-600 uppercase">Overdue</span>
          <p className="text-2xl font-bold text-red-600 mt-1">{metrics.overdue}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Completed</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.completed}</p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'pending', label: 'Pending' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'completed', label: 'Completed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No Tasks Found"
            description="Create tasks to follow up with clients, manage installments, and schedule viewings."
            actionLabel="Create Task"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed'
            const isOverdue = !isCompleted && task.due_date && new Date(task.due_date) < new Date()
            const Icon = TYPE_ICONS[task.task_type] || CheckSquare

            return (
              <div
                key={task.id}
                className={`bg-white dark:bg-gray-900 border rounded-xl p-4 shadow-sm transition flex items-start justify-between gap-4 ${
                  isCompleted
                    ? 'border-gray-200 dark:border-gray-800 opacity-60'
                    : isOverdue
                    ? 'border-red-300 dark:border-red-900/60'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <button
                    onClick={() => handleToggleStatus(task)}
                    className="mt-0.5 text-gray-400 hover:text-primary-600 transition"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-semibold text-sm ${
                          isCompleted
                            ? 'line-through text-gray-500'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {task.title}
                      </span>

                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium
                        }`}
                      >
                        {task.priority || 'medium'}
                      </span>

                      {isOverdue && (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-semibold">
                          <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 flex-wrap">
                      {task.customer_name && (
                        <span className="flex items-center gap-1 text-primary-600">
                          <User className="w-3 h-3" />
                          {task.customer_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due: {new Date(task.due_date).toLocaleDateString('en-KE')}
                        </span>
                      )}
                      <span>Assigned: {task.assigned_to_name || 'Team'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded-lg transition"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create New Task</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call client regarding Plot #15 deposit"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context or notes..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Type
                  </label>
                  <select
                    value={form.taskType}
                    onChange={(e) => setForm({ ...form, taskType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="call">Phone Call</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="meeting">Meeting / Visit</option>
                    <option value="email">Email</option>
                    <option value="demo">Proposal / Agreement</option>
                    <option value="other">General Task</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Customer Link (Optional)
                  </label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">None</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name || c.firstName} {c.last_name || c.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tasks

// Tickets.jsx
// Service Ticket & Field-Service Management for Sawa Repairs.
// Mobile-first responsive UI supporting ticket triage, dispatch, landlord approvals, and cost recording.
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  Plus,
  Search,
  Filter,
  DollarSign,
  ShieldCheck,
  ExternalLink,
  Copy,
  ChevronRight,
  Phone,
  FileText,
  MapPin,
  Check,
  X,
  Send,
  Zap,
  Droplet,
  Home,
  Sun,
  Layers,
  Sparkles,
  Info
} from 'lucide-react'
import { ticketService } from '../services/ticketService'
import { propertyService } from '../services/propertyService'
import { customerService } from '../services/customerService'
import { userService } from '../services/userService'
import { useAuthStore } from '../store/authStore'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const CATEGORY_ICONS = {
  plumbing: Droplet,
  electrical: Zap,
  roofing: Home,
  painting: Sparkles,
  solar: Sun,
  general: Wrench,
  other: Layers
}

const CATEGORY_COLORS = {
  plumbing: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  electrical: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  roofing: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900',
  painting: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  solar: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-900',
  general: 'text-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  other: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900'
}

const PRIORITY_BADGES = {
  emergency: 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border-red-200 dark:border-red-900 animate-pulse',
  standard: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  planned: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
}

const STATUS_CONFIG = {
  reported: { label: 'Reported', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  triaged: { label: 'Triaged', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
  scheduled: { label: 'Scheduled', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  awaiting_parts: { label: 'Awaiting Parts', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  verified: { label: 'Verified', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300' },
  closed: { label: 'Closed', color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  reopened: { label: 'Reopened', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' }
}

const ALLOWED_TRANSITIONS = {
  reported: ['triaged', 'scheduled', 'closed'],
  triaged: ['scheduled', 'awaiting_parts', 'in_progress', 'closed'],
  scheduled: ['in_progress', 'triaged', 'closed'],
  in_progress: ['awaiting_parts', 'resolved', 'scheduled'],
  awaiting_parts: ['in_progress', 'scheduled', 'triaged'],
  resolved: ['verified', 'reopened', 'closed'],
  verified: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['triaged', 'scheduled', 'in_progress']
}

export default function Tickets() {
  const { user } = useAuthStore()
  const isTechnician = user?.role === 'sales_rep' || user?.role === 'technician'
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  // Data states
  const [tickets, setTickets] = useState([])
  const [properties, setProperties] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isApprovalOpen, setIsApprovalOpen] = useState(false)
  const [isCostsOpen, setIsCostsOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false)

  // Selected item for modals
  const [activeTicket, setActiveTicket] = useState(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    property_id: '',
    customer_id: '',
    reported_by: '',
    category: 'plumbing',
    priority: 'standard',
    description: '',
    callout_fee_kes: 2000,
    emergency_auto_approve_limit_kes: 5000,
    landlord_approval_required: false,
    approval_threshold_kes: 5000,
    internal_notes: ''
  })

  const [scheduleForm, setScheduleForm] = useState({
    assigned_technician_id: '',
    scheduled_at: '',
    notes: '',
    create_task: true
  })

  const [approvalForm, setApprovalForm] = useState({
    action: 'request',
    approval_threshold_kes: 5000,
    notes: ''
  })

  const [costsForm, setCostsForm] = useState({
    labour_hours: 1,
    labour_billed_kes: 1500,
    parts_cost_kes: 0,
    parts_markup_percentage: 20,
    callout_fee_kes: 2000,
    callout_fee_waived: false,
    travel_cost_kes: 0,
    notes: ''
  })

  const [statusForm, setStatusForm] = useState({
    status: '',
    notes: ''
  })

  // Load initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        ticketService.getTickets({ limit: 100 }),
        isAdmin ? ticketService.getDashboardStats().catch(() => ({ data: { stats: null } })) : Promise.resolve({ data: { stats: null } })
      ])

      const list = ticketsRes.data?.data?.tickets || []
      setTickets(list)
      if (statsRes.data?.stats) {
        setStats(statsRes.data.stats)
      }

      // Load supporting lists if admin/manager
      if (isAdmin) {
        const [propsRes, custsRes, usersRes] = await Promise.all([
          propertyService.getProperties({ limit: 100 }).catch(() => ({ data: { data: { properties: [] } } })),
          customerService.getCustomers({ limit: 100 }).catch(() => ({ data: { data: { customers: [] } } })),
          userService.getUsers().catch(() => ({ data: { data: { users: [] } } }))
        ])
        setProperties(propsRes.data?.data?.properties || [])
        setCustomers(custsRes.data?.data?.customers || [])
        setUsers(usersRes.data?.data?.users || [])
      }
    } catch (err) {
      toast.error('Failed to load tickets: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false
      }
      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) {
        return false
      }
      // Category filter
      if (categoryFilter !== 'all' && t.category !== categoryFilter) {
        return false
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNum = t.ticket_number?.toLowerCase().includes(q)
        const matchProp = t.property_name?.toLowerCase().includes(q)
        const matchDesc = t.description?.toLowerCase().includes(q)
        const matchRep = t.reported_by?.toLowerCase().includes(q)
        const matchLandlord = t.landlord_name?.toLowerCase().includes(q)
        return matchNum || matchProp || matchDesc || matchRep || matchLandlord
      }
      return true
    })
  }, [tickets, statusFilter, priorityFilter, categoryFilter, searchQuery])

  // Copy helper
  const copyToClipboard = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  // Handle Create Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault()
    if (!createForm.description.trim()) {
      toast.error('Description is required')
      return
    }

    try {
      const payload = {
        ...createForm,
        property_id: createForm.property_id ? Number(createForm.property_id) : null,
        customer_id: createForm.customer_id ? Number(createForm.customer_id) : null,
        callout_fee_kes: Number(createForm.callout_fee_kes) || 2000,
        emergency_auto_approve_limit_kes: Number(createForm.emergency_auto_approve_limit_kes) || 0,
        approval_threshold_kes: Number(createForm.approval_threshold_kes) || 5000,
        landlord_approval_required: Boolean(createForm.landlord_approval_required)
      }

      await ticketService.createTicket(payload)
      toast.success('Service ticket opened successfully!')
      setIsCreateOpen(false)
      setCreateForm({
        property_id: '',
        customer_id: '',
        reported_by: '',
        category: 'plumbing',
        priority: 'standard',
        description: '',
        callout_fee_kes: 2000,
        emergency_auto_approve_limit_kes: 5000,
        landlord_approval_required: false,
        approval_threshold_kes: 5000,
        internal_notes: ''
      })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ticket')
    }
  }

  // Handle Schedule Dispatch
  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    if (!scheduleForm.assigned_technician_id) {
      toast.error('Please select a technician')
      return
    }

    try {
      await ticketService.scheduleTicket(activeTicket.id, {
        assigned_technician_id: Number(scheduleForm.assigned_technician_id),
        scheduled_at: scheduleForm.scheduled_at ? new Date(scheduleForm.scheduled_at).toISOString() : null,
        notes: scheduleForm.notes,
        create_task: scheduleForm.create_task
      })
      toast.success('Technician dispatched & ticket scheduled!')
      setIsScheduleOpen(false)
      setActiveTicket(null)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule technician')
    }
  }

  // Handle Status Transition
  const handleStatusSubmit = async (e) => {
    e.preventDefault()
    if (!statusForm.status) {
      toast.error('Please select a new status')
      return
    }

    try {
      await ticketService.transitionStatus(activeTicket.id, statusForm.status, statusForm.notes)
      toast.success(`Ticket status updated to ${statusForm.status}`)
      setIsStatusModalOpen(false)
      setActiveTicket(null)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Illegal status transition')
    }
  }

  // Handle Landlord Approval
  const handleApprovalSubmit = async (e) => {
    e.preventDefault()
    try {
      await ticketService.handleApproval(activeTicket.id, {
        action: approvalForm.action,
        approval_threshold_kes: Number(approvalForm.approval_threshold_kes) || 5000,
        notes: approvalForm.notes
      })
      toast.success(`Landlord approval action '${approvalForm.action}' recorded!`)
      setIsApprovalOpen(false)
      setActiveTicket(null)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update approval')
    }
  }

  // Handle Record Costs
  const handleCostsSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = isTechnician
        ? {
            labour_hours: Number(costsForm.labour_hours) || 0,
            parts_cost_kes: Number(costsForm.parts_cost_kes) || 0,
            notes: costsForm.notes
          }
        : {
            labour_hours: Number(costsForm.labour_hours) || 0,
            labour_billed_kes: Number(costsForm.labour_billed_kes) || 0,
            parts_cost_kes: Number(costsForm.parts_cost_kes) || 0,
            parts_markup_percentage: Number(costsForm.parts_markup_percentage) || 20,
            callout_fee_kes: Number(costsForm.callout_fee_kes) || 0,
            callout_fee_waived: Boolean(costsForm.callout_fee_waived),
            travel_cost_kes: Number(costsForm.travel_cost_kes) || 0,
            notes: costsForm.notes
          }

      await ticketService.recordCosts(activeTicket.id, payload)
      toast.success('Costs & invoice updated!')
      setIsCostsOpen(false)
      setActiveTicket(null)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record costs')
    }
  }

  // Live margin preview for Admin
  const calculatedInvoice = useMemo(() => {
    if (!isAdmin) return 0
    const labour = Number(costsForm.labour_billed_kes) || 0
    const parts = Number(costsForm.parts_cost_kes) || 0
    const markupPct = Number(costsForm.parts_markup_percentage) || 0
    const partsBilled = parts * (1 + markupPct / 100)
    const callout = costsForm.callout_fee_waived ? 0 : Number(costsForm.callout_fee_kes) || 0
    return Math.round(labour + partsBilled + callout)
  }, [costsForm, isAdmin])

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isTechnician ? 'My Assigned Service Jobs' : 'Service Tickets & Dispatch'}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-950/70 dark:text-primary-300">
              Sawa Repairs Field Ops
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isTechnician
              ? 'Your active property maintenance queue, SLA response timers, and completion reporting'
              : 'End-to-end property maintenance: ticket intake, technician dispatch, landlord approvals, and transparent billing'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm shadow-sm transition-colors focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Open Service Ticket
          </button>
        )}
      </div>

      {/* KPI Stats Bar (Admin only sees financial/portfolio SLA; Tech sees assigned count) */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Open Emergencies
              </span>
              <AlertTriangle className={`w-4 h-4 ${stats.openEmergencies > 0 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.openEmergencies > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {stats.openEmergencies || 0}
            </p>
            <span className="text-xs text-gray-400 mt-1 block">Interim 6h target committed</span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                SLA Breaches
              </span>
              <Clock className={`w-4 h-4 ${stats.slaBreaches > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.slaBreaches > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {stats.slaBreaches || 0}
            </p>
            <span className="text-xs text-gray-400 mt-1 block">
              {stats.slaBreaches === 0 ? '100% on-time dispatch' : 'Response attention needed'}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Awaiting Approval
              </span>
              <DollarSign className="w-4 h-4 text-primary-500" />
            </div>
            <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
              {stats.pendingLandlordApproval || 0}
            </p>
            <span className="text-xs text-gray-400 mt-1 block">Landlord quotes pending</span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                This Month's Jobs
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
              {stats.ticketsThisMonth || 0}
            </p>
            <span className="text-xs text-gray-400 mt-1 block">
              {stats.resolvedThisMonth || 0} resolved with 30d warranty
            </span>
          </div>
        </div>
      )}

      {/* Technician quick summary badge */}
      {isTechnician && (
        <div className="bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-950 dark:text-primary-100">
                Logged in as Field Technician: {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-primary-700 dark:text-primary-300">
                You have {filteredTickets.length} service ticket(s) currently assigned to you.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        {/* Status Tab Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-gray-100 dark:border-gray-800">
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'reported', label: 'Reported' },
            { id: 'triaged', label: 'Triaged' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'awaiting_parts', label: 'Awaiting Parts' },
            { id: 'resolved', label: 'Resolved' },
            { id: 'verified', label: 'Verified' },
            { id: 'closed', label: 'Closed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ticket #, property, issue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Priorities</option>
              <option value="emergency">Emergency (Interim 6h)</option>
              <option value="standard">Standard (24-48h)</option>
              <option value="planned">Planned (3-5d)</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Trade Categories</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="roofing">Roofing</option>
              <option value="painting">Painting</option>
              <option value="solar">Solar</option>
              <option value="general">General Handyman</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No service tickets found"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or status filter.'
              : isTechnician
              ? 'You have no assigned jobs in this queue right now.'
              : 'Open your first property maintenance ticket to get started.'
          }
          actionLabel={isAdmin ? 'Open Service Ticket' : undefined}
          onAction={isAdmin ? () => setIsCreateOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTickets.map((ticket) => {
            const CatIcon = CATEGORY_ICONS[ticket.category] || Wrench
            const catColor = CATEGORY_COLORS[ticket.category] || CATEGORY_COLORS.general
            const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.reported
            const isEmergency = ticket.priority === 'emergency'

            return (
              <div
                key={ticket.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all p-5 space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                      {ticket.ticket_number}
                    </span>

                    {/* Priority badge */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${PRIORITY_BADGES[ticket.priority]}`}>
                      {ticket.priority}
                    </span>

                    {/* Category badge */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${catColor}`}>
                      <CatIcon className="w-3 h-3" />
                      <span className="capitalize">{ticket.category}</span>
                    </span>

                    {/* Status badge */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>

                    {/* Warranty indicator */}
                    {ticket.warranty_until && new Date(ticket.warranty_until) > new Date() && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="w-3 h-3" />
                        30-Day Warranty Active
                      </span>
                    )}

                    {/* Landlord approval required/waived */}
                    {ticket.landlord_approval_required ? (
                      ticket.approved_at ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                          <Check className="w-3 h-3" />
                          Approved (Callout Waived)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          <DollarSign className="w-3 h-3" />
                          Awaiting Landlord Approval
                        </span>
                      )
                    ) : null}
                  </div>

                  {/* SLA Response Clock */}
                  {ticket.sla_response_due_at && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className={`w-3.5 h-3.5 ${ticket.is_sla_breached ? 'text-red-500' : 'text-gray-400'}`} />
                      <span className="text-gray-500 dark:text-gray-400">Response target:</span>
                      <span className={`font-semibold ${ticket.is_sla_breached ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                        {ticket.is_sla_breached ? 'BREACHED (>6h)' : '2–6h target window'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Body: Property, Description & Contacts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left: Issue Description */}
                  <div className="md:col-span-2 space-y-2">
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line font-normal">
                      {ticket.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
                      {ticket.property_name && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-primary-500" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {ticket.property_name}
                          </span>
                        </div>
                      )}

                      {ticket.reported_by && (
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>Reported by: {ticket.reported_by}</span>
                        </div>
                      )}

                      <span>Logged: {new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Right: Assigned Fundi & Financials (Sanitized for Tech) */}
                  <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block font-medium">Assigned Fundi:</span>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {ticket.technician_name || 'Unassigned'}
                      </p>
                      {ticket.scheduled_at && (
                        <span className="text-primary-600 dark:text-primary-400 block mt-0.5">
                          Scheduled: {new Date(ticket.scheduled_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Financial summary: Admin sees invoice and margins; Tech sees billable total only */}
                    {isAdmin && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Invoice Total:</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            KES {Number(ticket.total_cost_kes || ticket.invoice_amount_kes || 0).toLocaleString()}
                          </span>
                        </div>
                        {ticket.gross_margin_kes !== undefined && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                            <span>Gross Margin:</span>
                            <span>KES {Number(ticket.gross_margin_kes).toLocaleString()} ({ticket.margin_percentage || 0}%)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {/* Left: Client Link & Public Tracker */}
                  <div className="flex items-center gap-2">
                    {ticket.tracking_token && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/api/public/tickets/track/${ticket.tracking_token}`
                          copyToClipboard(url, 'Client Live Tracking URL')
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Copy public link to share with diaspora landlord or Airbnb host"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-primary-500" />
                        Copy Live Tracker Link
                      </button>
                    )}

                    {ticket.approval_token && !ticket.approved_at && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/api/public/tickets/approve/${ticket.approval_token}`
                          copyToClipboard(url, 'Landlord One-Click Approval URL')
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-amber-600" />
                        Copy Landlord Approval Link
                      </button>
                    )}
                  </div>

                  {/* Right: Operational Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Status Advance Button */}
                    <button
                      onClick={() => {
                        setActiveTicket(ticket)
                        setStatusForm({ status: '', notes: '' })
                        setIsStatusModalOpen(true)
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors"
                    >
                      Update Status
                    </button>

                    {/* Dispatch (Admin Only) */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setActiveTicket(ticket)
                          setScheduleForm({
                            assigned_technician_id: ticket.assigned_technician_id || '',
                            scheduled_at: ticket.scheduled_at ? ticket.scheduled_at.slice(0, 16) : '',
                            notes: '',
                            create_task: true
                          })
                          setIsScheduleOpen(true)
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Dispatch / Schedule
                      </button>
                    )}

                    {/* Landlord Approval Request (Admin Only) */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setActiveTicket(ticket)
                          setApprovalForm({
                            action: 'request',
                            approval_threshold_kes: ticket.approval_threshold_kes || 5000,
                            notes: ''
                          })
                          setIsApprovalOpen(true)
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Landlord Quote
                      </button>
                    )}

                    {/* Record Job Costs & Parts */}
                    <button
                      onClick={() => {
                        setActiveTicket(ticket)
                        setCostsForm({
                          labour_hours: ticket.labour_hours || 1,
                          labour_billed_kes: ticket.labour_billed_kes || 1500,
                          parts_cost_kes: ticket.parts_cost_kes || 0,
                          parts_markup_percentage: ticket.parts_markup_percentage || 20,
                          callout_fee_kes: ticket.callout_fee_kes || 2000,
                          callout_fee_waived: Boolean(ticket.callout_fee_waived),
                          travel_cost_kes: ticket.travel_cost_kes || 0,
                          notes: ''
                        })
                        setIsCostsOpen(true)
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-xs font-semibold text-white transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {isTechnician ? 'Record Hours & Parts' : 'Record Costs & Invoice'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: CREATE TICKET (Admin/Manager) */}
      {/* ============================================================== */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary-600" />
                Open New Service Ticket
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Property
                  </label>
                  <select
                    value={createForm.property_id}
                    onChange={(e) => setCreateForm({ ...createForm, property_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  >
                    <option value="">Select Property (Optional)</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.address ? `(${p.address})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Landlord / Customer
                  </label>
                  <select
                    value={createForm.customer_id}
                    onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  >
                    <option value="">Select Landlord (Optional)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || `${c.first_name} ${c.last_name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Trade Category *
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  >
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="roofing">Roofing</option>
                    <option value="painting">Painting</option>
                    <option value="solar">Solar</option>
                    <option value="general">General Handyman</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority Tier *
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs font-medium"
                  >
                    <option value="emergency">Emergency (Interim 6h SLA)</option>
                    <option value="standard">Standard (24–48h SLA)</option>
                    <option value="planned">Planned (3–5 Working Days)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reported By (Tenant / Caretaker / Airbnb Guest)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins (+254711223344, Unit 4B)"
                  value={createForm.reported_by}
                  onChange={(e) => setCreateForm({ ...createForm, reported_by: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Issue Description & Fault Symptoms *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide precise details of the malfunction, location, and symptoms..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Callout Fee (KES)
                  </label>
                  <input
                    type="number"
                    value={createForm.callout_fee_kes}
                    onChange={(e) => setCreateForm({ ...createForm, callout_fee_kes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                  <span className="text-[11px] text-gray-400">Waived upon quote approval</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Emergency Auto-Approve Limit (KES)
                  </label>
                  <input
                    type="number"
                    value={createForm.emergency_auto_approve_limit_kes}
                    onChange={(e) => setCreateForm({ ...createForm, emergency_auto_approve_limit_kes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                  <span className="text-[11px] text-gray-400">Auto-contain without wake-up call</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-xs font-medium text-white shadow-sm"
                >
                  Open Ticket & Generate Tracker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: DISPATCH & SCHEDULE TECHNICIAN (Admin/Manager) */}
      {/* ============================================================== */}
      {isScheduleOpen && activeTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Dispatch Fundi & Schedule
              </h2>
              <button onClick={() => setIsScheduleOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Assigning {activeTicket.ticket_number} ({activeTicket.category}) to an NCA/EPRA certified field technician.
            </p>

            <form onSubmit={handleScheduleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Field Technician *
                </label>
                <select
                  required
                  value={scheduleForm.assigned_technician_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, assigned_technician_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                >
                  <option value="">Select Technician</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scheduled Arrival Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleForm.scheduled_at}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field Notes / Access Code for Technician
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Caretaker Mwangi has gate key. Ask for Unit 4B water inlet valve."
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create_task"
                  checked={scheduleForm.create_task}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, create_task: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="create_task" className="text-xs text-gray-700 dark:text-gray-300">
                  Create linked Task in CRM task list for technician
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-medium text-white shadow-sm"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: STATUS TRANSITION */}
      {/* ============================================================== */}
      {isStatusModalOpen && activeTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-sm w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Advance Ticket Status
              </h2>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Current Status: <span className="font-semibold capitalize">{activeTicket.status}</span>
            </p>

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Allowed Next Transitions *
                </label>
                <select
                  required
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs capitalize"
                >
                  <option value="">Select Target Status</option>
                  {(ALLOWED_TRANSITIONS[activeTicket.status] || []).map((st) => (
                    <option key={st} value={st}>
                      {st.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transition Notes / Resolution Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Replaced leaking pressure valve with brass fitting. Tested at 3.5 bar pressure."
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-xs font-medium text-white shadow-sm"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: LANDLORD APPROVAL WORKFLOW (Admin Only) */}
      {/* ============================================================== */}
      {isApprovalOpen && activeTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                Landlord Approval Portal
              </h2>
              <button onClick={() => setIsApprovalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold">Diagnostic Callout Waiver Policy:</p>
              <p>When the landlord approves the quote, the KES 2,000 diagnostic fee is automatically waived on the final invoice.</p>
            </div>

            <form onSubmit={handleApprovalSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Approval Action *
                </label>
                <select
                  value={approvalForm.action}
                  onChange={(e) => setApprovalForm({ ...approvalForm, action: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                >
                  <option value="request">Request Approval (Send Token Link)</option>
                  <option value="approve">Record Approval (Waive Callout Fee)</option>
                  <option value="reject">Record Landlord Rejection</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Approval Threshold (KES)
                </label>
                <input
                  type="number"
                  value={approvalForm.approval_threshold_kes}
                  onChange={(e) => setApprovalForm({ ...approvalForm, approval_threshold_kes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Landlord confirmed via WhatsApp call at 2:15 PM UK time."
                  value={approvalForm.notes}
                  onChange={(e) => setApprovalForm({ ...approvalForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              {activeTicket.approval_token && (
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                  <span className="text-xs font-medium text-gray-500 block">WhatsApp One-Click Link:</span>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`${window.location.origin}/api/public/tickets/approve/${activeTicket.approval_token}`}
                      className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1.5 rounded truncate"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/api/public/tickets/approve/${activeTicket.approval_token}`,
                          'One-Click Approval Link'
                        )
                      }
                      className="px-2.5 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsApprovalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-medium text-white shadow-sm"
                >
                  Submit Approval Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: RECORD COSTS & INVOICING (Role Gated) */}
      {/* ============================================================== */}
      {isCostsOpen && activeTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600" />
                {isTechnician ? 'Record Labour Hours & Parts Receipts' : 'Record Costs & Unit Economics'}
              </h2>
              <button onClick={() => setIsCostsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCostsSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Labour Hours Worked
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={costsForm.labour_hours}
                    onChange={(e) => setCostsForm({ ...costsForm, labour_hours: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Parts Cost (KES)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costsForm.parts_cost_kes}
                    onChange={(e) => setCostsForm({ ...costsForm, parts_cost_kes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>
              </div>

              {/* Admin-only financial controls: Markups, Labour Billed, Margins */}
              {isAdmin && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Labour Billed (KES)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={costsForm.labour_billed_kes}
                        onChange={(e) => setCostsForm({ ...costsForm, labour_billed_kes: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Parts Markup % (Default 20%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={costsForm.parts_markup_percentage}
                        onChange={(e) => setCostsForm({ ...costsForm, parts_markup_percentage: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="callout_waived"
                      checked={costsForm.callout_fee_waived}
                      onChange={(e) => setCostsForm({ ...costsForm, callout_fee_waived: e.target.checked })}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="callout_waived" className="text-xs text-gray-700 dark:text-gray-300">
                      Waive KES 2,000 Diagnostic Callout Fee
                    </label>
                  </div>

                  {/* Live Gross Margin Preview (Admin Only) */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-xs space-y-1">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200 block">
                      Estimated Landlord Invoice Total:
                    </span>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                      KES {calculatedInvoice.toLocaleString()}
                    </p>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">
                      Includes 20% parts margin + labour billing (Diagnostic fee: {costsForm.callout_fee_waived ? 'WAIVED' : 'KES 2,000'})
                    </span>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parts Description / Hardware Store Receipts
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 1x 25mm PVC elbow, 1x PTFE thread seal tape, 1x pressure regulator valve."
                  value={costsForm.notes}
                  onChange={(e) => setCostsForm({ ...costsForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsCostsOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-xs font-medium text-white shadow-sm"
                >
                  Save Costs & Invoicing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

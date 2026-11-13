// Properties.jsx
// Property Maintenance Passports, Health Scores & Preventive Maintenance for Sawa Repairs.
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Building2,
  Home,
  Plus,
  Search,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Copy,
  Calendar,
  Sparkles,
  ChevronRight,
  User,
  MapPin,
  X,
  Layers,
  Wrench,
  DollarSign,
  Activity,
  FileText,
  Info
} from 'lucide-react'
import { propertyService } from '../services/propertyService'
import { customerService } from '../services/customerService'
import { userService } from '../services/userService'
import { useAuthStore } from '../store/authStore'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const PREVENTIVE_PACKAGES = {
  airbnb_guest_ready: {
    title: 'Airbnb Guest-Ready Audit',
    badge: 'Superhost Priority',
    color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900',
    description: 'Instant water heater test, shower pressure, WiFi/smart locks, and HVAC check before check-in.'
  },
  pre_rains_leak_defense: {
    title: 'Pre-Rains Leak Defense',
    badge: 'Seasonal Defense',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900',
    description: 'Roof valley flashing, gutter clearing, downpipe clearance, and ceiling inspection before rainy seasons.'
  },
  quarterly_systems_check: {
    title: 'Quarterly Systems Check',
    badge: 'Preventive Care',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    description: 'Water pressure pumps, electrical distribution board torquing, drainage gully flushing, solar heaters.'
  }
}

export default function Properties() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  // Data states
  const [properties, setProperties] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAirbnb, setFilterAirbnb] = useState('all')

  // Modals & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isMemoryDrawerOpen, setIsMemoryDrawerOpen] = useState(false)
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [memoryData, setMemoryData] = useState(null)
  const [isLoadingMemory, setIsLoadingMemory] = useState(false)

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    customer_id: '',
    address: '',
    unit_count: 1,
    airbnb_managed: false,
    default_approval_threshold_kes: 5000,
    emergency_auto_containment_limit_kes: 8000,
    notes: ''
  })

  const [inspectionForm, setInspectionForm] = useState({
    package_type: 'airbnb_guest_ready',
    scheduled_date: '',
    assigned_technician_id: '',
    notes: ''
  })

  // Load properties
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [propsRes, custsRes, usersRes] = await Promise.all([
        propertyService.getProperties({ limit: 100 }),
        customerService.getCustomers({ limit: 100 }).catch(() => ({ data: { data: { customers: [] } } })),
        userService.getUsers().catch(() => ({ data: { data: { users: [] } } }))
      ])

      setProperties(propsRes.data?.data?.properties || [])
      setCustomers(custsRes.data?.data?.customers || [])
      setUsers(usersRes.data?.data?.users || [])
    } catch (err) {
      toast.error('Failed to load properties: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (filterAirbnb === 'airbnb' && !p.airbnb_managed) return false
      if (filterAirbnb === 'long_term' && p.airbnb_managed) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = p.name?.toLowerCase().includes(q)
        const matchAddr = p.address?.toLowerCase().includes(q)
        const matchLandlord = p.landlord_name?.toLowerCase().includes(q)
        return matchName || matchAddr || matchLandlord
      }
      return true
    })
  }, [properties, filterAirbnb, searchQuery])

  // Copy helper
  const copyToClipboard = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  // Open Maintenance Memory Drawer
  const handleOpenMemory = async (prop) => {
    setSelectedProperty(prop)
    setIsMemoryDrawerOpen(true)
    setIsLoadingMemory(true)
    try {
      const res = await propertyService.getMaintenanceMemory(prop.id)
      setMemoryData(res.data?.data || null)
    } catch (err) {
      toast.error('Failed to load maintenance memory: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsLoadingMemory(false)
    }
  }

  // Handle Create Property
  const handleCreateProperty = async (e) => {
    e.preventDefault()
    if (!createForm.name.trim()) {
      toast.error('Property name is required')
      return
    }

    try {
      await propertyService.createProperty({
        ...createForm,
        customer_id: createForm.customer_id ? Number(createForm.customer_id) : null,
        unit_count: Number(createForm.unit_count) || 1,
        airbnb_managed: createForm.airbnb_managed ? 1 : 0,
        default_approval_threshold_kes: Number(createForm.default_approval_threshold_kes) || 5000,
        emergency_auto_containment_limit_kes: Number(createForm.emergency_auto_containment_limit_kes) || 8000
      })
      toast.success('Property created & Passport token generated!')
      setIsCreateOpen(false)
      setCreateForm({
        name: '',
        customer_id: '',
        address: '',
        unit_count: 1,
        airbnb_managed: false,
        default_approval_threshold_kes: 5000,
        emergency_auto_containment_limit_kes: 8000,
        notes: ''
      })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create property')
    }
  }

  // Handle Schedule Preventive Inspection
  const handleScheduleInspection = async (e) => {
    e.preventDefault()
    if (!inspectionForm.scheduled_date) {
      toast.error('Scheduled date is required')
      return
    }

    try {
      await propertyService.schedulePreventiveInspection(selectedProperty.id, {
        package_type: inspectionForm.package_type,
        scheduled_date: new Date(inspectionForm.scheduled_date).toISOString().slice(0, 10),
        assigned_technician_id: inspectionForm.assigned_technician_id ? Number(inspectionForm.assigned_technician_id) : null,
        notes: inspectionForm.notes
      })
      toast.success('Preventive maintenance inspection scheduled!')
      setIsInspectionModalOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule inspection')
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Properties & Maintenance Passports
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-950/70 dark:text-primary-300">
              Per-Property Memory
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Digital Logbooks, recurring failure radar, and Airbnb Superhost readiness audits
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm shadow-sm transition-colors focus:ring-2 focus:ring-primary-500"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Property
          </button>
        )}
      </div>

      {/* Explanation Banner: Property Health Score Formula */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-4 text-xs text-blue-900 dark:text-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Property Health Score Formula (0–100 Scale):</p>
            <p>
              Starts at base <span className="font-semibold">100 points</span>. Deducts <span className="font-semibold text-red-600 dark:text-red-400">25 points</span> per unresolved emergency, <span className="font-semibold text-amber-600 dark:text-amber-400">15 points</span> per recurring category hotspot (&gt;2 incidents in 90 days), and up to <span className="font-semibold">30 points</span> for open routine maintenance tickets.
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-[11px]">
              Every landlord and Airbnb host can view their Property Maintenance Passport without logging into the CRM.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search properties by name, address, or landlord..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterAirbnb}
            onChange={(e) => setFilterAirbnb(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Portfolios</option>
            <option value="airbnb">Airbnb Managed Only</option>
            <option value="long_term">Long-Term Residential / Commercial</option>
          </select>
        </div>
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredProperties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties found"
          description="Register your managed properties to unlock per-property maintenance memory and digital logbooks."
          actionLabel={isAdmin ? 'Add Property' : undefined}
          onAction={isAdmin ? () => setIsCreateOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProperties.map((property) => {
            const passportUrl = `${window.location.origin}/passport/${property.passport_token}`

            return (
              <div
                key={property.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-primary-300 dark:hover:border-primary-800 transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Top Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug">
                        {property.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{property.address || 'Nairobi, Kenya'}</span>
                      </p>
                    </div>

                    {property.airbnb_managed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex-shrink-0">
                        <Sparkles className="w-3 h-3" />
                        Airbnb
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 flex-shrink-0">
                        {property.unit_count || 1} {property.unit_count === 1 ? 'Unit' : 'Units'}
                      </span>
                    )}
                  </div>

                  {/* Landlord contact */}
                  {property.landlord_name && (
                    <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                      <span className="truncate">Landlord: <strong className="text-gray-900 dark:text-gray-100">{property.landlord_name}</strong></span>
                      {property.landlord_phone && (
                        <span className="text-[11px] text-gray-400">{property.landlord_phone}</span>
                      )}
                    </div>
                  )}

                  {/* Thresholds */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 pt-1">
                    <div>
                      <span className="block text-gray-400">Approval Limit:</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        KES {Number(property.default_approval_threshold_kes || 5000).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Auto-Containment:</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        KES {Number(property.emergency_auto_containment_limit_kes || 8000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions & Buttons */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenMemory(property)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 dark:hover:bg-primary-900/50 text-xs font-semibold text-primary-700 dark:text-primary-300 transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Maintenance Memory
                    </button>

                    <button
                      onClick={() => copyToClipboard(passportUrl, 'Property Maintenance Passport URL')}
                      className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                      title="Copy public Property Maintenance Passport link for landlord"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setSelectedProperty(property)
                        setInspectionForm({
                          package_type: property.airbnb_managed ? 'airbnb_guest_ready' : 'quarterly_systems_check',
                          scheduled_date: new Date().toISOString().slice(0, 10),
                          assigned_technician_id: '',
                          notes: ''
                        })
                        setIsInspectionModalOpen(true)
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-xs font-medium text-emerald-800 dark:text-emerald-300 transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      Schedule Preventive Audit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* DRAWER: PROPERTY MAINTENANCE MEMORY & HEALTH SCORE */}
      {/* ============================================================== */}
      {isMemoryDrawerOpen && selectedProperty && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex justify-end">
          <div className="bg-white dark:bg-gray-900 w-full max-w-xl h-full shadow-2xl p-6 overflow-y-auto space-y-6 border-l border-gray-200 dark:border-gray-800">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedProperty.name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Property Maintenance Memory & Digital Passport
                </p>
              </div>
              <button
                onClick={() => setIsMemoryDrawerOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingMemory ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : memoryData ? (
              <div className="space-y-6">
                {/* Health Score Card */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/80 dark:to-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Property Health Score
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-4xl font-extrabold ${
                          memoryData.health_score.score >= 90
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : memoryData.health_score.score >= 75
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {memoryData.health_score.score}
                        </span>
                        <span className="text-sm text-gray-400">/ 100</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          memoryData.health_score.score >= 90
                            ? 'bg-emerald-100 text-emerald-800'
                            : memoryData.health_score.score >= 75
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {memoryData.health_score.grade}
                        </span>
                      </div>
                    </div>

                    <ShieldCheck className={`w-12 h-12 ${
                      memoryData.health_score.score >= 90 ? 'text-emerald-500' : 'text-amber-500'
                    }`} />
                  </div>

                  {/* Findings Narrative */}
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Findings & Diagnosis:</p>
                    <p>{memoryData.health_score.findings_narrative || 'All systems functioning nominally.'}</p>
                    {memoryData.health_score.formula_explanation && (
                      <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                        {memoryData.health_score.formula_explanation}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lifetime Summary Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span className="text-[11px] text-gray-500 block">Total Tickets</span>
                    <strong className="text-lg text-gray-900 dark:text-gray-100">
                      {memoryData.lifetime_summary.total_tickets}
                    </strong>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span className="text-[11px] text-gray-500 block">Lifetime Spend</span>
                    <strong className="text-lg text-gray-900 dark:text-gray-100">
                      KES {Number(memoryData.lifetime_summary.lifetime_spend_kes || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span className="text-[11px] text-gray-500 block">Labour Hours</span>
                    <strong className="text-lg text-gray-900 dark:text-gray-100">
                      {memoryData.lifetime_summary.lifetime_labour_hours || 0}h
                    </strong>
                  </div>
                </div>

                {/* Recurring Failure Hotspots */}
                {memoryData.recurring_alerts && memoryData.recurring_alerts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Recurring Failure Hotspots Flagged
                    </h4>
                    <div className="space-y-2">
                      {memoryData.recurring_alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 rounded-lg text-xs text-red-800 dark:text-red-300"
                        >
                          <p className="font-semibold capitalize">{alert.category} Issues ({alert.count} in 90 days)</p>
                          <p className="mt-0.5 text-[11px]">{alert.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category Breakdown */}
                {memoryData.category_breakdown && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Repair Spend by Category
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(memoryData.category_breakdown).map(([cat, data]) => (
                        <div key={cat} className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 flex justify-between items-center">
                          <span className="capitalize text-gray-700 dark:text-gray-300">{cat}:</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            KES {Number(data.total_kes || 0).toLocaleString()} ({data.count} jobs)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chronological Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Chronological Service History
                  </h4>
                  {memoryData.service_history_timeline.length === 0 ? (
                    <p className="text-xs text-gray-400">No service history recorded yet.</p>
                  ) : (
                    <div className="space-y-2 border-l-2 border-primary-200 dark:border-primary-900 pl-3">
                      {memoryData.service_history_timeline.map((item, idx) => (
                        <div key={idx} className="text-xs space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-gray-100">
                              {item.ticket_number}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                            <span className="capitalize font-medium text-primary-600 dark:text-primary-400">
                              [{item.category}]
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300">{item.description}</p>
                          <div className="text-[11px] text-gray-400 flex gap-3">
                            <span>Status: {item.status}</span>
                            <span>Invoice: KES {Number(item.total_cost_kes || 0).toLocaleString()}</span>
                            {item.warranty_until && (
                              <span className="text-emerald-600 font-medium">Warranty active</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Share Button */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/passport/${selectedProperty.passport_token}`
                      copyToClipboard(url, 'Property Maintenance Passport URL')
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-xs shadow-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Shareable Digital Passport Link for Landlord
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE PROPERTY (Admin/Manager) */}
      {/* ============================================================== */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                Add Managed Property
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Property Name / Estate & House # *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Kilimani Luxury Suites Apt 4B"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Landlord / Customer Account
                </label>
                <select
                  value={createForm.customer_id}
                  onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                >
                  <option value="">Select Landlord</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || `${c.first_name} ${c.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address / Physical Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chania Ave, Kilimani"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={createForm.unit_count}
                    onChange={(e) => setCreateForm({ ...createForm, unit_count: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="airbnb_managed"
                  checked={createForm.airbnb_managed}
                  onChange={(e) => setCreateForm({ ...createForm, airbnb_managed: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="airbnb_managed" className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                  Airbnb / Short-Term Rental Unit (Enables Superhost Checklist)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Approval Threshold (KES)
                  </label>
                  <input
                    type="number"
                    value={createForm.default_approval_threshold_kes}
                    onChange={(e) => setCreateForm({ ...createForm, default_approval_threshold_kes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Emergency Limit (KES)
                  </label>
                  <input
                    type="number"
                    value={createForm.emergency_auto_containment_limit_kes}
                    onChange={(e) => setCreateForm({ ...createForm, emergency_auto_containment_limit_kes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-xs font-medium text-white shadow-sm"
                >
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PREVENTIVE MAINTENANCE SCHEDULER (Admin/Manager) */}
      {/* ============================================================== */}
      {isInspectionModalOpen && selectedProperty && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Schedule Preventive Inspection
              </h2>
              <button onClick={() => setIsInspectionModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleInspection} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Inspection Package Type *
                </label>
                <select
                  value={inspectionForm.package_type}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, package_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                >
                  <option value="airbnb_guest_ready">Airbnb Guest-Ready Audit</option>
                  <option value="pre_rains_leak_defense">Pre-Rains Leak Defense</option>
                  <option value="quarterly_systems_check">Quarterly Systems Check</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  {PREVENTIVE_PACKAGES[inspectionForm.package_type]?.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Inspection Date *
                </label>
                <input
                  required
                  type="date"
                  value={inspectionForm.scheduled_date}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assigned Auditor / Technician
                </label>
                <select
                  value={inspectionForm.assigned_technician_id}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, assigned_technician_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                >
                  <option value="">Select Auditor (Optional)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Audit Notes / Caretaker Contact
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Guest checks in at 2 PM Friday. Complete water pressure & AC audit by noon."
                  value={inspectionForm.notes}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsInspectionModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-medium text-white shadow-sm"
                >
                  Schedule Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

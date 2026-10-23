// Matters.jsx
// Legal / Professional Services Pack: matters & cases, court hearing dates, deadlines, opposing party, and billable time tracking.
import React, { useEffect, useState, useMemo } from 'react'
import {
  Scale,
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Gavel,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { matterService } from '../services/matterService'
import { customerService } from '../services/customerService'
import { formatCurrencyKES } from '../utils/formatters'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const PRACTICE_AREAS = [
  'Conveyancing & Land Law',
  'Commercial Litigation',
  'Corporate & M&A',
  'Employment & Labour',
  'Family & Succession',
  'Tax Advisory & Dispute',
  'Constitutional & Judicial Review',
  'Banking & Securities'
]

const STATUS_BADGES = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  pending_hearing: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  on_hold: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800'
}

const Matters = () => {
  const [matters, setMatters] = useState([])
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showNewMatterModal, setShowNewMatterModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedMatterForTime, setSelectedMatterForTime] = useState(null)

  // New Matter Form
  const [form, setForm] = useState({
    caseNumber: '',
    title: '',
    clientId: '',
    practiceArea: 'Conveyancing & Land Law',
    courtName: 'High Court Milimani',
    judgeOrArbitrator: '',
    opposingParty: '',
    opposingCounsel: '',
    billingType: 'fixed_fee',
    feeAmountKes: '',
    hourlyRateKes: '',
    priority: 'medium',
    nextHearingDate: '',
    filingDeadline: '',
    notes: ''
  })

  // Time Entry Form
  const [timeForm, setTimeForm] = useState({
    activityType: 'drafting',
    durationMinutes: '60',
    hourlyRateKes: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [mattersRes, custRes] = await Promise.all([
        matterService.getMatters({ limit: 100 }),
        customerService.getCustomers({ limit: 100 })
      ])

      if (mattersRes.data?.success) {
        setMatters(mattersRes.data.data.matters || [])
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
    } catch (err) {
      // Fallback sample data
      setMatters([
        {
          id: 1,
          case_number: 'HCCC/COMM/102/2026',
          title: 'KCB Bank vs Apex Securities Ltd',
          client_name: 'KCB Bank Kenya',
          practice_area: 'Commercial Litigation',
          court_name: 'High Court Commercial Division Milimani',
          opposing_party: 'Apex Securities Ltd',
          billing_type: 'hourly',
          hourly_rate_kes: 18000,
          status: 'pending_hearing',
          priority: 'high',
          next_hearing_date: '2026-11-15',
          filing_deadline: '2026-11-01',
          advocate_name: 'Philip Oraro'
        },
        {
          id: 2,
          case_number: 'ELC/2026/45',
          title: 'Land Ownership Dispute - Karen Block',
          client_name: 'Grace Wanjiru',
          practice_area: 'Conveyancing & Land Law',
          court_name: 'Environment and Land Court (ELC)',
          opposing_party: 'Nairobi County Council',
          billing_type: 'fixed_fee',
          fee_amount_kes: 350000,
          status: 'active',
          priority: 'medium',
          next_hearing_date: '2026-12-02',
          advocate_name: 'Jane Mutua'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredMatters = useMemo(() => {
    return matters.filter((m) => {
      const text = `${m.title || ''} ${m.case_number || ''} ${m.client_name || ''} ${m.court_name || ''} ${m.opposing_party || ''}`.toLowerCase()
      const matchSearch = text.includes(searchTerm.toLowerCase())
      const matchPractice = practiceFilter === 'all' || m.practice_area === practiceFilter
      const matchStatus = statusFilter === 'all' || m.status === statusFilter
      return matchSearch && matchPractice && matchStatus
    })
  }, [matters, searchTerm, practiceFilter, statusFilter])

  const metrics = useMemo(() => {
    const total = matters.length
    const active = matters.filter((m) => m.status === 'active' || m.status === 'pending_hearing').length
    const pendingHearings = matters.filter((m) => m.next_hearing_date).length
    const totalFixedFees = matters.reduce((sum, m) => sum + (parseFloat(m.fee_amount_kes) || 0), 0)
    return { total, active, pendingHearings, totalFixedFees }
  }, [matters])

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.clientId) {
      toast.error('Title and Client selection are required')
      return
    }

    try {
      await matterService.createMatter({
        caseNumber: form.caseNumber.trim().toUpperCase(),
        title: form.title,
        clientId: parseInt(form.clientId, 10),
        practiceArea: form.practiceArea,
        courtName: form.courtName,
        judgeOrArbitrator: form.judgeOrArbitrator,
        opposingParty: form.opposingParty,
        opposingCounsel: form.opposingCounsel,
        billingType: form.billingType,
        feeAmountKes: form.feeAmountKes ? parseFloat(form.feeAmountKes) : null,
        hourlyRateKes: form.hourlyRateKes ? parseFloat(form.hourlyRateKes) : null,
        priority: form.priority,
        nextHearingDate: form.nextHearingDate || null,
        filingDeadline: form.filingDeadline || null,
        notes: form.notes
      })
      toast.success('Legal matter opened successfully')
      setShowNewMatterModal(false)
      setForm({
        caseNumber: '',
        title: '',
        clientId: '',
        practiceArea: 'Conveyancing & Land Law',
        courtName: 'High Court Milimani',
        judgeOrArbitrator: '',
        opposingParty: '',
        opposingCounsel: '',
        billingType: 'fixed_fee',
        feeAmountKes: '',
        hourlyRateKes: '',
        priority: 'medium',
        nextHearingDate: '',
        filingDeadline: '',
        notes: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to open matter')
    }
  }

  const handleTimeSubmit = async (e) => {
    e.preventDefault()
    if (!selectedMatterForTime || !timeForm.durationMinutes) return

    try {
      await matterService.logTimeEntry(selectedMatterForTime.id, {
        activityType: timeForm.activityType,
        durationMinutes: parseInt(timeForm.durationMinutes, 10),
        hourlyRateKes: timeForm.hourlyRateKes ? parseFloat(timeForm.hourlyRateKes) : null,
        date: timeForm.date,
        description: timeForm.description
      })
      toast.success('Billable time entry recorded')
      setShowTimeModal(false)
      setSelectedMatterForTime(null)
      setTimeForm({
        activityType: 'drafting',
        durationMinutes: '60',
        hourlyRateKes: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      })
    } catch (err) {
      toast.error('Failed to log time entry')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Legal Matters & Cases</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
              Industry Pack 2
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Law firm matter management, court hearing dates, opposing parties, deadlines, and billable time entries.
          </p>
        </div>

        <button
          onClick={() => setShowNewMatterModal(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Open Matter / Case
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Active Matters</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{metrics.active}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase">Court Hearings Due</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.pendingHearings}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-purple-600 uppercase">Total Files</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">{metrics.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Fixed Fee Pipeline</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            {formatCurrencyKES(metrics.totalFixedFees)}
          </p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by case #, title, client, court..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <select
            value={practiceFilter}
            onChange={(e) => setPracticeFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Practice Areas</option>
            {PRACTICE_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_hearing">Pending Hearing</option>
            <option value="closed">Closed</option>
            <option value="on_hold">On Hold</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Matters List */}
      {filteredMatters.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No Legal Matters Found"
          description="Open your law firm cases, track hearing dates in Kenyan courts, and record billable advocate hours."
          actionLabel="Open First Matter"
          onAction={() => setShowNewMatterModal(true)}
        />
      ) : (
        <div className="space-y-4">
          {filteredMatters.map((matter) => {
            const statusClass = STATUS_BADGES[matter.status] || STATUS_BADGES.active
            const hasHearing = Boolean(matter.next_hearing_date)

            return (
              <div
                key={matter.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {matter.case_number && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold">
                          {matter.case_number}
                        </span>
                      )}
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        {matter.practice_area}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusClass}`}>
                        {matter.status ? matter.status.replace('_', ' ') : 'Active'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{matter.title}</h3>

                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-primary-600 font-medium">
                        <User className="w-3.5 h-3.5" />
                        Client: {matter.client_name || 'Direct Client'}
                      </span>
                      {matter.court_name && (
                        <span className="flex items-center gap-1">
                          <Gavel className="w-3.5 h-3.5 text-gray-400" />
                          {matter.court_name}
                        </span>
                      )}
                      {matter.opposing_party && (
                        <span>vs. <span className="font-medium text-gray-700 dark:text-gray-300">{matter.opposing_party}</span></span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedMatterForTime(matter)
                        setTimeForm((prev) => ({
                          ...prev,
                          hourlyRateKes: matter.hourly_rate_kes || ''
                        }))
                        setShowTimeModal(true)
                      }}
                      className="inline-flex items-center px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-800 transition"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      Log Time
                    </button>
                    {matter.fee_amount_kes ? (
                      <span className="text-xs font-bold text-emerald-600">
                        {formatCurrencyKES(matter.fee_amount_kes)} (Fixed)
                      </span>
                    ) : matter.hourly_rate_kes ? (
                      <span className="text-xs text-gray-500">
                        {formatCurrencyKES(matter.hourly_rate_kes)} / hr
                      </span>
                    ) : null}
                  </div>
                </div>

                {hasHearing && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                    <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      <strong className="font-semibold">Next Court Hearing:</strong>{' '}
                      {new Date(matter.next_hearing_date).toLocaleDateString('en-KE', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    {matter.filingDeadline && (
                      <span className="ml-auto text-amber-700 dark:text-amber-400">
                        Filing Deadline: {new Date(matter.filingDeadline).toLocaleDateString('en-KE')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Open New Matter Modal */}
      {showNewMatterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-600" />
                Open New Legal Matter / Case
              </h3>
              <button
                onClick={() => setShowNewMatterModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Case / Matter Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HCCC/COMM/102/2026"
                    value={form.caseNumber}
                    onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Practice Area
                  </label>
                  <select
                    value={form.practiceArea}
                    onChange={(e) => setForm({ ...form, practiceArea: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {PRACTICE_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Matter Title / Cause of Action
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mwangi vs Kenya Power (Property Damage Claim)"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Instructing Client
                </label>
                <select
                  required
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Client</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name || c.firstName} {c.last_name || c.lastName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Court / Tribunal
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. High Court Milimani"
                    value={form.courtName}
                    onChange={(e) => setForm({ ...form, courtName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Opposing Party
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kenya Power & Lighting"
                    value={form.opposingParty}
                    onChange={(e) => setForm({ ...form, opposingParty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Billing Structure
                  </label>
                  <select
                    value={form.billingType}
                    onChange={(e) => setForm({ ...form, billingType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="fixed_fee">Fixed Fee (Agreed Retainer)</option>
                    <option value="hourly">Hourly Rate</option>
                    <option value="retainer">Monthly Retainer</option>
                    <option value="pro_bono">Pro Bono</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Fee / Rate (KES)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 250000"
                    value={form.billingType === 'hourly' ? form.hourlyRateKes : form.feeAmountKes}
                    onChange={(e) => {
                      if (form.billingType === 'hourly') {
                        setForm({ ...form, hourlyRateKes: e.target.value })
                      } else {
                        setForm({ ...form, feeAmountKes: e.target.value })
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Next Court Hearing Date
                  </label>
                  <input
                    type="date"
                    value={form.nextHearingDate}
                    onChange={(e) => setForm({ ...form, nextHearingDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Filing Deadline
                  </label>
                  <input
                    type="date"
                    value={form.filingDeadline}
                    onChange={(e) => setForm({ ...form, filingDeadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowNewMatterModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Open Matter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Time Entry Modal */}
      {showTimeModal && selectedMatterForTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Log Billable Hours</h3>
                <p className="text-xs text-gray-500 truncate">{selectedMatterForTime.title}</p>
              </div>
              <button
                onClick={() => setShowTimeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleTimeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Activity Type
                </label>
                <select
                  value={timeForm.activityType}
                  onChange={(e) => setTimeForm({ ...timeForm, activityType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="court_appearance">Court Hearing / Appearance</option>
                  <option value="drafting">Pleadings / Agreement Drafting</option>
                  <option value="client_consultation">Client Consultation</option>
                  <option value="legal_research">Legal Research & Authorities</option>
                  <option value="negotiation">Out-of-Court Negotiation</option>
                  <option value="registry_filing">Registry Filing & Service</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 90"
                    value={timeForm.durationMinutes}
                    onChange={(e) => setTimeForm({ ...timeForm, durationMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Hourly Rate (KES)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={timeForm.hourlyRateKes}
                    onChange={(e) => setTimeForm({ ...timeForm, hourlyRateKes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Activity Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Appeared before Lady Justice Ong'udi for mention; filed submissions..."
                  value={timeForm.description}
                  onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Record Billable Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Matters

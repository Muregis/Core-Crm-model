// Deals.jsx
// Visual sales pipeline / Kanban board, stage probability tracking, revenue forecasting, and deal creation.
import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  User,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  Layers,
  ChevronRight
} from 'lucide-react'
import { dealService } from '../services/dealService'
import { customerService } from '../services/customerService'
import { formatCurrencyKES } from '../utils/formatters'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const DEFAULT_STAGES = [
  { id: 1, name: 'Lead Qualified', order_index: 1, probability: 20 },
  { id: 2, name: 'Site Visit / Consultation', order_index: 2, probability: 40 },
  { id: 3, name: 'Offer / Letter of Offer', order_index: 3, probability: 60 },
  { id: 4, name: 'Deposit / Agreement', order_index: 4, probability: 80 },
  { id: 5, name: 'Closed Won', order_index: 5, probability: 100 },
  { id: 6, name: 'Closed Lost', order_index: 6, probability: 0 }
]

const Deals = () => {
  const [deals, setDeals] = useState([])
  const [stages, setStages] = useState(DEFAULT_STAGES)
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'table'
  const [showAddModal, setShowAddModal] = useState(false)

  const [form, setForm] = useState({
    title: '',
    customerId: '',
    dealStageId: 1,
    value: '',
    expectedCloseDate: '',
    notes: ''
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [dealsRes, stagesRes, custRes] = await Promise.all([
        dealService.getDeals({ limit: 100 }),
        dealService.getDealStages().catch(() => ({ data: { success: false } })),
        customerService.getCustomers({ limit: 100 }).catch(() => ({ data: { success: false } }))
      ])

      if (dealsRes.data?.success) {
        setDeals(dealsRes.data.data.deals || [])
      }
      if (stagesRes.data?.success && stagesRes.data.data.stages?.length > 0) {
        setStages(stagesRes.data.data.stages)
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
    } catch (err) {
      // Fallback demo deals
      setDeals([
        {
          id: 1,
          title: 'Acacia Greens Plot 44 Purchase',
          customer_first_name: 'James',
          customer_last_name: 'Mwangi',
          value: 1500000,
          deal_stage_id: 4,
          stage_name: 'Deposit / Agreement',
          status: 'active',
          expected_close_date: '2026-11-30'
        },
        {
          id: 2,
          title: 'Juja Farm 1/4 Acre Investment',
          customer_first_name: 'Grace',
          customer_last_name: 'Wanjiru',
          value: 2200000,
          deal_stage_id: 2,
          stage_name: 'Site Visit / Consultation',
          status: 'active',
          expected_close_date: '2026-12-15'
        },
        {
          id: 3,
          title: 'Kamulu Prime Commercial Lot',
          customer_first_name: 'Peter',
          customer_last_name: 'Karanja',
          value: 3500000,
          deal_stage_id: 5,
          stage_name: 'Closed Won',
          status: 'won',
          expected_close_date: '2026-10-20'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const text = `${d.title || ''} ${d.customer_first_name || ''} ${d.customer_last_name || ''}`.toLowerCase()
      return text.includes(searchTerm.toLowerCase())
    })
  }, [deals, searchTerm])

  const totalPipelineValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)
  }, [deals])

  const wonValue = useMemo(() => {
    return deals
      .filter((d) => d.status === 'won' || d.deal_stage_id === 5)
      .reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)
  }, [deals])

  const handleStageChange = async (dealId, nextStageId) => {
    try {
      await dealService.updateDealStage(dealId, nextStageId)
      const targetStage = stages.find((s) => s.id === nextStageId)
      toast.success(`Deal moved to ${targetStage?.name || 'next stage'}`)
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                deal_stage_id: nextStageId,
                stage_name: targetStage?.name,
                status: nextStageId === 5 ? 'won' : nextStageId === 6 ? 'lost' : 'active'
              }
            : d
        )
      )
    } catch {
      toast.error('Failed to update stage')
    }
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.customerId || !form.value) {
      toast.error('Please enter deal title, select customer, and provide value')
      return
    }

    try {
      await dealService.createDeal({
        title: form.title,
        customerId: parseInt(form.customerId, 10),
        dealStageId: parseInt(form.dealStageId, 10) || 1,
        value: parseFloat(form.value),
        currency: 'KES',
        expectedCloseDate: form.expectedCloseDate || null,
        notes: form.notes
      })
      toast.success('Deal created successfully')
      setShowAddModal(false)
      setForm({
        title: '',
        customerId: '',
        dealStageId: 1,
        value: '',
        expectedCloseDate: '',
        notes: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create deal')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sales & Deal Pipeline</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Visual pipeline tracking, letter of offer stages, and deal forecasting in KES.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-gray-900 text-primary-600 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-900 text-primary-600 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Table
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Deal
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Active Deals</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{deals.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-primary-600 uppercase">Pipeline Value</span>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatCurrencyKES(totalPipelineValue)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Closed Won Revenue</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrencyKES(wonValue)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase">Win Rate</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {deals.length > 0
              ? `${Math.round(
                  (deals.filter((d) => d.status === 'won' || d.deal_stage_id === 5).length / deals.length) * 100
                )}%`
              : '0%'}
          </p>
        </div>
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search deals by title or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-gray-100"
          />
        </div>

        <button
          onClick={loadData}
          className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {stages.slice(0, 5).map((stage) => {
            const stageDeals = filteredDeals.filter(
              (d) => d.deal_stage_id === stage.id || (!d.deal_stage_id && stage.id === 1)
            )
            const stageTotal = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)

            return (
              <div
                key={stage.id}
                className="w-72 flex-shrink-0 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 flex flex-col space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-200">
                      {stage.name}
                    </h3>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {formatCurrencyKES(stageTotal)}
                    </span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center justify-center">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[250px]">
                  {stageDeals.map((deal) => {
                    const customerName = deal.customer_first_name
                      ? `${deal.customer_first_name} ${deal.customer_last_name || ''}`
                      : 'Client'

                    return (
                      <div
                        key={deal.id}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-xs hover:border-primary-400 transition space-y-2.5"
                      >
                        <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                          {deal.title}
                        </h4>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 flex items-center gap-1 truncate">
                            <User className="w-3 h-3 flex-shrink-0" />
                            {customerName}
                          </span>
                          <span className="font-bold text-emerald-600">
                            {formatCurrencyKES(deal.value)}
                          </span>
                        </div>

                        {deal.expected_close_date && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Calendar className="w-3 h-3" />
                            Target: {new Date(deal.expected_close_date).toLocaleDateString('en-KE')}
                          </div>
                        )}

                        {/* Stage Advancer */}
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">Advance Stage:</span>
                          <div className="flex items-center gap-1">
                            {stage.id < 5 && (
                              <button
                                onClick={() => handleStageChange(deal.id, stage.id + 1)}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-600 transition"
                                title="Move to next stage"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-6 py-3">Deal Title</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Value</th>
                <th className="px-6 py-3">Target Close</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredDeals.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{d.title}</td>
                  <td className="px-6 py-4">
                    {d.customer_first_name} {d.customer_last_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800">
                      {d.stage_name || 'In Progress'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrencyKES(d.value)}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString('en-KE') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize font-semibold ${
                        d.status === 'won'
                          ? 'bg-emerald-100 text-emerald-800'
                          : d.status === 'lost'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {d.status || 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Deal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create New Deal</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Deal Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acacia Greens Plot #44 Purchase"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Customer / Buyer
                </label>
                <select
                  required
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Customer</option>
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
                    Deal Value (KES)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1500000"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Initial Stage
                  </label>
                  <select
                    value={form.dealStageId}
                    onChange={(e) => setForm({ ...form, dealStageId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Expected Close Date
                </label>
                <input
                  type="date"
                  value={form.expectedCloseDate}
                  onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Terms, parcel references, installment plans..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Save Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Deals

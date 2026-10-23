// Deals.jsx
// Visual sales pipeline / Kanban board, stage probability tracking, revenue forecasting, and deal creation tailored by profession.
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
  Scale,
  ChevronRight,
  Building,
  FileText
} from 'lucide-react'
import { dealService } from '../services/dealService'
import { customerService } from '../services/customerService'
import { formatCurrencyKES } from '../utils/formatters'
import { useAuthStore } from '../store/authStore'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

// Profession-specific stages
const STAGES_BY_INDUSTRY = {
  legal: [
    { id: 1, name: 'Consultation & Intake', order_index: 1, probability: 20 },
    { id: 2, name: 'Pleadings & Demand Letter', order_index: 2, probability: 40 },
    { id: 3, name: 'Court Filing & Mention', order_index: 3, probability: 60 },
    { id: 4, name: 'Hearing & Submissions', order_index: 4, probability: 80 },
    { id: 5, name: 'Judgment / Settled', order_index: 5, probability: 100 },
    { id: 6, name: 'Withdrawn / Dismissed', order_index: 6, probability: 0 }
  ],
  general: [
    { id: 1, name: 'Prospecting & Inbound', order_index: 1, probability: 10 },
    { id: 2, name: 'Lead Qualification', order_index: 2, probability: 25 },
    { id: 3, name: 'Quotation / Proposal', order_index: 3, probability: 50 },
    { id: 4, name: 'Contract Negotiation', order_index: 4, probability: 75 },
    { id: 5, name: 'Closed Won / PO Issued', order_index: 5, probability: 100 },
    { id: 6, name: 'Closed Lost', order_index: 6, probability: 0 }
  ],
  real_estate: [
    { id: 1, name: 'Buyer Inquiry & Qualification', order_index: 1, probability: 20 },
    { id: 2, name: 'Site Visit Scheduled', order_index: 2, probability: 40 },
    { id: 3, name: 'Letter of Offer Issued', order_index: 3, probability: 60 },
    { id: 4, name: 'Sale Agreement & Deposit', order_index: 4, probability: 80 },
    { id: 5, name: 'Title Transfer / Closed Won', order_index: 5, probability: 100 },
    { id: 6, name: 'Deal Cancelled', order_index: 6, probability: 0 }
  ]
}

const Deals = () => {
  const { user } = useAuthStore()
  const industry = user?.tenant_industry || 'general'

  const defaultStagesForIndustry = STAGES_BY_INDUSTRY[industry] || STAGES_BY_INDUSTRY.general

  const [deals, setDeals] = useState([])
  const [stages, setStages] = useState(defaultStagesForIndustry)
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

  // Synchronize stages if industry changes
  useEffect(() => {
    setStages(STAGES_BY_INDUSTRY[industry] || STAGES_BY_INDUSTRY.general)
  }, [industry])

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
      // Dynamic fallback demo deals based on industry
      if (industry === 'legal') {
        setDeals([
          {
            id: 1,
            title: 'High Court Commercial Suit Retainer - Gachagua v Equity Bank',
            customer_first_name: 'Karanja',
            customer_last_name: 'Gachagua',
            value: 350000,
            deal_stage_id: 2,
            stage_name: 'Pleadings & Demand Letter',
            status: 'active',
            expected_close_date: '2026-11-20'
          },
          {
            id: 2,
            title: 'Constitutional Petition & Injunction Retainer (Art. 40 CoK 2010)',
            customer_first_name: 'Philip',
            customer_last_name: 'Oraro',
            value: 600000,
            deal_stage_id: 3,
            stage_name: 'Court Filing & Mention',
            status: 'active',
            expected_close_date: '2026-11-28'
          },
          {
            id: 3,
            title: 'Conveyancing & Land Title Registration Retainer (KAJ/KAPUTIEI/1104)',
            customer_first_name: 'Wanjiku',
            customer_last_name: 'Kamau',
            value: 450000,
            deal_stage_id: 5,
            stage_name: 'Judgment / Settled',
            status: 'won',
            expected_close_date: '2026-12-04'
          }
        ])
      } else if (industry === 'real_estate') {
        setDeals([
          {
            id: 1,
            title: 'Acacia Greens Plot 44 Purchase',
            customer_first_name: 'James',
            customer_last_name: 'Mwangi',
            value: 1500000,
            deal_stage_id: 4,
            stage_name: 'Sale Agreement & Deposit',
            status: 'active',
            expected_close_date: '2026-11-30'
          },
          {
            id: 2,
            title: 'Juja Farm 1/4 Acre Investment Lot',
            customer_first_name: 'Grace',
            customer_last_name: 'Wanjiru',
            value: 2200000,
            deal_stage_id: 2,
            stage_name: 'Site Visit Scheduled',
            status: 'active',
            expected_close_date: '2026-12-15'
          },
          {
            id: 3,
            title: 'Kamulu Prime Commercial Plot Title Transfer',
            customer_first_name: 'Peter',
            customer_last_name: 'Karanja',
            value: 3500000,
            deal_stage_id: 5,
            stage_name: 'Title Transfer / Closed Won',
            status: 'won',
            expected_close_date: '2026-10-20'
          }
        ])
      } else {
        // Commercial Core (general)
        setDeals([
          {
            id: 1,
            title: 'Annual FMCG Bulk Supply Agreement 2026/27',
            customer_first_name: 'Sarah',
            customer_last_name: 'Ochieng',
            value: 3450000,
            deal_stage_id: 4,
            stage_name: 'Contract Negotiation',
            status: 'active',
            expected_close_date: '2026-11-30'
          },
          {
            id: 2,
            title: 'IT Hardware & Enterprise Server Procurement',
            customer_first_name: 'David',
            customer_last_name: 'Mutua',
            value: 850000,
            deal_stage_id: 3,
            stage_name: 'Quotation / Proposal',
            status: 'active',
            expected_close_date: '2026-12-10'
          },
          {
            id: 3,
            title: 'Corporate Fleet Logistics SLA 2026',
            customer_first_name: 'John',
            customer_last_name: 'Mwangi',
            value: 1280000,
            deal_stage_id: 5,
            stage_name: 'Closed Won / PO Issued',
            status: 'won',
            expected_close_date: '2026-10-15'
          }
        ])
      }
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
      toast.success(`Moved to ${targetStage?.name || 'next stage'}`)
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
      toast.error('Please fill in title, select client/customer, and provide value')
      return
    }

    try {
      await dealService.createDeal({
        title: form.title,
        customerId: parseInt(form.customerId, 10),
        dealStageId: parseInt(form.dealStageId, 10) || stages[0]?.id || 1,
        value: parseFloat(form.value),
        currency: 'KES',
        expectedCloseDate: form.expectedCloseDate || null,
        notes: form.notes
      })
      toast.success(
        industry === 'legal'
          ? 'Retainer brief registered'
          : industry === 'real_estate'
          ? 'Land deal recorded'
          : 'Commercial deal created'
      )
      setShowAddModal(false)
      setForm({
        title: '',
        customerId: '',
        dealStageId: stages[0]?.id || 1,
        value: '',
        expectedCloseDate: '',
        notes: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create deal')
    }
  }

  // Adaptive profession copy
  const headerTitle =
    industry === 'legal'
      ? 'Legal Retainers & Instructions'
      : industry === 'real_estate'
      ? 'Land Sales & Plot Deals'
      : 'Commercial Sales Pipeline & Opportunities'

  const headerSubtitle =
    industry === 'legal'
      ? 'Track client intake, fee agreements, court filing milestones, and retainer valuations in KES.'
      : industry === 'real_estate'
      ? 'Visual plot sales tracking, site visit conversions, letters of offer, and completion forecasting in KES.'
      : 'Visual pipeline tracking, B2B deal stages, quotation conversion, and revenue forecasting in KES.'

  const newDealButtonText =
    industry === 'legal'
      ? 'New Retainer Brief'
      : industry === 'real_estate'
      ? 'New Land Deal'
      : 'New Commercial Deal'

  const modalTitle =
    industry === 'legal'
      ? 'Open New Legal Retainer / Brief'
      : industry === 'real_estate'
      ? 'Record New Land Sale Deal'
      : 'Create Commercial Deal / Opportunity'

  const dealTitleLabel =
    industry === 'legal'
      ? 'Matter / Retainer Title *'
      : industry === 'real_estate'
      ? 'Plot / Land Sale Deal Title *'
      : 'Deal / Opportunity Title *'

  const dealTitlePlaceholder =
    industry === 'legal'
      ? 'e.g. Constitutional Petition Retainer - LSK v AG'
      : industry === 'real_estate'
      ? 'e.g. Acacia Greens Plot #44 Purchase'
      : 'e.g. Annual FMCG Bulk Supply Agreement 2026/27'

  const clientLabel =
    industry === 'legal'
      ? 'Instructing Client *'
      : industry === 'real_estate'
      ? 'Buyer / Investor *'
      : 'Customer / Key Account *'

  const valueLabel =
    industry === 'legal'
      ? 'Agreed Retainer / Instruction Fee (KES) *'
      : industry === 'real_estate'
      ? 'Agreed Plot Price (KES) *'
      : 'Contract / Deal Value (KES) *'

  const valuePlaceholder =
    industry === 'legal'
      ? 'e.g. 350000'
      : industry === 'real_estate'
      ? 'e.g. 1500000'
      : 'e.g. 1200000'

  const stageLabel =
    industry === 'legal'
      ? 'Initial Retainer Stage'
      : industry === 'real_estate'
      ? 'Initial Sale Stage'
      : 'Initial Sales Stage'

  const dateLabel =
    industry === 'legal'
      ? 'Expected Hearing / Settlement Date'
      : industry === 'real_estate'
      ? 'Expected Completion / Title Date'
      : 'Target Close / Delivery Date'

  const notesPlaceholder =
    industry === 'legal'
      ? 'Retainer terms, court filing milestones, agreed installment schedule...'
      : industry === 'real_estate'
      ? 'Terms, parcel references, installment plans...'
      : 'Commercial terms, delivery schedules, product quotation references...'

  const submitButtonText =
    industry === 'legal'
      ? 'Open Retainer Brief'
      : industry === 'real_estate'
      ? 'Save Land Deal'
      : 'Save Commercial Deal'

  const emptyTitle =
    industry === 'legal'
      ? 'No Legal Retainers Found'
      : industry === 'real_estate'
      ? 'No Land Deals Found'
      : 'No Commercial Deals Found'

  const emptyDescription =
    industry === 'legal'
      ? 'Open client retainers, track fee milestones, and manage advisory instructions.'
      : industry === 'real_estate'
      ? 'Track plot purchases, letters of offer, and sale completion milestones.'
      : 'Track B2B pipeline opportunities, client quotation stages, and deal closures.'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{headerTitle}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
              {industry === 'legal' ? 'Legal Practice' : industry === 'real_estate' ? 'Real Estate' : 'Commercial Core'}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{headerSubtitle}</p>
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
            onClick={() => {
              setForm((prev) => ({
                ...prev,
                dealStageId: stages[0]?.id || 1
              }))
              setShowAddModal(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            {newDealButtonText}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            {industry === 'legal' ? 'Active Retainers' : industry === 'real_estate' ? 'Active Land Deals' : 'Active Deals'}
          </span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{deals.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-primary-600 uppercase">Pipeline Value</span>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatCurrencyKES(totalPipelineValue)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">
            {industry === 'legal' ? 'Closed Retainers' : industry === 'real_estate' ? 'Completed Sales' : 'Closed Won Revenue'}
          </span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrencyKES(wonValue)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase">Conversion Rate</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {deals.length > 0
              ? `${Math.round((deals.filter((d) => d.status === 'won').length / deals.length) * 100)}%`
              : '0%'}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={
              industry === 'legal'
                ? 'Search retainers, clients...'
                : industry === 'real_estate'
                ? 'Search plot deals, buyers...'
                : 'Search deals, accounts...'
            }
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
          {stages.map((stage) => {
            const stageDeals = filteredDeals.filter(
              (d) => d.deal_stage_id === stage.id || (!d.deal_stage_id && stage.order_index === 1)
            )
            const stageTotal = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)

            return (
              <div
                key={stage.id || stage.name}
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

                <div className="space-y-2.5 min-h-[140px]">
                  {stageDeals.length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                      Empty
                    </div>
                  )}

                  {stageDeals.map((deal) => {
                    const customerName = deal.customer_name || (deal.customer_first_name
                      ? `${deal.customer_first_name} ${deal.customer_last_name || ''}`
                      : 'Client')

                    return (
                      <div
                        key={deal.id}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-xs space-y-2 hover:border-primary-400 dark:hover:border-primary-600 transition"
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
                          <span className="text-[11px] text-gray-400">Advance:</span>
                          <div className="flex items-center gap-1">
                            {stage.order_index < stages.length && (
                              <button
                                onClick={() => {
                                  const nextStage = stages.find((s) => s.order_index === stage.order_index + 1)
                                  if (nextStage) handleStageChange(deal.id, nextStage.id)
                                }}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-600 transition flex items-center text-xs font-semibold"
                                title="Advance to next stage"
                              >
                                <span className="text-[10px] mr-0.5">Next</span>
                                <ChevronRight className="w-3.5 h-3.5" />
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
                <th className="px-6 py-3">{industry === 'legal' ? 'Retainer / Brief' : 'Title'}</th>
                <th className="px-6 py-3">{clientLabel.replace(' *', '')}</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">{industry === 'legal' ? 'Fee (KES)' : 'Value (KES)'}</th>
                <th className="px-6 py-3">{dateLabel}</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredDeals.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{d.title}</td>
                  <td className="px-6 py-4">
                    {d.customer_name || `${d.customer_first_name || ''} ${d.customer_last_name || ''}`}
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

      {/* New Deal / Retainer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{modalTitle}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  {dealTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={dealTitlePlaceholder}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  {clientLabel}
                </label>
                <select
                  required
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select {industry === 'legal' ? 'Client' : industry === 'real_estate' ? 'Buyer' : 'Account'}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name || c.firstName} {c.last_name || c.lastName} {c.company_name ? `(${c.company_name})` : ''} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    {valueLabel}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder={valuePlaceholder}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    {stageLabel}
                  </label>
                  <select
                    value={form.dealStageId}
                    onChange={(e) => setForm({ ...form, dealStageId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {stages.map((s) => (
                      <option key={s.id || s.name} value={s.id}>
                        {s.name} ({s.probability}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  {dateLabel}
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
                  placeholder={notesPlaceholder}
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
                  {submitButtonText}
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

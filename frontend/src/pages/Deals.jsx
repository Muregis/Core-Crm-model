// Deals.jsx
// Visual sales pipeline / Kanban board, stage probability tracking, revenue forecasting, and deal creation tailored by profession.
// Plus ArdhiSasa & Land Conveyancing Pipeline for Real Estate (Search -> Beacon -> LCB -> Stamp Duty -> Title Deed).
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
  FileText,
  ShieldCheck,
  Compass,
  MapPin,
  ExternalLink,
  AlertCircle,
  CheckSquare,
  Landmark,
  FileCheck
} from 'lucide-react'
import { dealService } from '../services/dealService'
import { customerService } from '../services/customerService'
import { conveyancingService } from '../services/conveyancingService'
import { parcelService } from '../services/parcelService'
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

// 5 ArdhiSasa Conveyancing Regulatory Milestones
const CONVEYANCING_STAGES_CONFIG = [
  {
    key: 'search_due_diligence',
    name: '1. ArdhiSasa Search & Registry',
    shortName: 'Search & Due Diligence',
    badge: 'ArdhiSasa NLIMS',
    color: 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
    desc: 'National Land Information Management System (NLIMS) digital search & green card encumbrance verification.'
  },
  {
    key: 'beacon_mutation',
    name: '2. Beacon Verification & Mutation',
    shortName: 'Beacon & Mutation',
    badge: 'Surveyor Certified',
    color: 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
    desc: 'Licensed surveyor site inspection, beacon re-pegging, mutation form filing with Director of Surveys.'
  },
  {
    key: 'lcb_consent',
    name: '3. Land Control Board (LCB)',
    shortName: 'LCB Consent',
    badge: 'Cap 302 Statutory',
    color: 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20',
    desc: 'Sub-County Land Control Board application, board sitting hearing, and statutory consent certificate.'
  },
  {
    key: 'stamp_duty_valuation',
    name: '4. Valuation & Stamp Duty (KRA)',
    shortName: 'Valuation & Stamp Duty',
    badge: 'KRA eTIMS / MoL',
    color: 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20',
    desc: 'Govt valuer inspection, payment of 2% / 4% Stamp Duty via KRA eTIMS, and CGT clearance.'
  },
  {
    key: 'title_issuance_handover',
    name: '5. Title Deed & Handover',
    shortName: 'Title Issuance',
    badge: 'Clean Title Registered',
    color: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
    desc: 'Lands Registry transfer endorsement, new Title Deed issuance, and buyer deed handover ceremony.'
  }
]

const Deals = () => {
  const { user } = useAuthStore()
  const industry = user?.tenant_industry || 'general'

  const defaultStagesForIndustry = STAGES_BY_INDUSTRY[industry] || STAGES_BY_INDUSTRY.general

  const [activeSubTab, setActiveSubTab] = useState('deals') // 'deals' | 'conveyancing'
  const [deals, setDeals] = useState([])
  const [stages, setStages] = useState(defaultStagesForIndustry)
  const [customers, setCustomers] = useState([])
  const [parcels, setParcels] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'table'
  const [showAddModal, setShowAddModal] = useState(false)

  // ArdhiSasa Conveyancing Pipeline State
  const [conveyancingMatters, setConveyancingMatters] = useState([])
  const [conveyancingCounts, setConveyancingCounts] = useState({})
  const [showConveyancingModal, setShowConveyancingModal] = useState(false)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [selectedMatter, setSelectedMatter] = useState(null)

  const [form, setForm] = useState({
    title: '',
    customerId: '',
    dealStageId: 1,
    value: '',
    expectedCloseDate: '',
    notes: ''
  })

  const [conveyancingForm, setConveyancingForm] = useState({
    parcelId: '',
    customerId: '',
    dealId: '',
    stage: 'search_due_diligence',
    searchRef: '',
    beaconCertNumber: '',
    lcbBoardName: 'Isinya Sub-County Land Control Board',
    notes: ''
  })

  const [advanceForm, setAdvanceForm] = useState({
    stage: '',
    searchRef: '',
    searchStatus: 'verified_clean',
    beaconCertNumber: '',
    mutationFormRef: '',
    lcbBoardName: '',
    lcbHearingDate: '',
    lcbConsentRef: '',
    valuationAmountKes: '',
    stampDutyAmountKes: '',
    cgtClearanceRef: '',
    titleDeedNumber: '',
    titleCollectionDate: '',
    notes: ''
  })

  // Synchronize stages if industry changes
  useEffect(() => {
    setStages(STAGES_BY_INDUSTRY[industry] || STAGES_BY_INDUSTRY.general)
  }, [industry])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [dealsRes, stagesRes, custRes, convRes, parcelRes] = await Promise.all([
        dealService.getDeals({ limit: 100 }),
        dealService.getDealStages().catch(() => ({ data: { success: false } })),
        customerService.getCustomers({ limit: 100 }).catch(() => ({ data: { success: false } })),
        conveyancingService.getMatters().catch(() => ({ data: { success: false } })),
        parcelService.getParcels({ limit: 100 }).catch(() => ({ data: { success: false } }))
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
      if (convRes.data?.success) {
        setConveyancingMatters(convRes.data.data.cases || [])
        setConveyancingCounts(convRes.data.data.stageCounts || {})
      }
      if (parcelRes.data?.success) {
        setParcels(parcelRes.data.data.parcels || [])
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

  const loadConveyancingOnly = async () => {
    try {
      const res = await conveyancingService.getMatters()
      if (res.data?.success) {
        setConveyancingMatters(res.data.data.cases || [])
        setConveyancingCounts(res.data.data.stageCounts || {})
      }
    } catch (err) {
      console.error(err)
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

  const filteredConveyancing = useMemo(() => {
    return conveyancingMatters.filter((c) => {
      const text = `${c.plot_number || ''} ${c.title_ref || ''} ${c.parcel_name || ''} ${c.client_first_name || ''} ${c.client_last_name || ''} ${c.search_ref || ''} ${c.lcb_board_name || ''} ${c.title_deed_number || ''}`.toLowerCase()
      return text.includes(searchTerm.toLowerCase())
    })
  }, [conveyancingMatters, searchTerm])

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

  // Handle Conveyancing Matter Creation
  const handleCreateConveyancing = async (e) => {
    e.preventDefault()
    if (!conveyancingForm.parcelId || !conveyancingForm.customerId) {
      toast.error('Please select both a plot/parcel and a buyer')
      return
    }

    try {
      await conveyancingService.createMatter({
        parcelId: parseInt(conveyancingForm.parcelId, 10),
        customerId: parseInt(conveyancingForm.customerId, 10),
        dealId: conveyancingForm.dealId ? parseInt(conveyancingForm.dealId, 10) : null,
        stage: conveyancingForm.stage || 'search_due_diligence',
        searchRef: conveyancingForm.searchRef || `ARDHI-SRCH-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        beaconCertNumber: conveyancingForm.beaconCertNumber,
        lcbBoardName: conveyancingForm.lcbBoardName,
        notes: conveyancingForm.notes
      })
      toast.success('ArdhiSasa Conveyancing file initiated!')
      setShowConveyancingModal(false)
      setConveyancingForm({
        parcelId: '',
        customerId: '',
        dealId: '',
        stage: 'search_due_diligence',
        searchRef: '',
        beaconCertNumber: '',
        lcbBoardName: 'Isinya Sub-County Land Control Board',
        notes: ''
      })
      loadConveyancingOnly()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register conveyancing matter')
    }
  }

  // Open modal to advance milestone or edit evidence
  const openAdvanceModal = (matter, targetStage = null) => {
    setSelectedMatter(matter)
    setAdvanceForm({
      stage: targetStage || matter.stage,
      searchRef: matter.search_ref || '',
      searchStatus: matter.search_status || 'verified_clean',
      beaconCertNumber: matter.beacon_cert_number || '',
      mutationFormRef: matter.mutation_form_ref || '',
      lcbBoardName: matter.lcb_board_name || 'Isinya Sub-County Land Control Board',
      lcbHearingDate: matter.lcb_hearing_date ? matter.lcb_hearing_date.split('T')[0] : '',
      lcbConsentRef: matter.lcb_consent_ref || '',
      valuationAmountKes: matter.valuation_amount_kes || '',
      stampDutyAmountKes: matter.stamp_duty_amount_kes || '',
      cgtClearanceRef: matter.cgt_clearance_ref || '',
      titleDeedNumber: matter.title_deed_number || '',
      titleCollectionDate: matter.title_collection_date ? matter.title_collection_date.split('T')[0] : '',
      notes: matter.notes || ''
    })
    setShowAdvanceModal(true)
  }

  // Submit Milestone Advance
  const handleAdvanceSubmit = async (e) => {
    e.preventDefault()
    if (!selectedMatter) return

    try {
      await conveyancingService.updateStage(selectedMatter.id, advanceForm)
      toast.success('Regulatory milestone & conveyancing documentation updated!')
      setShowAdvanceModal(false)
      loadConveyancingOnly()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update milestone')
    }
  }

  // Adaptive profession copy
  const headerTitle =
    industry === 'legal'
      ? 'Legal Retainers & Instructions'
      : industry === 'real_estate'
      ? (activeSubTab === 'conveyancing' ? 'ArdhiSasa & Land Conveyancing Pipeline' : 'Land Sales & Plot Deals')
      : 'Commercial Sales Pipeline & Opportunities'

  const headerSubtitle =
    industry === 'legal'
      ? 'Track client intake, fee agreements, court filing milestones, and retainer valuations in KES.'
      : industry === 'real_estate'
      ? (activeSubTab === 'conveyancing'
          ? 'Live regulatory Kanban tracking: ArdhiSasa NLIMS Search -> Surveyor Beacons -> Sub-County LCB Consent -> KRA Stamp Duty -> Title Deed Issuance.'
          : 'Visual plot sales tracking, site visit conversions, letters of offer, and completion forecasting in KES.')
      : 'Visual pipeline tracking, B2B deal stages, quotation conversion, and revenue forecasting in KES.'

  const newDealButtonText =
    industry === 'legal'
      ? 'New Retainer Brief'
      : industry === 'real_estate'
      ? (activeSubTab === 'conveyancing' ? 'New Conveyancing File' : 'New Land Deal')
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
          {activeSubTab === 'deals' && (
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
          )}

          <button
            onClick={() => {
              if (activeSubTab === 'conveyancing') {
                setShowConveyancingModal(true)
              } else {
                setForm((prev) => ({
                  ...prev,
                  dealStageId: stages[0]?.id || 1
                }))
                setShowAddModal(true)
              }
            }}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            {newDealButtonText}
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation for Real Estate Industry */}
      {industry === 'real_estate' && (
        <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6">
          <button
            onClick={() => setActiveSubTab('deals')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'deals'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Land Sales Pipeline
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
              {deals.length} deals
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('conveyancing')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'conveyancing'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Building className="w-4 h-4" />
            🏛️ ArdhiSasa Conveyancing Pipeline
            {conveyancingMatters.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                {conveyancingMatters.length} regulatory files
              </span>
            )}
          </button>
        </div>
      )}

      {/* SUB-TAB 1: TRADITIONAL DEALS PIPELINE */}
      {activeSubTab === 'deals' && (
        <>
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
        </>
      )}

      {/* SUB-TAB 2: ARDHISASA & LAND CONVEYANCING PIPELINE */}
      {activeSubTab === 'conveyancing' && (
        <div className="space-y-6">
          {/* Regulatory Context Banner */}
          <div className="bg-gradient-to-r from-emerald-900/10 via-teal-900/10 to-blue-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                  Kenyan Land Conveyancing & ArdhiSasa Regulatory Pipeline
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-3xl leading-relaxed">
                  Eliminate black-box conveyancing delays. Track official NLIMS digital searches, licensed surveyor beacon certifications, Sub-County Land Control Board (Cap 302) statutory sittings, Ministry of Lands valuation & KRA stamp duty payments, through to final registered Title Deed handover.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowConveyancingModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition whitespace-nowrap flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Conveyancing File
            </button>
          </div>

          {/* 5 Milestone Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {CONVEYANCING_STAGES_CONFIG.map((stg) => {
              const count = conveyancingCounts[stg.key] || conveyancingMatters.filter(c => c.stage === stg.key).length
              return (
                <div
                  key={stg.key}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-xs"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block truncate">
                    {stg.shortName}
                  </span>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-2xl font-black text-gray-900 dark:text-gray-100">
                      {count}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stg.badgeColor}`}>
                      {stg.badge}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Search Bar for Conveyancing */}
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search plot number, title ref, buyer, LCB board, or title deed..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-gray-100"
              />
            </div>

            <button
              onClick={loadConveyancingOnly}
              className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
              title="Refresh conveyancing cases"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* ArdhiSasa 5-Column Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-6 items-start">
            {CONVEYANCING_STAGES_CONFIG.map((col, idx) => {
              const colMatters = filteredConveyancing.filter((c) => c.stage === col.key)

              return (
                <div
                  key={col.key}
                  className="w-80 flex-shrink-0 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 flex flex-col space-y-3"
                >
                  {/* Column Header */}
                  <div className="pb-2 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        {col.name}
                      </h4>
                      <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center justify-center">
                        {colMatters.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{col.desc}</p>
                  </div>

                  {/* Cards List */}
                  <div className="space-y-3 min-h-[160px]">
                    {colMatters.length === 0 && (
                      <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                        No matters in this milestone
                      </div>
                    )}

                    {colMatters.map((matter) => {
                      const buyerName = matter.client_first_name
                        ? `${matter.client_first_name} ${matter.client_last_name || ''}`
                        : 'Registered Buyer'

                      return (
                        <div
                          key={matter.id}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-xs space-y-2.5 hover:border-emerald-500 dark:hover:border-emerald-500 transition group"
                        >
                          {/* Card Title & Plot */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                {matter.plot_number || 'Plot Unit'}
                              </span>
                              <h5 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                {matter.title_ref || matter.parcel_name || 'Land Title Record'}
                              </h5>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {matter.county || 'Kenya'}
                            </span>
                          </div>

                          {/* Buyer info */}
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-semibold truncate">{buyerName}</span>
                            {matter.client_phone && (
                              <span className="text-[10px] text-gray-400">({matter.client_phone})</span>
                            )}
                          </div>

                          {/* Stage-Specific Evidence Details */}
                          <div className="bg-gray-50 dark:bg-gray-900/70 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[11px] space-y-1.5">
                            {col.key === 'search_due_diligence' && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">ArdhiSasa Search:</span>
                                  <span className="font-mono font-bold text-primary-600">{matter.search_ref || 'Pending Lodgment'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Encumbrance Status:</span>
                                  <span className="font-bold text-emerald-600 capitalize">{matter.search_status?.replace('_', ' ') || 'Verified Clean'}</span>
                                </div>
                              </>
                            )}

                            {col.key === 'beacon_mutation' && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Beacon Cert #:</span>
                                  <span className="font-mono font-bold text-amber-600">{matter.beacon_cert_number || 'Awaiting Surveyor'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Mutation Form:</span>
                                  <span className="font-mono text-gray-700 dark:text-gray-300">{matter.mutation_form_ref || 'Lodged with Surveys'}</span>
                                </div>
                              </>
                            )}

                            {col.key === 'lcb_consent' && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Board:</span>
                                  <span className="font-bold text-purple-600 truncate max-w-[140px]">{matter.lcb_board_name || 'Sub-County LCB'}</span>
                                </div>
                                {matter.lcb_consent_ref ? (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Consent Cert:</span>
                                    <span className="font-mono font-bold text-emerald-600">{matter.lcb_consent_ref}</span>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Hearing Date:</span>
                                    <span className="text-amber-600 font-medium">{matter.lcb_hearing_date ? new Date(matter.lcb_hearing_date).toLocaleDateString('en-KE') : 'Scheduled'}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {col.key === 'stamp_duty_valuation' && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Govt Valuation:</span>
                                  <span className="font-bold">{matter.valuation_amount_kes ? formatCurrencyKES(matter.valuation_amount_kes) : 'Pending Assessment'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Stamp Duty (4%):</span>
                                  <span className="font-bold text-orange-600">{matter.stamp_duty_amount_kes ? formatCurrencyKES(matter.stamp_duty_amount_kes) : 'Pending Assessment'}</span>
                                </div>
                                {matter.cgt_clearance_ref && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">CGT Ref:</span>
                                    <span className="font-mono text-gray-700 dark:text-gray-300">{matter.cgt_clearance_ref}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {col.key === 'title_issuance_handover' && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Registered Title #:</span>
                                  <span className="font-mono font-bold text-emerald-600">{matter.title_deed_number || 'Issued'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Deed Handover:</span>
                                  <span className="font-bold text-gray-700 dark:text-gray-300">
                                    {matter.title_collection_date ? new Date(matter.title_collection_date).toLocaleDateString('en-KE') : 'Collected'}
                                  </span>
                                </div>
                              </>
                            )}

                            {matter.notes && (
                              <p className="text-[10px] text-gray-400 italic pt-1 border-t border-gray-200/50 dark:border-gray-800 line-clamp-2">
                                "{matter.notes}"
                              </p>
                            )}
                          </div>

                          {/* Action Bar */}
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <button
                              onClick={() => openAdvanceModal(matter, col.key)}
                              className="text-[11px] font-semibold text-gray-500 hover:text-primary-600 transition"
                            >
                              Edit Docs
                            </button>

                            {idx < CONVEYANCING_STAGES_CONFIG.length - 1 ? (
                              <button
                                onClick={() => {
                                  const nextCol = CONVEYANCING_STAGES_CONFIG[idx + 1]
                                  openAdvanceModal(matter, nextCol.key)
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition text-xs font-bold flex items-center gap-1"
                              >
                                <span>Advance Milestone</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Completed
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: Standard Deal Creation Modal */}
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

      {/* MODAL 2: New ArdhiSasa Conveyancing File Modal */}
      {showConveyancingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-600" />
                  Initiate ArdhiSasa Conveyancing File
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Register property into the 5-stage Kenyan statutory conveyancing pathway.</p>
              </div>
              <button
                onClick={() => setShowConveyancingModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateConveyancing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Select Land Parcel / Estate Plot *
                </label>
                <select
                  required
                  value={conveyancingForm.parcelId}
                  onChange={(e) => setConveyancingForm({ ...conveyancingForm, parcelId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Plot / Lot</option>
                  {parcels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plot_number} - {p.title_ref || p.name} ({p.county || 'Kenya'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Purchaser / Buyer *
                </label>
                <select
                  required
                  value={conveyancingForm.customerId}
                  onChange={(e) => setConveyancingForm({ ...conveyancingForm, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Buyer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Initial Milestone
                  </label>
                  <select
                    value={conveyancingForm.stage}
                    onChange={(e) => setConveyancingForm({ ...conveyancingForm, stage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {CONVEYANCING_STAGES_CONFIG.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    ArdhiSasa Search Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ARDHI-SRCH-2026-9041"
                    value={conveyancingForm.searchRef}
                    onChange={(e) => setConveyancingForm({ ...conveyancingForm, searchRef: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Sub-County Land Control Board (LCB)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Isinya Sub-County Land Control Board"
                  value={conveyancingForm.lcbBoardName}
                  onChange={(e) => setConveyancingForm({ ...conveyancingForm, lcbBoardName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Advocate / Conveyancing Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Title verification status, vendor advocate details, Land Registry file notes..."
                  value={conveyancingForm.notes}
                  onChange={(e) => setConveyancingForm({ ...conveyancingForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowConveyancingModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Open Conveyancing File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Advance Milestone & Update Regulatory Evidence Modal */}
      {showAdvanceModal && selectedMatter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Conveyancing Milestone & Evidence
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedMatter.plot_number} - {selectedMatter.title_ref || selectedMatter.parcel_name}
                </p>
              </div>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAdvanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Regulatory Milestone Stage *
                </label>
                <select
                  value={advanceForm.stage}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-bold"
                >
                  {CONVEYANCING_STAGES_CONFIG.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Inputs based on Target Stage */}
              <div className="space-y-3 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold text-primary-600 uppercase tracking-wider block">
                  Milestone Documentation & Certifications
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      ArdhiSasa Search Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ARDHI-SRCH-2026-9041"
                      value={advanceForm.searchRef}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, searchRef: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Search Status
                    </label>
                    <select
                      value={advanceForm.searchStatus}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, searchStatus: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="verified_clean">Verified Clean (Nil Encumbrance)</option>
                      <option value="encumbered">Encumbered / Caution Found</option>
                      <option value="pending_registry">Pending Registry Verification</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Surveyor Beacon Cert #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SURV-BCN-KAJ-2026-104"
                      value={advanceForm.beaconCertNumber}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, beaconCertNumber: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Mutation Form Ref #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MUT-2026-KAJ-098"
                      value={advanceForm.mutationFormRef}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, mutationFormRef: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Sub-County LCB Board Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Isinya Sub-County LCB"
                      value={advanceForm.lcbBoardName}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, lcbBoardName: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      LCB Consent Cert #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LCB-CONSENT-2026-081"
                      value={advanceForm.lcbConsentRef}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, lcbConsentRef: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Valuation Amount (KES)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1800000"
                      value={advanceForm.valuationAmountKes}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, valuationAmountKes: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Stamp Duty Amount Paid (KES)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 72000"
                      value={advanceForm.stampDutyAmountKes}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, stampDutyAmountKes: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Registered Title Deed #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KAJIADO/KITENGELA/8915-DEED"
                      value={advanceForm.titleDeedNumber}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, titleDeedNumber: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono font-bold text-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Deed Collection / Handover Date
                    </label>
                    <input
                      type="date"
                      value={advanceForm.titleCollectionDate}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, titleCollectionDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Advocate / Milestone Progress Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Record registry receipt numbers, advocate correspondence, date stampings..."
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Save Milestone & Update Stage
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

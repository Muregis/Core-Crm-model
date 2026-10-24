// Parcels.jsx
// Land & Real Estate Master Suite:
// 1. Interactive Plot Matrix (Green/Yellow/Red, 48h Timed Holds & Letters of Offer)
// 2. Lipa Mdogo Mdogo Installment Tracker (4-Stage Land Milestones & Daraja M-Pesa Matching)
// 3. Saturday Site Visit Convoy Booking (Kencom Nairobi departures, seat quotas & manifests)
// 4. ArdhiSasa Statutory Conveyancing Gateway
import React, { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MapPin,
  Layers,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  Clock,
  Shield,
  Tag,
  DollarSign,
  Building,
  Edit2,
  RefreshCw,
  ExternalLink,
  Grid,
  List,
  AlertTriangle,
  X,
  FileCheck,
  UserCheck,
  Bus,
  Users,
  Calendar,
  Phone,
  Compass,
  FileText,
  Sparkles,
  TrendingUp,
  Check,
  ArrowRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react'
import { parcelService } from '../services/parcelService'
import { dealService } from '../services/dealService'
import { customerService } from '../services/customerService'
import { conveyancingService } from '../services/conveyancingService'
import { formatCurrencyKES, formatDateKE } from '../utils/formatters'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    borderColor: 'border-emerald-500',
    dot: 'bg-emerald-500'
  },
  reserved: {
    label: 'Reserved (Timed Hold)',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    borderColor: 'border-amber-500',
    dot: 'bg-amber-500'
  },
  sold: {
    label: 'Sold & Titled',
    color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    borderColor: 'border-rose-500',
    dot: 'bg-rose-500'
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    borderColor: 'border-gray-400',
    dot: 'bg-gray-400'
  }
}

const KENYAN_COUNTIES = [
  'Nairobi',
  'Kiambu',
  'Machakos',
  'Kajiado',
  'Nakuru',
  'Murang\'a',
  'Kilifi',
  'Mombasa',
  'Uasin Gishu',
  'Laikipia'
]

const Parcels = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTabParam = searchParams.get('tab') || 'matrix'
  const [activeTab, setActiveTab] = useState(activeTabParam) // 'matrix' | 'list' | 'installments' | 'convoys'

  // Master Data State
  const [parcels, setParcels] = useState([])
  const [matrixData, setMatrixData] = useState(null)
  const [customers, setCustomers] = useState([])
  const [deals, setDeals] = useState([])
  const [installmentsData, setInstallmentsData] = useState({ summary: {}, installments: [] })
  const [siteVisits, setSiteVisits] = useState([])
  const [conveyancingSummary, setConveyancingSummary] = useState({ totalMatters: 0, stageCounts: {} })
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [countyFilter, setCountyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedProject, setSelectedProject] = useState('all')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [selectedPlotForHold, setSelectedPlotForHold] = useState(null)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [selectedMilestoneForMatch, setSelectedMilestoneForMatch] = useState(null)
  const [showConvoyModal, setShowConvoyModal] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedConvoyForBooking, setSelectedConvoyForBooking] = useState(null)

  // Hold Form
  const [holdForm, setHoldForm] = useState({
    customerId: '',
    holdHours: 48,
    letterOfOfferRef: '',
    depositRequiredKes: '',
    notes: ''
  })

  // Add Plot Form
  const [form, setForm] = useState({
    titleRef: '',
    plotNumber: '',
    name: '',
    projectName: 'Acacia Heights Estate Phase 2',
    sizeAcres: '0.125',
    county: 'Kajiado',
    ward: '',
    locationNotes: '',
    zoning: 'Residential',
    listPriceKes: '',
    dealId: ''
  })

  // New Installment Plan Form
  const [planForm, setPlanForm] = useState({
    dealId: '',
    parcelId: '',
    customerId: '',
    totalAmountKes: '',
    startDate: new Date().toISOString().split('T')[0]
  })

  // Match M-Pesa Form
  const [matchForm, setMatchForm] = useState({
    mpesaReceiptNumber: '',
    amountPaidKes: ''
  })

  // Schedule Convoy Form
  const [convoyForm, setConvoyForm] = useState({
    projectName: 'Juja Ridge Phase 2',
    destinationCounty: 'Kiambu',
    visitDate: '',
    departureTime: '08:30 AM',
    departureLocation: 'Kencom House, Nairobi CBD',
    vehicleType: '33-Seater Executive Shuttle',
    totalSeats: 33,
    driverPhone: '+254711000111',
    notes: 'Saturday VIP Investor convoy with site marshalling'
  })

  // Book Convoy Seat Form
  const [bookingForm, setBookingForm] = useState({
    customerId: '',
    visitorName: '',
    visitorPhone: '',
    seatsBooked: 1,
    pickupPoint: 'Kencom House, Nairobi CBD',
    notes: ''
  })

  // Update tab in URL query param
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Load All Real Estate Subsystems
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [matrixRes, parcelsRes, dealsRes, custRes, instRes, visitsRes, convRes] = await Promise.all([
        parcelService.getPlotMatrix().catch(() => ({ data: { success: false } })),
        parcelService.getParcels({ limit: 150 }).catch(() => ({ data: { success: false } })),
        dealService.getDeals().catch(() => ({ data: { success: false } })),
        customerService.getCustomers({ limit: 150 }).catch(() => ({ data: { success: false } })),
        parcelService.getInstallments().catch(() => ({ data: { success: false } })),
        parcelService.getSiteVisits().catch(() => ({ data: { success: false } })),
        conveyancingService.getMatters().catch(() => ({ data: { success: false } }))
      ])

      if (matrixRes.data?.success) {
        setMatrixData(matrixRes.data.data)
      }
      if (parcelsRes.data?.success) {
        setParcels(parcelsRes.data.data.parcels || [])
      }
      if (dealsRes.data?.success) {
        setDeals(dealsRes.data.data.deals || [])
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
      if (instRes.data?.success) {
        setInstallmentsData(instRes.data.data || { summary: {}, installments: [] })
      }
      if (visitsRes.data?.success) {
        setSiteVisits(visitsRes.data.data.siteVisits || [])
      }
      if (convRes.data?.success) {
        const matters = convRes.data.data.cases || []
        const stageCounts = convRes.data.data.stageCounts || {}
        setConveyancingSummary({ totalMatters: matters.length, stageCounts })
      }
    } catch (err) {
      toast.error('Failed to load estate data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered parcels for list & matrix view
  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      const matchSearch =
        (p.title_ref || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.plot_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.project_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchCounty = countyFilter === 'all' || p.county === countyFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchCounty && matchStatus
    })
  }, [parcels, searchTerm, countyFilter, statusFilter])

  // Filtered projects for matrix view
  const displayedProjects = useMemo(() => {
    if (!matrixData?.projects) return []
    if (selectedProject === 'all') return matrixData.projects
    return matrixData.projects.filter((p) => p.name === selectedProject)
  }, [matrixData, selectedProject])

  // Matrix Summary Calculations
  const summary = matrixData?.summary || {
    totalPlots: parcels.length,
    availablePlots: parcels.filter((p) => p.status === 'available').length,
    reservedPlots: parcels.filter((p) => p.status === 'reserved').length,
    soldPlots: parcels.filter((p) => p.status === 'sold').length,
    availableRate: parcels.length > 0 ? Math.round((parcels.filter((p) => p.status === 'available').length / parcels.length) * 100) : 0,
    totalValuationKes: parcels.reduce((acc, p) => acc + (parseFloat(p.list_price_kes) || 0), 0)
  }

  // Group installments by deal
  const groupedInstallments = useMemo(() => {
    const list = installmentsData.installments || []
    const groups = {}
    list.forEach((item) => {
      const key = item.deal_id || ('direct_' + (item.parcel_id || item.id))
      if (!groups[key]) {
        groups[key] = {
          dealId: item.deal_id,
          dealTitle: item.deal_title || 'Direct Land Acquisition',
          customerName: `${item.customer_first_name || ''} ${item.customer_last_name || ''}`.trim() || 'Valued Land Client',
          customerPhone: item.customer_phone,
          plotNumber: item.plot_number || 'Plot',
          projectName: item.project_name || 'Acacia Estate',
          titleRef: item.title_ref,
          milestones: [],
          totalAmount: 0,
          paidAmount: 0
        }
      }
      groups[key].milestones.push(item)
      groups[key].totalAmount += parseFloat(item.amount_kes) || 0
      groups[key].paidAmount += parseFloat(item.paid_amount_kes) || 0
    })
    return Object.values(groups)
  }, [installmentsData.installments])

  // Site visits capacity stats
  const convoyMetrics = useMemo(() => {
    const totalConvoys = siteVisits.length
    const totalCapacity = siteVisits.reduce((acc, v) => acc + (v.total_seats || 33), 0)
    const totalBooked = siteVisits.reduce((acc, v) => acc + (v.total_booked_passengers || 0), 0)
    const occupancyRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0
    return { totalConvoys, totalCapacity, totalBooked, occupancyRate }
  }, [siteVisits])

  // ==========================================
  // HANDLERS: PLOT MATRIX & TIMED HOLDS
  // ==========================================
  const openHoldModal = (plot) => {
    setSelectedPlotForHold(plot)
    setHoldForm({
      customerId: customers[0]?.id || '',
      holdHours: 48,
      letterOfOfferRef: `LOO-${plot.plotNumber ? plot.plotNumber.replace(/\s+/g, '-') : 'PLOT'}-2026`,
      depositRequiredKes: Math.round((parseFloat(plot.listPriceKes) || 1500000) * 0.10).toString(),
      notes: 'Initial 48-hour reservation pending 10% commitment deposit.'
    })
    setShowHoldModal(true)
  }

  const handleApplyHold = async (e) => {
    e.preventDefault()
    if (!selectedPlotForHold) return
    try {
      await parcelService.reserveHold(selectedPlotForHold.id, {
        customerId: holdForm.customerId,
        holdHours: parseInt(holdForm.holdHours, 10),
        letterOfOfferRef: holdForm.letterOfOfferRef,
        depositRequiredKes: parseFloat(holdForm.depositRequiredKes),
        notes: holdForm.notes
      })
      toast.success(`Timed hold activated on ${selectedPlotForHold.plotNumber} (${holdForm.holdHours}h window)!`)
      setShowHoldModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply hold')
    }
  }

  const handleReleaseHold = async (plotId) => {
    if (!window.confirm('Release this plot back to Available (Green)? The LOO timer will be cancelled.')) return
    try {
      await parcelService.releaseHold(plotId)
      toast.success('Plot released back to Available!')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to release hold')
    }
  }

  const handleConvertSale = async (plotId) => {
    if (!window.confirm('Confirm sale of this plot? This will mark it as Sold (Red) and finalize title conveyance.')) return
    try {
      await parcelService.convertSale(plotId, {})
      toast.success('Plot converted to Sold! Title transfer initiated.')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to convert plot sale')
    }
  }

  const handleAddPlot = async (e) => {
    e.preventDefault()
    try {
      await parcelService.createParcel({
        title_ref: form.titleRef,
        plot_number: form.plotNumber,
        name: form.plotNumber,
        project_name: form.projectName,
        size_acres: parseFloat(form.sizeAcres) || 0.125,
        county: form.county,
        zoning: form.zoning,
        list_price_kes: parseFloat(form.listPriceKes) || 0
      })
      toast.success('New plot registered successfully!')
      setShowAddModal(false)
      setForm({
        titleRef: '',
        plotNumber: '',
        name: '',
        projectName: 'Acacia Heights Estate Phase 2',
        sizeAcres: '0.125',
        county: 'Kajiado',
        ward: '',
        locationNotes: '',
        zoning: 'Residential',
        listPriceKes: '',
        dealId: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create parcel')
    }
  }

  // ==========================================
  // HANDLERS: LIPA MDOGO MDOGO INSTALLMENTS
  // ==========================================
  const handleCreatePlan = async (e) => {
    e.preventDefault()
    if (!planForm.dealId || !planForm.customerId || !planForm.totalAmountKes) {
      toast.error('Please select deal, client, and total purchase price')
      return
    }
    try {
      await parcelService.createInstallmentPlan({
        dealId: parseInt(planForm.dealId, 10),
        parcelId: planForm.parcelId ? parseInt(planForm.parcelId, 10) : null,
        customerId: parseInt(planForm.customerId, 10),
        totalAmountKes: parseFloat(planForm.totalAmountKes),
        startDate: planForm.startDate
      })
      toast.success('4-Stage Lipa Mdogo Mdogo installment schedule generated!')
      setShowPlanModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate installment plan')
    }
  }

  const openMatchModal = (milestone) => {
    setSelectedMilestoneForMatch(milestone)
    const unpaid = Math.max(0, (parseFloat(milestone.amount_kes) || 0) - (parseFloat(milestone.paid_amount_kes) || 0))
    setMatchForm({
      mpesaReceiptNumber: '',
      amountPaidKes: unpaid.toString()
    })
    setShowMatchModal(true)
  }

  const handleMatchMpesa = async (e) => {
    e.preventDefault()
    if (!selectedMilestoneForMatch || !matchForm.mpesaReceiptNumber) {
      toast.error('M-Pesa transaction code is required')
      return
    }
    try {
      await parcelService.matchInstallmentMpesa(selectedMilestoneForMatch.id, {
        mpesaReceiptNumber: matchForm.mpesaReceiptNumber,
        amountPaidKes: parseFloat(matchForm.amountPaidKes)
      })
      toast.success(`M-Pesa receipt ${matchForm.mpesaReceiptNumber.toUpperCase()} matched to milestone successfully!`)
      setShowMatchModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to match M-Pesa receipt')
    }
  }

  // ==========================================
  // HANDLERS: SATURDAY SITE CONVOYS
  // ==========================================
  const handleScheduleConvoy = async (e) => {
    e.preventDefault()
    if (!convoyForm.visitDate) {
      toast.error('Please select a visit date (e.g. next Saturday)')
      return
    }
    try {
      await parcelService.createSiteVisit({
        projectName: convoyForm.projectName,
        destinationCounty: convoyForm.destinationCounty,
        visitDate: convoyForm.visitDate,
        departureTime: convoyForm.departureTime,
        departureLocation: convoyForm.departureLocation,
        vehicleType: convoyForm.vehicleType,
        totalSeats: parseInt(convoyForm.totalSeats, 10),
        driverPhone: convoyForm.driverPhone,
        notes: convoyForm.notes
      })
      toast.success('Saturday site visit convoy scheduled successfully!')
      setShowConvoyModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule convoy')
    }
  }

  const openBookingModal = (convoy) => {
    setSelectedConvoyForBooking(convoy)
    setBookingForm({
      customerId: customers[0]?.id || '',
      visitorName: customers[0] ? `${customers[0].first_name} ${customers[0].last_name}` : '',
      visitorPhone: customers[0]?.phone || '',
      seatsBooked: 1,
      pickupPoint: convoy.departure_location || 'Kencom House, Nairobi CBD',
      notes: 'VIP Land Investor booking'
    })
    setShowBookingModal(true)
  }

  const handleBookPassenger = async (e) => {
    e.preventDefault()
    if (!selectedConvoyForBooking || !bookingForm.visitorName || !bookingForm.visitorPhone) {
      toast.error('Passenger name and phone are required')
      return
    }
    try {
      await parcelService.bookSiteVisitPassenger(selectedConvoyForBooking.id, {
        customerId: bookingForm.customerId ? parseInt(bookingForm.customerId, 10) : null,
        visitorName: bookingForm.visitorName,
        visitorPhone: bookingForm.visitorPhone,
        seatsBooked: parseInt(bookingForm.seatsBooked, 10) || 1,
        pickupPoint: bookingForm.pickupPoint,
        notes: bookingForm.notes
      })
      toast.success(`${bookingForm.seatsBooked} seat(s) reserved for ${bookingForm.visitorName}!`)
      setShowBookingModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to book convoy passenger')
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Compass className="w-7 h-7 text-emerald-600" />
            Land & Real Estate Operations
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Master plot grid, Lipa Mdogo Mdogo installment ledger, Saturday Kencom convoys & ArdhiSasa milestones.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            title="Refresh All Real Estate Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {activeTab === 'matrix' || activeTab === 'list' ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              + Add Plot
            </button>
          ) : activeTab === 'installments' ? (
            <button
              onClick={() => {
                setPlanForm({
                  dealId: deals[0]?.id || '',
                  parcelId: parcels[0]?.id || '',
                  customerId: customers[0]?.id || '',
                  totalAmountKes: parcels[0]?.list_price_kes || '1500000',
                  startDate: new Date().toISOString().split('T')[0]
                })
                setShowPlanModal(true)
              }}
              className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              + Generate Installment Plan
            </button>
          ) : activeTab === 'convoys' ? (
            <button
              onClick={() => setShowConvoyModal(true)}
              className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              + Schedule Saturday Convoy
            </button>
          ) : null}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        <button
          onClick={() => handleTabChange('matrix')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Grid className="w-4 h-4" />
          Interactive Plot Matrix
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'matrix' ? 'bg-emerald-700 text-white' : 'bg-gray-200 dark:bg-gray-800'
          }`}>
            {summary.totalPlots}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('list')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'list'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <List className="w-4 h-4" />
          Plot Inventory Directory
        </button>

        <button
          onClick={() => handleTabChange('installments')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'installments'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          "Lipa Mdogo Mdogo" Tracker
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'installments' ? 'bg-emerald-700 text-white' : 'bg-gray-200 dark:bg-gray-800'
          }`}>
            {installmentsData.installments?.length || 0}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('convoys')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'convoys'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Bus className="w-4 h-4" />
          Saturday Site Convoys
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'convoys' ? 'bg-emerald-700 text-white' : 'bg-gray-200 dark:bg-gray-800'
          }`}>
            {siteVisits.length}
          </span>
        </button>

        <Link
          to="/deals?tab=conveyancing"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition whitespace-nowrap border border-dashed border-indigo-300 dark:border-indigo-800"
        >
          <ShieldCheck className="w-4 h-4" />
          ArdhiSasa Conveyancing Pipeline ({conveyancingSummary.totalMatters})
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INTERACTIVE PLOT MATRIX                                            */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Estate Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Estate Plots</span>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{summary.totalPlots} Plots</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 shadow-sm bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Available (Green)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-xl font-bold text-emerald-600 mt-1">
                {summary.availablePlots} <span className="text-xs text-emerald-700 font-medium">({summary.availableRate}%)</span>
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 shadow-sm bg-amber-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Reserved (48h Hold)</span>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-amber-600 mt-1">{summary.reservedPlots} Plots</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-rose-200 dark:border-rose-800/60 rounded-xl p-3.5 shadow-sm bg-rose-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Sold & Titled (Red)</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <p className="text-xl font-bold text-rose-600 mt-1">{summary.soldPlots} Plots</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-sm col-span-2 lg:col-span-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Portfolio Valuation</span>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1 font-mono">
                {formatCurrencyKES(summary.totalValuationKes)}
              </p>
            </div>
          </div>

          {/* Project Selector Pills */}
          {matrixData?.projects?.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedProject('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedProject === 'all'
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                All Projects ({matrixData.projects.length})
              </button>
              {matrixData.projects.map((proj) => (
                <button
                  key={proj.name}
                  onClick={() => setSelectedProject(proj.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedProject === proj.name
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {proj.name} ({proj.plots.length})
                </button>
              ))}
            </div>
          )}

          {/* Master Plan Visual Grids */}
          {displayedProjects.length === 0 ? (
            <EmptyState
              icon={Grid}
              title="No estate plots registered yet"
              description="Register new parcels with title references and prices to populate the master plan matrix."
              actionLabel="+ Add Plot"
              onAction={() => setShowAddModal(true)}
            />
          ) : (
            displayedProjects.map((proj) => (
              <div
                key={proj.name}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {proj.name}
                      </h2>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-500" /> {proj.county} County
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                      {proj.stats?.available || 0} Available
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                      {proj.stats?.reserved || 0} Reserved
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                      {proj.stats?.sold || 0} Sold
                    </span>
                  </div>
                </div>

                {/* The Color-Coded Master Plan Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {proj.plots.map((plot) => {
                    const isAvailable = plot.status === 'available'
                    const isReserved = plot.status === 'reserved'
                    const isSold = plot.status === 'sold'

                    // Safe Countdown Calculation
                    const secs = plot?.holdDetails?.remainingSeconds ?? null
                    let countdownText = null
                    if (isReserved && typeof secs === 'number') {
                      const hrs = Math.max(0, Math.floor(secs / 3600))
                      const mins = Math.max(0, Math.floor((secs % 3600) / 60))
                      countdownText = `${hrs}h ${mins}m left`
                    }

                    return (
                      <div
                        key={plot.id}
                        className={`relative rounded-xl border-2 p-4 transition shadow-xs flex flex-col justify-between space-y-3 ${
                          isAvailable
                            ? 'border-emerald-500/80 bg-emerald-50/10 hover:border-emerald-600'
                            : isReserved
                            ? 'border-amber-500/80 bg-amber-50/10 hover:border-amber-600'
                            : 'border-rose-400/80 bg-rose-50/10'
                        }`}
                      >
                        {/* Plot Header */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm text-gray-900 dark:text-gray-100">
                              {plot.plotNumber}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isAvailable
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : isReserved
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isAvailable ? 'bg-emerald-500' : isReserved ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                              ></span>
                              {plot.status}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 mt-1 font-mono truncate">
                            {plot.titleRef}
                          </div>
                          <div className="text-xs text-gray-400 font-medium">
                            {plot.sizeAcres} {plot.sizeUnit || 'Acres'} • {plot.zoning}
                          </div>
                        </div>

                        {/* Pricing & State Machine Timers */}
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60 space-y-1.5">
                          <div className="text-base font-bold text-gray-900 dark:text-gray-100 font-mono">
                            {formatCurrencyKES(plot.listPriceKes)}
                          </div>

                          {/* Active Timed Hold Box */}
                          {isReserved && (
                            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs space-y-0.5">
                              <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 font-bold">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600" /> Timed Hold:
                                </span>
                                <span>{countdownText || 'Active Hold'}</span>
                              </div>
                              {plot.holdDetails?.clientName && (
                                <div className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
                                  Buyer: <strong>{plot.holdDetails.clientName}</strong>
                                </div>
                              )}
                              <div className="text-[10px] text-gray-400 font-mono">
                                LOO: {plot.holdDetails?.letterOfOfferRef || 'LOO Pending'}
                              </div>
                            </div>
                          )}

                          {isSold && (
                            <div className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Sold & Title Transferred
                            </div>
                          )}
                        </div>

                        {/* State Machine Action Controls */}
                        <div className="pt-2">
                          {isAvailable && (
                            <button
                              onClick={() => openHoldModal(plot)}
                              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs"
                            >
                              <Clock className="w-3.5 h-3.5" /> + Hold with LOO (48h)
                            </button>
                          )}

                          {isReserved && (
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => handleReleaseHold(plot.id)}
                                className="py-1 px-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-semibold transition"
                              >
                                Release Hold
                              </button>
                              <button
                                onClick={() => handleConvertSale(plot.id)}
                                className="py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition"
                              >
                                Confirm Sale
                              </button>
                            </div>
                          )}

                          {isSold && (
                            <button
                              disabled
                              className="w-full py-1 px-2 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed"
                            >
                              Permanent Deed Issued
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PLOT INVENTORY DIRECTORY (TABLE VIEW)                              */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by plot number, title deed reference, or estate name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            >
              <option value="all">All Counties</option>
              {KENYAN_COUNTIES.map((c) => (
                <option key={c} value={c}>{c} County</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available (Green)</option>
              <option value="reserved">Reserved (Timed Hold)</option>
              <option value="sold">Sold & Titled</option>
            </select>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-950 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Plot # & Title Ref</th>
                    <th className="px-4 py-3">Project / Estate</th>
                    <th className="px-4 py-3">Size & Zoning</th>
                    <th className="px-4 py-3">County</th>
                    <th className="px-4 py-3">List Price (KES)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredParcels.map((p) => {
                    const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.available
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900 dark:text-gray-100">{p.plot_number}</div>
                          <div className="text-xs font-mono text-gray-400">{p.title_ref}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.project_name}</td>
                        <td className="px-4 py-3 text-xs">
                          {p.size_acres} Acres • {p.zoning}
                        </td>
                        <td className="px-4 py-3 text-xs">{p.county}</td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrencyKES(p.list_price_kes)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {p.status === 'available' && (
                            <button
                              onClick={() => openHoldModal({
                                id: p.id,
                                plotNumber: p.plot_number,
                                listPriceKes: p.list_price_kes
                              })}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded text-xs font-bold"
                            >
                              Hold (48h)
                            </button>
                          )}
                          {p.status === 'reserved' && (
                            <button
                              onClick={() => handleConvertSale(p.id)}
                              className="px-2.5 py-1 bg-rose-600 text-white rounded text-xs font-bold"
                            >
                              Confirm Sale
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: "LIPA MDOGO MDOGO" INSTALLMENT TRACKER                             */}
      {/* ========================================================================= */}
      {activeTab === 'installments' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Milestone Portfolio</span>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1 font-mono">
                {formatCurrencyKES(installmentsData.summary?.totalPlanAmountKes || 0)}
              </p>
              <div className="text-[11px] text-gray-400 mt-1">
                {installmentsData.summary?.totalMilestones || 0} scheduled milestones
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 shadow-sm bg-emerald-50/20">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">M-Pesa Collected</span>
              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                {formatCurrencyKES(installmentsData.summary?.totalCollectedKes || 0)}
              </p>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                {installmentsData.summary?.collectionRate || 0}% settlement rate
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 shadow-sm bg-amber-50/20">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Outstanding Balance</span>
              <p className="text-xl font-bold text-amber-600 mt-1 font-mono">
                {formatCurrencyKES(installmentsData.summary?.totalOutstandingKes || 0)}
              </p>
              <div className="text-[11px] text-amber-700 mt-1">
                Awaiting client installment payments
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-4 shadow-sm bg-indigo-50/20">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Standard Structure</span>
              <div className="text-xs text-indigo-800 dark:text-indigo-300 font-medium mt-1">
                10% Deposit → 30% Beaconing → 30% LCB → 30% Title
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Automated 4-milestone statutory pathway
              </div>
            </div>
          </div>

          {/* Grouped Deal Milestone Cards */}
          {groupedInstallments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No installment plans active yet"
              description="Create a Lipa Mdogo Mdogo installment schedule for any plot deal to track milestones and M-Pesa payments."
              actionLabel="+ Generate Installment Plan"
              onAction={() => setShowPlanModal(true)}
            />
          ) : (
            groupedInstallments.map((grp) => {
              const progressPct = grp.totalAmount > 0 ? Math.round((grp.paidAmount / grp.totalAmount) * 100) : 0
              return (
                <div
                  key={grp.dealId || grp.customerName}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  {/* Deal Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100">
                          {grp.customerName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {grp.plotNumber}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {grp.dealTitle} • {grp.projectName} {grp.customerPhone ? `(${grp.customerPhone})` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Total Purchase:</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">
                          {formatCurrencyKES(grp.totalAmount)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-emerald-600 font-semibold">Total Paid:</div>
                        <div className="text-sm font-bold text-emerald-600 font-mono">
                          {formatCurrencyKES(grp.paidAmount)} ({progressPct}%)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>

                  {/* 4 Milestones Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    {grp.milestones.map((m) => {
                      const isPaid = m.status === 'paid'
                      const isPartial = m.status === 'partial'
                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
                            isPaid
                              ? 'bg-emerald-50/20 border-emerald-300 dark:border-emerald-800/80'
                              : isPartial
                              ? 'bg-amber-50/20 border-amber-300 dark:border-amber-800/80'
                              : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Milestone #{m.installment_number}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : isPartial
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                              >
                                {m.status}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-1 line-clamp-2">
                              {m.title}
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              Due: {m.due_date ? formatDateKE(m.due_date) : 'Pending'}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60 space-y-2">
                            <div className="flex items-baseline justify-between font-mono">
                              <span className="text-xs text-gray-500">Amount:</span>
                              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                {formatCurrencyKES(m.amount_kes)}
                              </span>
                            </div>

                            {m.mpesa_receipt_number && (
                              <div className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950/60 rounded text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                                <span>M-Pesa:</span>
                                <span>{m.mpesa_receipt_number}</span>
                              </div>
                            )}

                            {!isPaid && (
                              <button
                                onClick={() => openMatchModal(m)}
                                className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs"
                              >
                                <DollarSign className="w-3.5 h-3.5" /> Match M-Pesa Code
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SATURDAY SITE VISIT CONVOYS                                        */}
      {/* ========================================================================= */}
      {activeTab === 'convoys' && (
        <div className="space-y-6">
          {/* Convoy Fleet KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Scheduled Convoys</span>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{convoyMetrics.totalConvoys} Trips</p>
              <div className="text-[11px] text-gray-400 mt-1">Departing Kencom & Westlands</div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 shadow-sm bg-emerald-50/20">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Fleet Seat Quota</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">{convoyMetrics.totalCapacity} Seats</p>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">Available bus inventory</div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-4 shadow-sm bg-indigo-50/20">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Booked Passengers</span>
              <p className="text-xl font-bold text-indigo-600 mt-1">{convoyMetrics.totalBooked} Clients</p>
              <div className="text-[11px] text-indigo-600 font-semibold mt-1">Confirmed land viewing investors</div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800/60 rounded-xl p-4 shadow-sm bg-purple-50/20">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Fleet Occupancy</span>
              <p className="text-xl font-bold text-purple-600 mt-1">{convoyMetrics.occupancyRate}% Full</p>
              <div className="text-[11px] text-purple-600 mt-1">High conversion Saturday site visits</div>
            </div>
          </div>

          {/* Convoys List & Passenger Manifests */}
          {siteVisits.length === 0 ? (
            <EmptyState
              icon={Bus}
              title="No Saturday convoys scheduled"
              description="Schedule a Saturday bus convoy leaving Kencom CBD to Acacia Heights or Juja Ridge for prospective plot buyers."
              actionLabel="+ Schedule Saturday Convoy"
              onAction={() => setShowConvoyModal(true)}
            />
          ) : (
            siteVisits.map((convoy) => {
              const booked = convoy.total_booked_passengers || 0
              const capacity = convoy.total_seats || 33
              const seatsLeft = Math.max(0, capacity - booked)
              const fillPct = Math.round((booked / capacity) * 100)

              return (
                <div
                  key={convoy.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  {/* Convoy Top Details */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <Bus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-gray-900 dark:text-gray-100">
                            {convoy.project_name} Saturday Convoy
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {convoy.destination_county || 'Kiambu'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {convoy.visit_date ? formatDateKE(convoy.visit_date) : 'Saturday'} @ {convoy.departure_time || '08:30 AM'}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            {convoy.departure_location || 'Kencom House, CBD'}
                          </span>
                          <span className="text-gray-400">• {convoy.vehicle_type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-gray-400">Seat Allocation:</span>
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {booked} / {capacity} Seats ({seatsLeft} Left)
                        </div>
                      </div>

                      <button
                        onClick={() => openBookingModal(convoy)}
                        disabled={seatsLeft === 0}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          seatsLeft > 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        {seatsLeft > 0 ? '+ Book Client Seat' : 'Fully Booked'}
                      </button>
                    </div>
                  </div>

                  {/* Seat Quota Fill Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          fillPct >= 90 ? 'bg-rose-500' : fillPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(fillPct, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                      <span>Convoy Departure: 08:30 AM Sharp</span>
                      <span>Lead Marshal: {convoy.marshal_first_name ? `${convoy.marshal_first_name} ${convoy.marshal_last_name}` : 'Captain John'} ({convoy.driver_phone || '+254711000111'})</span>
                    </div>
                  </div>

                  {/* Passenger Manifest Table */}
                  <div className="pt-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Passenger Manifest ({convoy.passengerManifest?.length || 0} Registrations)</span>
                    </h4>

                    {(!convoy.passengerManifest || convoy.passengerManifest.length === 0) ? (
                      <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-xl text-xs text-gray-400 text-center">
                        No clients booked yet for this convoy. Click "+ Book Client Seat" to reserve.
                      </div>
                    ) : (
                      <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                          <thead className="bg-gray-50 dark:bg-gray-950 font-semibold text-gray-500 border-b border-gray-100 dark:border-gray-800">
                            <tr>
                              <th className="px-3 py-2">Investor Name</th>
                              <th className="px-3 py-2">Phone Number</th>
                              <th className="px-3 py-2">Pickup Point</th>
                              <th className="px-3 py-2 text-center">Seats</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {convoy.passengerManifest.map((pass) => (
                              <tr key={pass.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">
                                  {pass.visitor_name}
                                </td>
                                <td className="px-3 py-2 font-mono">{pass.visitor_phone}</td>
                                <td className="px-3 py-2">{pass.pickup_point}</td>
                                <td className="px-3 py-2 text-center font-bold text-emerald-600">
                                  {pass.seats_booked}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    {pass.status || 'confirmed'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-400 truncate max-w-xs">{pass.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD PLOT                                                         */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Grid className="w-5 h-5 text-emerald-600" /> Register Land Parcel / Plot
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Title Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KAJIADO/KITENGELA/8920"
                    value={form.titleRef}
                    onChange={(e) => setForm({ ...form, titleRef: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Plot Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Plot 45"
                    value={form.plotNumber}
                    onChange={(e) => setForm({ ...form, plotNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Estate / Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acacia Heights Estate Phase 2"
                  value={form.projectName}
                  onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Size (Acres)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.sizeAcres}
                    onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    County
                  </label>
                  <select
                    value={form.county}
                    onChange={(e) => setForm({ ...form, county: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  >
                    {KENYAN_COUNTIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    List Price (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="1500000"
                    value={form.listPriceKes}
                    onChange={(e) => setForm({ ...form, listPriceKes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Register Plot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TIMED HOLD & LETTER OF OFFER                                     */}
      {/* ========================================================================= */}
      {showHoldModal && selectedPlotForHold && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" /> Place 48-Hour Timed Hold
              </h3>
              <button onClick={() => setShowHoldModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyHold} className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs">
                Plot: <strong>{selectedPlotForHold.plotNumber}</strong> • Valuation: <strong>{formatCurrencyKES(selectedPlotForHold.listPriceKes)}</strong>
                <p className="text-[11px] text-amber-700 mt-1">
                  Plot status flips to Yellow. If deposit is not matched within the countdown window, system automatically releases it back to Green.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Select Prospective Buyer *
                </label>
                <select
                  required
                  value={holdForm.customerId}
                  onChange={(e) => setHoldForm({ ...holdForm, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                >
                  <option value="">-- Choose Client --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.phone || c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Hold Window (Hours)
                  </label>
                  <select
                    value={holdForm.holdHours}
                    onChange={(e) => setHoldForm({ ...holdForm, holdHours: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  >
                    <option value={24}>24 Hours</option>
                    <option value={48}>48 Hours (Standard LOO)</option>
                    <option value={72}>72 Hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    10% Deposit (KES)
                  </label>
                  <input
                    type="number"
                    value={holdForm.depositRequiredKes}
                    onChange={(e) => setHoldForm({ ...holdForm, depositRequiredKes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Letter of Offer Reference
                </label>
                <input
                  type="text"
                  value={holdForm.letterOfOfferRef}
                  onChange={(e) => setHoldForm({ ...holdForm, letterOfOfferRef: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono uppercase"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                >
                  Confirm Timed Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: GENERATE LIPA MDOGO MDOGO PLAN                                   */}
      {/* ========================================================================= */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" /> Generate Lipa Mdogo Mdogo Schedule
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Select Land Deal *
                </label>
                <select
                  required
                  value={planForm.dealId}
                  onChange={(e) => {
                    const d = deals.find((deal) => deal.id.toString() === e.target.value)
                    setPlanForm({
                      ...planForm,
                      dealId: e.target.value,
                      customerId: d?.customer_id || planForm.customerId,
                      totalAmountKes: d?.value || planForm.totalAmountKes
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                >
                  <option value="">-- Choose Deal --</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({formatCurrencyKES(d.value)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Client *
                  </label>
                  <select
                    required
                    value={planForm.customerId}
                    onChange={(e) => setPlanForm({ ...planForm, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  >
                    <option value="">-- Select Client --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Plot / Parcel
                  </label>
                  <select
                    value={planForm.parcelId}
                    onChange={(e) => setPlanForm({ ...planForm, parcelId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  >
                    <option value="">-- Optional Plot --</option>
                    {parcels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.plot_number} ({p.project_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Total Sale Price (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="1500000"
                    value={planForm.totalAmountKes}
                    onChange={(e) => setPlanForm({ ...planForm, totalAmountKes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Commencement Date
                  </label>
                  <input
                    type="date"
                    required
                    value={planForm.startDate}
                    onChange={(e) => setPlanForm({ ...planForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              {/* 4 Milestones Breakdown preview */}
              {planForm.totalAmountKes > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1.5 text-xs">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-[10px]">
                    Automatic 4-Milestone Schedule:
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600 dark:text-gray-300 font-mono">
                    <div>1. 10% Deposit (7 Days):</div>
                    <div className="font-bold">{formatCurrencyKES(parseFloat(planForm.totalAmountKes) * 0.10)}</div>
                    <div>2. 30% Beaconing (30 Days):</div>
                    <div className="font-bold">{formatCurrencyKES(parseFloat(planForm.totalAmountKes) * 0.30)}</div>
                    <div>3. 30% LCB Consent (60 Days):</div>
                    <div className="font-bold">{formatCurrencyKES(parseFloat(planForm.totalAmountKes) * 0.30)}</div>
                    <div>4. 30% Title Handover (90 Days):</div>
                    <div className="font-bold">{formatCurrencyKES(parseFloat(planForm.totalAmountKes) * 0.30)}</div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Generate Milestones
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: MATCH M-PESA CODE                                                */}
      {/* ========================================================================= */}
      {showMatchModal && selectedMilestoneForMatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Match M-Pesa Transaction
              </h3>
              <button onClick={() => setShowMatchModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMatchMpesa} className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs space-y-1">
                <div className="font-bold text-gray-900 dark:text-gray-100">
                  {selectedMilestoneForMatch.title}
                </div>
                <div className="text-gray-500 font-mono">
                  Milestone Due: {formatCurrencyKES(selectedMilestoneForMatch.amount_kes)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  M-Pesa Transaction Receipt Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QK87XP492L or RJK9201824"
                  value={matchForm.mpesaReceiptNumber}
                  onChange={(e) => setMatchForm({ ...matchForm, mpesaReceiptNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Amount Received (KES) *
                </label>
                <input
                  type="number"
                  required
                  value={matchForm.amountPaidKes}
                  onChange={(e) => setMatchForm({ ...matchForm, amountPaidKes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMatchModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Confirm M-Pesa Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: SCHEDULE SATURDAY CONVOY                                         */}
      {/* ========================================================================= */}
      {showConvoyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Bus className="w-5 h-5 text-emerald-600" /> Schedule Saturday Site Visit Convoy
              </h3>
              <button onClick={() => setShowConvoyModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleConvoy} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Destination Project *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juja Ridge Phase 2"
                    value={convoyForm.projectName}
                    onChange={(e) => setConvoyForm({ ...convoyForm, projectName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Destination County
                  </label>
                  <select
                    value={convoyForm.destinationCounty}
                    onChange={(e) => setConvoyForm({ ...convoyForm, destinationCounty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  >
                    {KENYAN_COUNTIES.map((c) => (
                      <option key={c} value={c}>{c} County</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Convoy Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={convoyForm.visitDate}
                    onChange={(e) => setConvoyForm({ ...convoyForm, visitDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Departure Time
                  </label>
                  <input
                    type="text"
                    value={convoyForm.departureTime}
                    onChange={(e) => setConvoyForm({ ...convoyForm, departureTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Nairobi Departure Hub
                </label>
                <input
                  type="text"
                  value={convoyForm.departureLocation}
                  onChange={(e) => setConvoyForm({ ...convoyForm, departureLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={convoyForm.vehicleType}
                    onChange={(e) => {
                      const vt = e.target.value
                      let seats = 33
                      if (vt.includes('14')) seats = 14
                      if (vt.includes('4x4')) seats = 7
                      setConvoyForm({ ...convoyForm, vehicleType: vt, totalSeats: seats })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  >
                    <option value="33-Seater Executive Shuttle">33-Seater Executive Shuttle</option>
                    <option value="14-Seater Tour Van">14-Seater Tour Van</option>
                    <option value="4x4 VIP Land Cruiser">4x4 VIP Land Cruiser (7 Seats)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Total Bus Seats
                  </label>
                  <input
                    type="number"
                    value={convoyForm.totalSeats}
                    onChange={(e) => setConvoyForm({ ...convoyForm, totalSeats: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConvoyModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Schedule Convoy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: BOOK CONVOY PASSENGER SEAT                                       */}
      {/* ========================================================================= */}
      {showBookingModal && selectedConvoyForBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" /> Book Saturday Convoy Seat
              </h3>
              <button onClick={() => setShowBookingModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookPassenger} className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-1">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">
                  {selectedConvoyForBooking.project_name} Site Visit
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Departure: {selectedConvoyForBooking.departure_location} @ {selectedConvoyForBooking.departure_time}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Select Registered Client (Optional)
                </label>
                <select
                  value={bookingForm.customerId}
                  onChange={(e) => {
                    const c = customers.find((cust) => cust.id.toString() === e.target.value)
                    if (c) {
                      setBookingForm({
                        ...bookingForm,
                        customerId: e.target.value,
                        visitorName: `${c.first_name} ${c.last_name}`,
                        visitorPhone: c.phone || ''
                      })
                    } else {
                      setBookingForm({ ...bookingForm, customerId: e.target.value })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                >
                  <option value="">-- Or enter custom visitor details below --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.phone || c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Passenger / Visitor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mary Wanjiku"
                  value={bookingForm.visitorName}
                  onChange={(e) => setBookingForm({ ...bookingForm, visitorName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Phone (+254...) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+254712345678"
                    value={bookingForm.visitorPhone}
                    onChange={(e) => setBookingForm({ ...bookingForm, visitorPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Seats To Book
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={bookingForm.seatsBooked}
                    onChange={(e) => setBookingForm({ ...bookingForm, seatsBooked: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Pickup Stop
                </label>
                <input
                  type="text"
                  value={bookingForm.pickupPoint}
                  onChange={(e) => setBookingForm({ ...bookingForm, pickupPoint: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Reserve Convoy Seat(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Parcels

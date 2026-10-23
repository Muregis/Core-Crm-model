// Parcels.jsx
// Land & Real Estate Inventory Pack: plots/lots management, title deeds, zoning, status tracking, and deal linkage.
import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  UserCheck
} from 'lucide-react'
import { parcelService } from '../services/parcelService'
import { dealService } from '../services/dealService'
import { customerService } from '../services/customerService'
import { formatCurrencyKES } from '../utils/formatters'
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
    label: 'Sold',
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
  const [parcels, setParcels] = useState([])
  const [matrixData, setMatrixData] = useState(null)
  const [customers, setCustomers] = useState([])
  const [deals, setDeals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [countyFilter, setCountyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('matrix') // 'matrix' | 'list'
  const [selectedProject, setSelectedProject] = useState('all')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [selectedPlotForHold, setSelectedPlotForHold] = useState(null)

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

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [matrixRes, parcelsRes, dealsRes, custRes] = await Promise.all([
        parcelService.getPlotMatrix().catch(() => ({ data: { success: false } })),
        parcelService.getParcels({ limit: 100 }),
        dealService.getDeals().catch(() => ({ data: { success: false } })),
        customerService.getCustomers({ limit: 100 }).catch(() => ({ data: { success: false } }))
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
    } catch (err) {
      toast.error('Failed to load parcel data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered parcels for list view
  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      const text = `${p.title_ref || ''} ${p.plot_number || ''} ${p.name || ''} ${p.project_name || ''} ${p.county || ''}`.toLowerCase()
      const matchSearch = text.includes(searchTerm.toLowerCase())
      const matchCounty = countyFilter === 'all' || p.county === countyFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchCounty && matchStatus
    })
  }, [parcels, searchTerm, countyFilter, statusFilter])

  // Matrix projects filter
  const displayedProjects = useMemo(() => {
    if (!matrixData?.projects) return []
    if (selectedProject === 'all') return matrixData.projects
    return matrixData.projects.filter((p) => p.name === selectedProject)
  }, [matrixData, selectedProject])

  // Handle open Hold modal
  const openHoldModal = (plot) => {
    setSelectedPlotForHold(plot)
    setHoldForm({
      customerId: '',
      holdHours: 48,
      letterOfOfferRef: `LOO-${Date.now().toString(36).toUpperCase()}-${plot.plotNumber || plot.id}`,
      depositRequiredKes: Math.round((plot.listPriceKes || plot.list_price_kes || 1500000) * 0.1),
      notes: `Letter of Offer reservation for ${plot.plotNumber || plot.id}.`
    })
    setShowHoldModal(true)
  }

  // Submit timed hold
  const handleHoldSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPlotForHold) return

    try {
      await parcelService.reserveHold(selectedPlotForHold.id, {
        customerId: holdForm.customerId ? parseInt(holdForm.customerId, 10) : null,
        holdHours: parseInt(holdForm.holdHours, 10) || 48,
        letterOfOfferRef: holdForm.letterOfOfferRef,
        depositRequiredKes: parseFloat(holdForm.depositRequiredKes) || 0,
        notes: holdForm.notes
      })

      toast.success(`Plot reserved with ${holdForm.holdHours}-hour timed hold!`)
      setShowHoldModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place hold')
    }
  }

  // Release hold
  const handleReleaseHold = async (plotId) => {
    try {
      await parcelService.releaseHold(plotId)
      toast.success('Reservation hold released; plot is now Available')
      loadData()
    } catch (err) {
      toast.error('Failed to release hold')
    }
  }

  // Convert to sale
  const handleConvertSale = async (plotId) => {
    try {
      await parcelService.convertSale(plotId, {
        note: 'Deposit cleared & sale agreement executed.'
      })
      toast.success('Plot confirmed as Sold!')
      loadData()
    } catch (err) {
      toast.error('Failed to convert hold to sale')
    }
  }

  // Add plot submit
  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!form.titleRef || !form.listPriceKes) {
      toast.error('Title reference and price are required')
      return
    }

    try {
      await parcelService.createParcel({
        titleRef: form.titleRef.trim().toUpperCase(),
        plotNumber: form.plotNumber,
        name: form.name || `${form.projectName} - ${form.plotNumber}`,
        sizeAcres: parseFloat(form.sizeAcres) || 0.125,
        county: form.county,
        ward: form.ward,
        locationNotes: form.locationNotes,
        zoning: form.zoning,
        listPriceKes: parseFloat(form.listPriceKes),
        dealId: form.dealId ? parseInt(form.dealId, 10) : null
      })
      toast.success('Parcel plot registered successfully')
      setShowAddModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add parcel')
    }
  }

  const summary = matrixData?.summary || {
    totalPlots: parcels.length,
    availablePlots: parcels.filter((p) => p.status === 'available').length,
    reservedPlots: parcels.filter((p) => p.status === 'reserved').length,
    soldPlots: parcels.filter((p) => p.status === 'sold').length,
    totalValuationKes: parcels.reduce((sum, p) => sum + (parseFloat(p.list_price_kes) || 0), 0),
    availableRate: 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Interactive Plot Matrix & Land Inventory
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Real Estate State Machine
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Visual master plan estate grid, automated 48-hour reservation holds, and ArdhiSasa conveyancing linkage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950">
            <button
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Grid className="w-3.5 h-3.5 mr-1.5" />
              Plot Matrix (Grid)
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <List className="w-3.5 h-3.5 mr-1.5" />
              Table View
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            + Add Plot
          </button>
        </div>
      </div>

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
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Reserved (Timed Hold)</span>
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

      {/* MATRIX VIEW */}
      {viewMode === 'matrix' && (
        <div className="space-y-6">
          {/* Project Selector tabs */}
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

          {/* Render Estate Grids */}
          {displayedProjects.map((proj) => (
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
                    {proj.stats.available} Available
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                    {proj.stats.reserved} Reserved
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                    {proj.stats.sold} Sold
                  </span>
                </div>
              </div>

              {/* The Color-Coded Master Plan Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {proj.plots.map((plot) => {
                  const isAvailable = plot.status === 'available'
                  const isReserved = plot.status === 'reserved'
                  const isSold = plot.status === 'sold'

                  // Format countdown hours & minutes
                  let countdownText = null
                  if (isReserved && typeof plot.holdDetails?.remainingSeconds === 'number') {
                    const secs = plot.holdDetails.remainingSeconds
                    const hrs = Math.floor(secs / 3600)
                    const mins = Math.floor((secs % 3600) / 60)
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

                        <div className="text-xs text-gray-500 mt-1 font-mono">
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
                                Buyer: <strong>{plot.holdDetails?.clientName}</strong>
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
          ))}
        </div>
      )}

      {/* TABLE VIEW (Fallback & List Inspection) */}
      {viewMode === 'list' && (
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
                  const badge = STATUS_CONFIG[p.status] || STATUS_CONFIG.available
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {p.plot_number || `Plot #${p.id}`}
                        <div className="text-xs font-mono text-gray-400">{p.title_ref}</div>
                      </td>
                      <td className="px-4 py-3">{p.project_name || p.name || 'Phase 1'}</td>
                      <td className="px-4 py-3">{p.size_acres} Acres • {p.zoning}</td>
                      <td className="px-4 py-3">{p.county}</td>
                      <td className="px-4 py-3 font-bold font-mono text-gray-900 dark:text-gray-100">
                        {formatCurrencyKES(p.list_price_kes)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status === 'available' && (
                          <button
                            onClick={() => openHoldModal(p)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                          >
                            + Hold (48h)
                          </button>
                        )}
                        {p.status === 'reserved' && (
                          <button
                            onClick={() => handleReleaseHold(p.id)}
                            className="text-xs font-bold text-amber-600 hover:text-amber-700"
                          >
                            Release Hold
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
      )}

      {/* 48-Hour Reservation Hold Modal */}
      {showHoldModal && selectedPlotForHold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                    Place Timed Reservation Hold
                  </h3>
                  <p className="text-xs text-gray-500">
                    State Machine automatically releases plot to Available if unconfirmed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHoldModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Target Plot:</span>
                <strong className="text-gray-900 dark:text-gray-100">{selectedPlotForHold.plotNumber || selectedPlotForHold.plot_number} ({selectedPlotForHold.titleRef || selectedPlotForHold.title_ref})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Plot List Price:</span>
                <strong className="text-gray-900 dark:text-gray-100 font-mono">{formatCurrencyKES(selectedPlotForHold.listPriceKes || selectedPlotForHold.list_price_kes)}</strong>
              </div>
            </div>

            <form onSubmit={handleHoldSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Prospective Buyer / Investor
                </label>
                <select
                  value={holdForm.customerId}
                  onChange={(e) => setHoldForm({ ...holdForm, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                >
                  <option value="">-- Select Registered Buyer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name || ''} ({c.phone || c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Hold Window Duration *
                  </label>
                  <select
                    value={holdForm.holdHours}
                    onChange={(e) => setHoldForm({ ...holdForm, holdHours: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-medium"
                  >
                    <option value={24}>24 Hours (Urgent)</option>
                    <option value={48}>48 Hours (Standard LOO)</option>
                    <option value={72}>72 Hours (Weekend)</option>
                    <option value={168}>7 Days (Extended Deposit)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Required Deposit (KES)
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
                  Letter of Offer Reference *
                </label>
                <input
                  type="text"
                  required
                  value={holdForm.letterOfOfferRef}
                  onChange={(e) => setHoldForm({ ...holdForm, letterOfOfferRef: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  Activate {holdForm.holdHours}h Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Parcel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                Register Land Parcel / Plot
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
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
    </div>
  )
}

export default Parcels

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
  ExternalLink
} from 'lucide-react'
import { parcelService } from '../services/parcelService'
import { dealService } from '../services/dealService'
import { formatCurrencyKES } from '../utils/formatters'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  },
  reserved: {
    label: 'Reserved',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  },
  sold: {
    label: 'Sold',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
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
  const [deals, setDeals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [countyFilter, setCountyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [statusModalParcel, setStatusModalParcel] = useState(null)
  const [newStatus, setNewStatus] = useState('reserved')
  const [statusNote, setStatusNote] = useState('')

  const [form, setForm] = useState({
    titleRef: '',
    plotNumber: '',
    name: '',
    sizeAcres: '0.125',
    county: 'Machakos',
    ward: '',
    locationNotes: '',
    zoning: 'Residential',
    listPriceKes: '',
    dealId: ''
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [parcelsRes, dealsRes] = await Promise.all([
        parcelService.getParcels({ limit: 100 }),
        dealService.getDeals().catch(() => ({ data: { success: false } }))
      ])

      if (parcelsRes.data?.success) {
        setParcels(parcelsRes.data.data.parcels || [])
      }
      if (dealsRes.data?.success) {
        setDeals(dealsRes.data.data.deals || [])
      }
    } catch (err) {
      // Fallback sample data
      setParcels([
        {
          id: 1,
          title_ref: 'KJD/KITENGELA/48201',
          plot_number: 'Plot 44',
          name: 'Kitengela Acacia Greens Phase 2',
          size_acres: 0.125,
          county: 'Kajiado',
          ward: 'Kitengela',
          location_notes: '1.5km off Namanga Road, fenced with borehole water & electricity',
          zoning: 'Residential',
          status: 'available',
          list_price_kes: 1500000
        },
        {
          id: 2,
          title_ref: 'MKS/KAMULU/19284',
          plot_number: 'Plot 12',
          name: 'Joska Kamulu View Estate',
          size_acres: 0.25,
          county: 'Machakos',
          ward: 'Matungulu West',
          location_notes: 'Near Kangundo Road, ready title deed',
          zoning: 'Commercial / Residential',
          status: 'reserved',
          list_price_kes: 2200000,
          deal_title: 'Kamulu Plot 12 Purchase'
        },
        {
          id: 3,
          title_ref: 'KMB/JUJA/99102',
          plot_number: 'Plot 8',
          name: 'Juja Farm Prime',
          size_acres: 0.5,
          county: 'Kiambu',
          ward: 'Juja',
          location_notes: 'Touching proposed bypass tarmac',
          zoning: 'Agricultural / Residential',
          status: 'sold',
          list_price_kes: 3500000
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      const text = `${p.title_ref || ''} ${p.plot_number || ''} ${p.name || ''} ${p.county || ''} ${p.location_notes || ''}`.toLowerCase()
      const matchSearch = text.includes(searchTerm.toLowerCase())
      const matchCounty = countyFilter === 'all' || p.county === countyFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchCounty && matchStatus
    })
  }, [parcels, searchTerm, countyFilter, statusFilter])

  const metrics = useMemo(() => {
    const total = parcels.length
    const available = parcels.filter((p) => p.status === 'available').length
    const reserved = parcels.filter((p) => p.status === 'reserved').length
    const sold = parcels.filter((p) => p.status === 'sold').length
    const totalValue = parcels.reduce((sum, p) => sum + (parseFloat(p.list_price_kes) || 0), 0)
    return { total, available, reserved, sold, totalValue }
  }, [parcels])

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
        name: form.name,
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
      setForm({
        titleRef: '',
        plotNumber: '',
        name: '',
        sizeAcres: '0.125',
        county: 'Machakos',
        ward: '',
        locationNotes: '',
        zoning: 'Residential',
        listPriceKes: '',
        dealId: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add parcel')
    }
  }

  const handleStatusChangeSubmit = async (e) => {
    e.preventDefault()
    if (!statusModalParcel) return

    try {
      await parcelService.updateStatus(statusModalParcel.id, {
        status: newStatus,
        note: statusNote
      })
      toast.success(`Parcel marked as ${newStatus}`)
      setStatusModalParcel(null)
      setStatusNote('')
      loadData()
    } catch (err) {
      toast.error('Failed to update parcel status')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Land & Property Inventory</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Industry Pack 1
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Parcel inventory, title deed tracking, plot status (Available, Reserved, Sold), and sales pipeline linkage.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Parcel / Plot
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Total Inventory</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{metrics.total} Plots</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Available</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.available}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase">Reserved</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.reserved}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 uppercase">Sold</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.sold}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold text-purple-600 uppercase">Portfolio Value</span>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatCurrencyKES(metrics.totalValue)}
          </p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title deed, plot #, estate, county..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <select
            value={countyFilter}
            onChange={(e) => setCountyFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Counties</option>
            {KENYAN_COUNTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
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

      {/* Parcel Cards Grid */}
      {filteredParcels.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Land Parcels Found"
          description="Register your land parcels, estates, and plot numbers to manage plot reservations and installment deals."
          actionLabel="Add First Parcel"
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredParcels.map((p) => {
            const statusBadge = STATUS_CONFIG[p.status] || STATUS_CONFIG.available

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-wider block">
                      {p.plot_number || 'Plot'}
                    </span>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                      {p.name || p.title_ref}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge.color}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                <div className="text-xs space-y-2 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Title Deed:</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {p.title_ref}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Location:</span>
                    <span className="font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      {p.ward ? `${p.ward}, ` : ''}{p.county}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Size:</span>
                    <span className="font-medium">
                      {p.size_acres} Acres {p.size_acres === 0.125 ? '(50x100 / 1/8th)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Zoning:</span>
                    <span className="font-medium">{p.zoning || 'Residential'}</span>
                  </div>
                </div>

                {p.location_notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 italic">
                    "{p.location_notes}"
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase font-semibold block">Price (KES)</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyKES(p.list_price_kes)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setStatusModalParcel(p)
                      setNewStatus(p.status === 'available' ? 'reserved' : p.status === 'reserved' ? 'sold' : 'available')
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1 text-primary-600" />
                    Status
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Parcel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Land Parcel / Plot</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Title Reference No.
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KJD/KITENGELA/1234"
                    value={form.titleRef}
                    onChange={(e) => setForm({ ...form, titleRef: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Plot Number / Lot
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Plot 42"
                    value={form.plotNumber}
                    onChange={(e) => setForm({ ...form, plotNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Estate / Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acacia Greens Phase 3"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    County
                  </label>
                  <select
                    value={form.county}
                    onChange={(e) => setForm({ ...form, county: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {KENYAN_COUNTIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Ward / Sub-County
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kitengela / Joska"
                    value={form.ward}
                    onChange={(e) => setForm({ ...form, ward: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Size in Acres
                  </label>
                  <select
                    value={form.sizeAcres}
                    onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="0.125">1/8 Acre (50 x 100)</option>
                    <option value="0.25">1/4 Acre (100 x 100)</option>
                    <option value="0.5">1/2 Acre</option>
                    <option value="1.0">1.0 Acre</option>
                    <option value="5.0">5.0 Acres (Block)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    List Price (KES)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1500000"
                    value={form.listPriceKes}
                    onChange={(e) => setForm({ ...form, listPriceKes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Location Notes & Amenities
                </label>
                <textarea
                  rows={2}
                  placeholder="Water, 3-phase electricity, beaconed, ready title, road access..."
                  value={form.locationNotes}
                  onChange={(e) => setForm({ ...form, locationNotes: e.target.value })}
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Register Plot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {statusModalParcel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Update Status: {statusModalParcel.plot_number || statusModalParcel.title_ref}
              </h3>
              <button
                onClick={() => setStatusModalParcel(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleStatusChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                >
                  <option value="available">Available (Open for sale)</option>
                  <option value="reserved">Reserved (Deposit paid / in escrow)</option>
                  <option value="sold">Sold (Title deed transferred)</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Status Change Note / Audit Reason
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Deposit of KES 200,000 paid via M-Pesa receipt QK987654"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setStatusModalParcel(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Confirm Change
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

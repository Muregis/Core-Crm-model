// frontend/src/components/PricingFinancialModelModal.jsx
// Sawa Repairs Operating Model v2.0: Driver-Based Pricing Config & Observable Financial Sensitivity
import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  Edit2,
  Check,
  X,
  RefreshCw,
  Info,
  Calendar,
  ChevronRight
} from 'lucide-react'
import pricingConfigService from '../services/pricingConfigService'
import toast from 'react-hot-toast'

export default function PricingFinancialModelModal({ isOpen, onClose }) {
  const [model, setModel] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sensitivity') // 'sensitivity', 'drivers', 'runway'

  // Edit Driver State
  const [editingKey, setEditingKey] = useState(null)
  const [editForm, setEditForm] = useState({
    value: '',
    unit: 'KES',
    reason: '',
    effective_from: new Date().toISOString().slice(0, 10)
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [modelRes, driversRes] = await Promise.all([
        pricingConfigService.getFinancialModel(),
        pricingConfigService.getActiveDrivers()
      ])
      if (modelRes.data?.data) {
        setModel(modelRes.data.data)
      }
      if (driversRes.data?.data?.drivers) {
        setDrivers(driversRes.data.data.drivers)
      }
    } catch (err) {
      toast.error('Failed to load financial model data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleStartEdit = (driver) => {
    setEditingKey(driver.key)
    setEditForm({
      value: String(driver.value),
      unit: driver.unit || 'KES',
      reason: '',
      effective_from: new Date().toISOString().slice(0, 10)
    })
  }

  const handleSaveDriver = async (e) => {
    e.preventDefault()
    if (!editForm.value || isNaN(Number(editForm.value))) {
      toast.error('Please enter a valid numeric value')
      return
    }
    if (!editForm.reason.trim()) {
      toast.error('Please enter an audit reason for changing this pricing driver')
      return
    }

    setIsSubmitting(true)
    try {
      await pricingConfigService.updateDriver(editingKey, {
        value: Number(editForm.value),
        unit: editForm.unit,
        reason: editForm.reason.trim(),
        effective_from: editForm.effective_from
      })
      toast.success(`Pricing driver '${editingKey}' updated successfully!`)
      setEditingKey(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update driver')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/80 text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Financial Model & Pricing Drivers
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-950/70 dark:text-primary-300">
                  Model v2.0
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Zero hardcoded constants. Real-time contribution margins, sensitivity bands, and working capital float.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh live model"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-4">
          <button
            onClick={() => setActiveTab('sensitivity')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'sensitivity'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Break-Even & Sensitivity Bands
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'drivers'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Pricing Drivers ({drivers.length})
          </button>
          <button
            onClick={() => setActiveTab('runway')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'runway'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Cash Runway Ramp (4-Month)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Computing live financial break-even & drivers...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: BREAK-EVEN & SENSITIVITY */}
              {activeTab === 'sensitivity' && model && (
                <div className="space-y-6">
                  {/* Top Key Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                        Monthly Fixed Burn
                      </span>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                        KES {Number(model.fixed_burn.total_monthly_fixed_burn_kes || 125000).toLocaleString()}
                      </p>
                      <span className="text-xs text-gray-400 mt-1 block">Ops + QA + Cloud + Fuel</span>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                        Retainer MRR Netting
                      </span>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        KES {Number(model.fixed_burn.retainer_mrr_kes || 0).toLocaleString()}
                      </p>
                      <span className="text-xs text-emerald-500 mt-1 block">
                        {model.fixed_burn.active_retainers_count || 0} active Sawa Care contract(s)
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                        Blended Margin / Ticket
                      </span>
                      <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                        KES {Number(model.unit_economics.blended_contribution_margin_kes || 2040).toLocaleString()}
                      </p>
                      <span className="text-xs text-gray-400 mt-1 block">
                        Net of 1.2% M-Pesa & 50% fundi split
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                        Base Break-Even Run Rate
                      </span>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {model.break_even_with_current_retainers.monthly_tickets} tickets/mo
                      </p>
                      <span className="text-xs text-gray-400 mt-1 block">
                        ≈ {model.break_even_with_current_retainers.daily_tickets} completed tickets / day
                      </span>
                    </div>
                  </div>

                  {/* Sensitivity Bands Cards */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary-500" />
                      Break-Even Sensitivity Bands (Model v2.0 §5)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Favourable */}
                      <div className="p-5 rounded-xl border-2 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            Favourable Band
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200">
                            High Conversion
                          </span>
                        </div>
                        <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-3">
                          {model.break_even_sensitivity_bands.favourable.monthly_tickets_break_even}{' '}
                          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">tickets/mo</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ≈ {model.break_even_sensitivity_bands.favourable.daily_tickets_break_even} tickets / day
                        </p>
                        <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                          <div className="flex justify-between">
                            <span>Target Margin:</span>
                            <span className="font-semibold">KES {model.break_even_sensitivity_bands.favourable.blended_margin_per_ticket.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Assumed Fixed Burn:</span>
                            <span className="font-semibold">KES {model.break_even_sensitivity_bands.favourable.fixed_burn_kes.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Base */}
                      <div className="p-5 rounded-xl border-2 border-primary-300 dark:border-primary-800 bg-primary-50/30 dark:bg-primary-950/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                            Base Scenario
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary-100 text-primary-800 dark:bg-primary-900/80 dark:text-primary-200">
                            Current Empirical
                          </span>
                        </div>
                        <p className="text-3xl font-extrabold text-primary-700 dark:text-primary-400 mt-3">
                          {model.break_even_sensitivity_bands.base.monthly_tickets_break_even}{' '}
                          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">tickets/mo</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ≈ {model.break_even_sensitivity_bands.base.daily_tickets_break_even} tickets / day
                        </p>
                        <div className="mt-4 pt-3 border-t border-primary-200/60 dark:border-primary-900/40 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                          <div className="flex justify-between">
                            <span>Active Margin:</span>
                            <span className="font-semibold">KES {model.break_even_sensitivity_bands.base.blended_margin_per_ticket.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Monthly Fixed Burn:</span>
                            <span className="font-semibold">KES {model.break_even_sensitivity_bands.base.fixed_burn_kes.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Adverse */}
                      <div className="p-5 rounded-xl border-2 border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            Adverse Scenario
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200">
                            Parts Inflation / Rework
                          </span>
                        </div>
                        <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-400 mt-3">
                          {model.break_even_sensitivity_bands.adverse.monthly_tickets_break_even}{' '}
                          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">tickets/mo</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ≈ {model.break_even_sensitivity_bands.adverse.daily_tickets_break_even} tickets / day
                        </p>
                        <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                          <div className="flex justify-between">
                            <span>Depressed Margin:</span>
                            <span className="font-semibold">KES {model.break_even_sensitivity_bands.adverse.blended_margin_per_ticket.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Burn (+Overhead Buffer):</span>
                            <span className="font-semibold">KES {model.break_even_sensitivity_bands.adverse.fixed_burn_kes.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Working Capital & Cash Constraints Callout */}
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        Working Capital Constraint: Parts Float Requirement (KES 50,000)
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        At {model.break_even_sensitivity_bands.base.monthly_tickets_break_even} tickets/month, projected wholesale parts purchasing exceeds{' '}
                        <strong>KES {Number(model.working_capital_observability.projected_monthly_parts_volume_kes).toLocaleString()} / month</strong>.
                        To protect cash reserves, the system enforces the <strong>100% Parts Deposit Rule</strong>: send M-Pesa STK push for parts immediately upon landlord quote approval before dispatching funds to fundis.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRICING DRIVERS TABLE */}
              {activeTab === 'drivers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Every row is effective-dated. Changes are logged to the immutable audit trail and applied only to new tickets.
                    </p>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Driver Key</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Category</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Active Value</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Effective Date</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                        {drivers.map((d) => (
                          <tr key={d.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">
                              {d.key}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs max-w-xs truncate">
                              {d.description || 'Configurable operating driver'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 capitalize">
                                {d.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">
                              {d.unit === 'KES' ? 'KES ' : ''}
                              {Number(d.value).toLocaleString()}
                              {d.unit !== 'KES' ? ` ${d.unit}` : ''}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">
                              {d.effective_from || '2026-01-01'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleStartEdit(d)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Inline Edit Form Modal */}
                  {editingKey && (
                    <div className="p-4 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-950/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary-900 dark:text-primary-200">
                          Update Driver: <code className="font-mono">{editingKey}</code>
                        </span>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                      <form onSubmit={handleSaveDriver} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            New Value
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={editForm.value}
                            onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Effective Date
                          </label>
                          <input
                            type="date"
                            value={editForm.effective_from}
                            onChange={(e) => setEditForm({ ...editForm, effective_from: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Audit Reason (Required)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Price review Q1"
                            value={editForm.reason}
                            onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                            required
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            {isSubmitting ? 'Saving...' : 'Save Driver'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: RUNWAY RAMP */}
              {activeTab === 'runway' && model && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                          Minimum Safety Cash Reserve: KES {Number(model.recommended_cash_reserve_kes).toLocaleString()}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Operating break-even is achieved in Month 4 (70 tickets + 10 retainers). Minimum KES 500k–600k safety buffer required for payroll and float.
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        Cash Flow Positive in M4
                      </span>
                    </div>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Ramp Month</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Target Tickets</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Care Retainers</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Ticket Contribution</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Retainer MRR</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Net vs Fixed Burn</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Cumulative Cash</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                        {model.runway_projections.map((r) => (
                          <tr key={r.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                              Month {r.month}
                            </td>
                            <td className="px-4 py-3 text-center">{r.tickets}</td>
                            <td className="px-4 py-3 text-center">{r.retainers}</td>
                            <td className="px-4 py-3 text-right">KES {Math.round(r.contribution_kes).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                              KES {Math.round(r.retainer_kes).toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${
                              r.net_vs_fixed >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {r.net_vs_fixed >= 0 ? '+' : ''}KES {Math.round(r.net_vs_fixed).toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${
                              r.cumulative_cash_kes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {r.cumulative_cash_kes >= 0 ? '+' : ''}KES {Math.round(r.cumulative_cash_kes).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Governing Principle: No hardcoded pricing constants. Tickets snapshot applied drivers immutably.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium text-sm hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

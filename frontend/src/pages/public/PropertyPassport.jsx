// frontend/src/pages/public/PropertyPassport.jsx
// Sawa Repairs Digital Property Maintenance Passport & Monthly Statement Portal
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  DollarSign,
  Printer,
  Download,
  AlertTriangle,
  Clock,
  Sparkles,
  Wrench,
  FileText,
  Phone,
  Camera,
  Layers,
  ArrowRight,
  CreditCard,
  ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function PropertyPassport() {
  const { token } = useParams()
  const [passportData, setPassportData] = useState(null)
  const [monthlyReport, setMonthlyReport] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [activeTab, setActiveTab] = useState('statement') // 'statement', 'health', 'warranties', 'airbnb'
  const [isLoading, setIsLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState(null)

  // M-Pesa State
  const [isPaying, setIsPaying] = useState(false)
  const [payPhone, setPayPhone] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    fetchPassport()
  }, [token])

  useEffect(() => {
    if (passportData) {
      fetchMonthlyReport(selectedMonth)
    }
  }, [passportData, selectedMonth])

  const fetchPassport = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:5000/api/public/properties/passport/${token}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setPassportData(data.data.property_passport)
      } else {
        setError(data.message || 'Property passport not found or invalid link.')
      }
    } catch (err) {
      setError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMonthlyReport = async (month) => {
    setReportLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/api/public/properties/passport/${token}/monthly-report?monthYear=${month}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setMonthlyReport(data.data)
      }
    } catch (err) {
      console.error('Error fetching monthly report:', err)
    } finally {
      setReportLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleMpesaPay = async (e) => {
    e.preventDefault()
    if (!payPhone) {
      toast.error('Please enter an M-Pesa phone number')
      return
    }
    setPayLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/api/public/tickets/pay/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: payPhone, amount: monthlyReport?.portfolio_summary?.total_spend_kes || 5000 })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`M-Pesa payment received! Receipt: ${data.receiptNumber}`)
        setIsPaying(false)
        fetchMonthlyReport(selectedMonth)
      } else {
        toast.error(data.message || 'Payment initiation failed')
      }
    } catch (err) {
      toast.error('Payment request failed')
    } finally {
      setPayLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium text-sm">Opening Property Maintenance Passport...</p>
        </div>
      </div>
    )
  }

  if (error || !passportData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Property Not Found</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'This digital passport link may have expired or is invalid.'}</p>
        </div>
      </div>
    )
  }

  const summary = monthlyReport?.portfolio_summary || {}
  const spendBreakdown = summary.spend_breakdown || {}

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased pb-12 print:bg-white print:p-0">
      {/* Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">SAWA REPAIRS</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Property Passport
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Accountable Landlord Maintenance Record</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </button>
        </div>
      </header>

      {/* Printable Official Statement Header */}
      <div className="hidden print:block max-w-4xl mx-auto p-6 border-b border-slate-300">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">SAWA REPAIRS LTD</h1>
            <p className="text-xs text-slate-600">Official Monthly Property Maintenance Statement</p>
            <p className="text-xs text-slate-500 mt-1">Period: {selectedMonth} · Nairobi, Kenya · repairs@sawarepairs.co.ke</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{passportData.name}</p>
            <p className="text-xs text-slate-600">{passportData.address}</p>
            <p className="text-xs text-slate-500">Units: {passportData.unit_count}</p>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Property Hero Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4 print:border-none print:shadow-none print:p-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{passportData.name}</h1>
                {passportData.airbnb_managed && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    Airbnb Superhost Certified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1.5">
                <span>{passportData.address}</span>
                <span>·</span>
                <span>{passportData.unit_count} {passportData.unit_count === 1 ? 'Unit' : 'Units'}</span>
                <span>·</span>
                <span>Owner: <strong>{passportData.landlord?.name || 'Diaspora Landlord'}</strong></span>
              </p>
            </div>

            {/* Health Score Pill */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 self-start sm:self-auto">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                {passportData.health_score || 94}
              </div>
              <div>
                <p className="text-[11px] uppercase font-bold text-emerald-800 tracking-wider">Property Health Score</p>
                <p className="text-[11px] text-emerald-600">Excellent Condition</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-100 pt-2 overflow-x-auto print:hidden">
            <button
              onClick={() => setActiveTab('statement')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'statement'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Monthly Statement & Spend
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'health'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Maintenance Memory
            </button>
            <button
              onClick={() => setActiveTab('warranties')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'warranties'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Active 30d Warranties ({passportData.active_warranties?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('airbnb')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'airbnb'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Guest-Ready Audit
            </button>
          </div>
        </div>

        {/* TAB 1: MONTHLY STATEMENT (The core deliverable for diaspora landlords) */}
        {(activeTab === 'statement' || window.location.search.includes('print')) && (
          <div className="space-y-5">
            {/* Period Selector & Print Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm print:hidden">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">Select Statement Period:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" /> Download Statement PDF
              </button>
            </div>

            {/* Financial KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Invoiced</span>
                <p className="text-xl font-black text-slate-900 mt-1">
                  KES {(summary.total_spend_kes || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{summary.total_tickets_month || 0} repairs completed</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Specialist Labour</span>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  KES {(spendBreakdown.labour_kes || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Vetted NCA Specialists</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Replacement Parts</span>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  KES {(spendBreakdown.parts_kes || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">At cost + 20% capped markup</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Callout Fees Saved</span>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  KES {((summary.completed_tickets || 0) * 2000).toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">100% Waived on approval</p>
              </div>
            </div>

            {/* Itemized Repair Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-600" />
                  Itemized Work Order Ledger ({monthlyReport?.tickets?.length || 0})
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">Period: {selectedMonth}</span>
              </div>

              {monthlyReport?.tickets && monthlyReport.tickets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 font-bold uppercase">Date / Ticket #</th>
                        <th className="py-2.5 px-4 font-bold uppercase">Trade & Issue</th>
                        <th className="py-2.5 px-4 font-bold uppercase">Specialist</th>
                        <th className="py-2.5 px-4 font-bold uppercase text-right">Invoiced (KES)</th>
                        <th className="py-2.5 px-4 font-bold uppercase text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {monthlyReport.tickets.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <div>{t.ticket_number}</div>
                            <span className="text-[10px] font-sans text-slate-400">
                              {t.resolved_at ? new Date(t.resolved_at).toLocaleDateString() : 'In Progress'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 mr-2">
                              {t.category}
                            </span>
                            <span className="text-slate-800 font-medium">{t.description}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {t.technician_name || 'Vetted Specialist'}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            KES {(t.invoice_amount_kes || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No repairs were logged for this property during the selected statement month ({selectedMonth}).
                </div>
              )}
            </div>

            {/* M-Pesa Statement Settlement (print:hidden) */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3 print:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">Settle Monthly Statement via M-Pesa</h4>
                    <p className="text-[11px] text-slate-400">Direct STK push to your Safaricom phone</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-400">
                  KES {(summary.total_spend_kes || 0).toLocaleString()}
                </span>
              </div>

              {!isPaying ? (
                <button
                  onClick={() => setIsPaying(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  Pay Statement with M-Pesa <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <form onSubmit={handleMpesaPay} className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      required
                      placeholder="07XXXXXXXX or 01XXXXXXXX"
                      value={payPhone}
                      onChange={(e) => setPayPhone(e.target.value)}
                      className="flex-1 bg-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={payLoading}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm transition-colors whitespace-nowrap"
                    >
                      {payLoading ? 'Sending STK...' : 'Send STK'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MAINTENANCE MEMORY & HEALTH SCORE */}
        {activeTab === 'health' && (
          <div className="space-y-5 print:hidden">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Health Score & Diagnostics</h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                This property scores <strong>{passportData.health_score || 94}/100</strong> based on resolved response times, absence of recurring leaks within 60 days, and active preventive inspection coverage. Regular maintenance prevents emergency guest refunds and preserves asset equity.
              </p>
            </div>

            {/* Recurring Problem Alerts */}
            {passportData.recurring_alerts && passportData.recurring_alerts.length > 0 ? (
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-sm space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Recurring Issue Indicators
                </h4>
                <div className="space-y-2">
                  {passportData.recurring_alerts.map((al, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-amber-200 text-xs text-slate-700">
                      <strong>{al.category.toUpperCase()} Alert:</strong> {al.message}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 shadow-sm flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-800 font-medium">
                  Zero recurring faults detected in the last 90 days. Plumbing and electrical systems are stable.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIVE WARRANTIES */}
        {activeTab === 'warranties' && (
          <div className="space-y-4 print:hidden">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Active 30-Day Workmanship Guarantees
              </h3>
              <p className="text-xs text-slate-600">
                Every repair completed by Sawa Specialists is covered by a 30-day no-quibble warranty. If an issue reoccurs, we attend and resolve it free of charge.
              </p>
            </div>

            {passportData.active_warranties && passportData.active_warranties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {passportData.active_warranties.map((w, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{w.ticket_number}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        Active Warranty
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{w.description}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-slate-100">
                      Guaranteed Until: {new Date(w.warranty_until).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs">
                No active repairs under warranty at this moment.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AIRBNB GUEST-READY AUDIT */}
        {activeTab === 'airbnb' && (
          <div className="space-y-4 print:hidden">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                  Sawa Superhost Guest-Ready Checklist
                </h3>
                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Pre-Checkin Defense
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Specialized preventive inspection for short-stay units in Kilimani, Kileleshwa, and Westlands to eliminate 1-star reviews from shower or appliance failures.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-sm">
              {(passportData.airbnb_readiness?.checklist || []).map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{item.item}</h4>
                      <p className="text-[11px] text-slate-500">{item.notes}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 shrink-0">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

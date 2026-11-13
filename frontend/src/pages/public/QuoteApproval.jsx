// frontend/src/pages/public/QuoteApproval.jsx
// Sawa Repairs Public Landlord Quote Approval Portal
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Wrench,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  Phone,
  Camera,
  Check,
  Sparkles,
  CreditCard,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function QuoteApproval() {
  const { token } = useParams()
  const [quote, setQuote] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [decision, setDecision] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  // M-Pesa State
  const [isPaying, setIsPaying] = useState(false)
  const [payPhone, setPayPhone] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    fetchQuote()
  }, [token])

  const fetchQuote = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:5000/api/public/tickets/approve/${token}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setQuote(data.data)
        if (data.data.approved_at) {
          setDecision('approved')
        }
      } else {
        setError(data.message || 'Approval link not found or expired.')
      }
    } catch (err) {
      setError('Network connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecision = async (action, notes = '') => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`http://localhost:5000/api/public/tickets/approve/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDecision(action)
        toast.success(data.message || `Quote ${action}d successfully`)
        fetchQuote()
      } else {
        toast.error(data.message || 'Action could not be recorded')
      }
    } catch (err) {
      toast.error('Failed to submit decision. Please check connection.')
    } finally {
      setIsSubmitting(false)
      setShowRejectModal(false)
    }
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
        body: JSON.stringify({ phoneNumber: payPhone })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`M-Pesa payment received! Receipt: ${data.receiptNumber}`)
        setIsPaying(false)
        fetchQuote()
      } else {
        toast.error(data.message || 'Payment initiation failed')
      }
    } catch (err) {
      toast.error('Payment request failed. Please try again.')
    } finally {
      setPayLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium text-sm">Loading quote details...</p>
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Quote Not Found</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'This approval quote may have expired or is invalid.'}</p>
        </div>
      </div>
    )
  }

  const estimate = quote.estimate || {}
  const totalQuote = estimate.total_quote_kes || 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased pb-12">
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-sm">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-white text-base">SAWA REPAIRS</span>
              <p className="text-[11px] text-slate-400">Landlord Quote Approval</p>
            </div>
          </div>
          <a href="tel:+254711223344" className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Support
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Quote Header */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repair Quote</span>
              <h1 className="text-2xl font-black text-slate-900 font-mono">{quote.ticket_number}</h1>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              {quote.category}
            </span>
          </div>
          <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Property: <strong className="text-slate-800">{quote.property_name || 'Your Property'}</strong></span>
            <span>Priority: <strong className="capitalize text-slate-800">{quote.priority}</strong></span>
          </div>
        </div>

        {/* Issue Description */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Technician Diagnosis & Scope</h3>
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            {quote.description}
          </p>
          {quote.technician_notes && (
            <p className="text-xs text-slate-500 italic mt-1">Specialist notes: {quote.technician_notes}</p>
          )}

          {/* Attached Photos */}
          {quote.photos && quote.photos.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Photos from Site ({quote.photos.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {quote.photos.map((p, idx) => (
                  <a key={idx} href={p.file_path} target="_blank" rel="noopener noreferrer" className="rounded-xl overflow-hidden aspect-video border border-slate-200 bg-slate-100 block">
                    <img src={p.file_path} alt="Site" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Itemized Cost Breakdown (Transparent Pricing Policy) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Itemized Quotation
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Parts at Cost + 20% Capped Policy
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Diagnostic Call-Out Fee</span>
              <div className="text-right">
                <span className="line-through text-slate-400 mr-2">KES 2,000</span>
                <span className="font-bold text-emerald-600">WAIVED on Approval</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Certified Specialist Labour</span>
              <span className="font-semibold text-slate-800">KES {(estimate.labour_billed_kes || 0).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Replacement Parts (Original receipts attached)</span>
              <span className="font-semibold text-slate-800">KES {(estimate.parts_billed_kes || 0).toLocaleString()}</span>
            </div>

            {estimate.emergency_premium_kes > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span>Emergency Fast-Track Premium</span>
                <span className="font-semibold text-slate-800">KES {estimate.emergency_premium_kes.toLocaleString()}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-900">Total Investment Required</span>
              <span className="font-black text-xl text-emerald-600">KES {totalQuote.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Decision Banner / Action Buttons */}
        {decision === 'approved' || quote.approved_at ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Quote Approved!</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Diagnostic call-out fee has been waived. The assigned specialist has been authorized to proceed with repairs immediately.
            </p>
          </div>
        ) : decision === 'rejected' ? (
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 text-center space-y-1">
            <h3 className="font-bold text-slate-900 text-sm">Quote Declined</h3>
            <p className="text-xs text-slate-500">You declined this quote. Our operations coordinator will contact you shortly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleDecision('approve')}
              disabled={isSubmitting}
              className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve Repair
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isSubmitting}
              className="py-3.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4 text-slate-400" /> Decline
            </button>
          </div>
        )}

        {/* 30-Day Workmanship Guarantee */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-3 text-xs text-slate-600">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Includes Sawa's 30-day workmanship guarantee. All parts backed by manufacturer warranty.</span>
        </div>

        {/* M-Pesa 1-Click Pay Option */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Direct M-Pesa Settlement</h4>
            </div>
            <span className="text-xs font-black text-emerald-400">KES {totalQuote.toLocaleString()}</span>
          </div>

          {!isPaying ? (
            <button
              onClick={() => setIsPaying(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              Settle with M-Pesa STK <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <form onSubmit={handleMpesaPay} className="space-y-2.5 pt-2 border-t border-slate-800">
              <input
                type="tel"
                required
                placeholder="07XXXXXXXX or 01XXXXXXXX"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                className="w-full bg-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={payLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm transition-colors"
              >
                {payLoading ? 'Sending STK Push...' : 'Send M-Pesa STK Push'}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Reason for Declining (Optional)</h3>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Seeking alternative quote, or postponing repair..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleDecision('reject', rejectReason)}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Confirm Decline
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

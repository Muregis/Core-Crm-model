// frontend/src/pages/public/TicketTracker.jsx
// Sawa Repairs Public Live Ticket Tracker & Tenant Experience Portal
import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  CreditCard,
  Camera,
  Check,
  ChevronRight,
  ExternalLink,
  Sparkles,
  User,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STEPS = [
  { key: 'reported', label: 'Reported', desc: 'Received & Queued' },
  { key: 'triaged', label: 'Triaged', desc: 'Specialist Assigned' },
  { key: 'scheduled', label: 'Scheduled', desc: 'Dispatched to Site' },
  { key: 'in_progress', label: 'On Site', desc: 'Repair Underway' },
  { key: 'resolved', label: 'Completed', desc: 'Work Done' },
  { key: 'verified', label: 'Verified', desc: 'Signed Off' }
]

const STATUS_ORDER = ['reported', 'triaged', 'scheduled', 'in_progress', 'awaiting_parts', 'resolved', 'verified', 'closed']

export default function TicketTracker() {
  const { token } = useParams()
  const [ticket, setTicket] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Payment State
  const [isPaying, setIsPaying] = useState(false)
  const [payPhone, setPayPhone] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  // Sign-off State
  const [signerName, setSignerName] = useState('')
  const [signoffComments, setSignoffComments] = useState('')
  const [signoffLoading, setSignoffLoading] = useState(false)
  const [signoffDone, setSignoffDone] = useState(false)

  useEffect(() => {
    fetchTicket()
  }, [token])

  const fetchTicket = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:5000/api/public/tickets/track/${token}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setTicket(data.data)
      } else {
        setError(data.message || 'Ticket tracking link not found or expired.')
      }
    } catch (err) {
      setError('Network connection error. Please check your internet connection.')
    } finally {
      setIsLoading(false)
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
        fetchTicket()
      } else {
        toast.error(data.message || 'Payment initiation failed')
      }
    } catch (err) {
      toast.error('Payment request failed. Please try again.')
    } finally {
      setPayLoading(false)
    }
  }

  const handleSignoff = async (e) => {
    e.preventDefault()
    if (!signerName.trim()) {
      toast.error('Please enter your name for completion sign-off')
      return
    }
    setSignoffLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/api/public/tickets/signoff/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerName, comments: signoffComments })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Thank you! Your completion sign-off has been recorded.')
        setSignoffDone(true)
        fetchTicket()
      } else {
        toast.error(data.message || 'Sign-off failed')
      }
    } catch (err) {
      toast.error('Sign-off request failed. Please try again.')
    } finally {
      setSignoffLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium text-sm">Loading live repair status...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Ticket Not Found</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'This live tracking link may have expired or is invalid.'}</p>
          <a
            href="tel:+254700000000"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm transition-colors"
          >
            <Phone className="w-4 h-4" /> Call Sawa Support
          </a>
        </div>
      </div>
    )
  }

  const currentIdx = STATUS_ORDER.indexOf(ticket.status)
  const isEmergency = ticket.priority === 'emergency'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased pb-12">
      {/* High-Trust Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-sm">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">SAWA REPAIRS</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Tracker
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Accountable Property Maintenance</p>
            </div>
          </div>
          <a
            href="tel:+254711223344"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            <Phone className="w-3.5 h-3.5" /> Support
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Ticket Header Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Number</span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-mono">{ticket.ticket_number}</h1>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isEmergency ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse' : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {ticket.priority} Priority
              </span>
              <span className="text-xs font-medium text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded">
                Trade: {ticket.category}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-slate-800">{ticket.property_name || 'Registered Property'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Target: {isEmergency ? '2–6h Emergency Target' : '24–48h Standard'}</span>
            </div>
          </div>
        </div>

        {/* Live Progress Stepper */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Live Status & Progression
          </h2>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {STATUS_STEPS.map((step, idx) => {
              const stepIdx = STATUS_ORDER.indexOf(step.key)
              const isPast = currentIdx > stepIdx
              const isCurrent = currentIdx === stepIdx
              const isFuture = currentIdx < stepIdx

              return (
                <div key={step.key} className="relative flex items-start gap-3">
                  <div className={`absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isPast
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-emerald-500 text-white ring-4 ring-emerald-100 animate-pulse'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}>
                    {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-tight ${isCurrent ? 'text-emerald-700' : isPast ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Assigned Technician Card */}
        {ticket.technician_name ? (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl p-5 border border-emerald-200/70 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {ticket.technician_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-slate-900 text-sm">{ticket.technician_name}</h3>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" title="Vetted EPRA/NCA Certified Specialist" />
                  </div>
                  <p className="text-xs text-slate-600">Assigned Certified Specialist</p>
                  {ticket.scheduled_at && (
                    <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      Scheduled: {new Date(ticket.scheduled_at).toLocaleDateString()} at {new Date(ticket.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              {ticket.technician_phone && (
                <a
                  href={`tel:${ticket.technician_phone}`}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-transform active:scale-95"
                  title="Call technician"
                >
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/70 flex items-center gap-3 text-amber-800 text-xs">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Our ops team is matching the nearest vetted certified specialist to your location.</span>
          </div>
        )}

        {/* Description & Scope of Work */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reported Issue</h3>
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100 font-sans">
            {ticket.description}
          </p>

          {/* Photo Proof Gallery */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-400" />
                Attached Photos ({ticket.attachments.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ticket.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group rounded-xl overflow-hidden aspect-video border border-slate-200 bg-slate-100 block"
                  >
                    <img
                      src={att.file_path}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                      View Full Size
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 30-Day Workmanship Guarantee Badge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">30-Day Workmanship Guarantee</h4>
            <p className="text-xs text-slate-600 mt-0.5">
              All fixes carry Sawa's 30-day warranty. If this issue re-occurs, we re-attend and fix it free of charge.
            </p>
          </div>
        </div>

        {/* Client Completion Sign-Off (When resolved) */}
        {['resolved', 'verified', 'closed'].includes(ticket.status) && (
          <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm">Customer Completion Sign-Off</h3>
            </div>
            {ticket.status === 'verified' || ticket.status === 'closed' || signoffDone ? (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium border border-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Work has been confirmed and signed off. Thank you for choosing Sawa Repairs!</span>
              </div>
            ) : (
              <form onSubmit={handleSignoff} className="space-y-3">
                <p className="text-xs text-slate-600">
                  Please confirm that the technician completed the repair satisfactorily.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="e.g. Wanjiku Kimani"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Feedback / Notes (Optional)</label>
                  <input
                    type="text"
                    value={signoffComments}
                    onChange={(e) => setSignoffComments(e.target.value)}
                    placeholder="e.g. Clean work, quick turnaround"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={signoffLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {signoffLoading ? 'Recording Sign-off...' : 'Confirm Fix & Sign Off'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* M-Pesa 1-Click Payment Drawer */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">M-Pesa Express Checkout</h4>
                <p className="text-[11px] text-slate-400">Direct STK push to your Safaricom phone</p>
              </div>
            </div>
            <span className="text-sm font-black text-emerald-400">
              KES {(Number(ticket.invoice_amount_kes || ticket.total_cost_kes || ticket.callout_fee_kes || 2000)).toLocaleString()}
            </span>
          </div>

          {!isPaying ? (
            <button
              onClick={() => setIsPaying(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              Pay via M-Pesa <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <form onSubmit={handleMpesaPay} className="space-y-2.5 pt-2 border-t border-slate-800">
              <label className="block text-[11px] font-medium text-slate-300">
                Enter your Safaricom M-Pesa number
              </label>
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
                  {payLoading ? 'Sending...' : 'Send STK'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                You will receive a prompt on your phone to enter your M-Pesa PIN.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

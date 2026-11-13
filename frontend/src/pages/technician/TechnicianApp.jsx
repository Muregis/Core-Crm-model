// frontend/src/pages/technician/TechnicianApp.jsx
// Ultra-simple mobile-first interface designed for plumbers & electricians in the field
import React, { useEffect, useState } from 'react'
import {
  Wrench,
  Phone,
  Navigation,
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  ChevronRight,
  ArrowLeft,
  Upload,
  Check,
  ShieldCheck,
  User,
  LogOut
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

export default function TechnicianApp() {
  const { user, token, logout } = useAuthStore()
  const [tickets, setTickets] = useState([])
  const [activeTicket, setActiveTicket] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('assigned') // 'assigned', 'in_progress', 'completed'

  // Cost entry form state
  const [labourHours, setLabourHours] = useState('1.5')
  const [partsCost, setPartsCost] = useState('0')
  const [travelCost, setTravelCost] = useState('500')
  const [labourBilled, setLabourBilled] = useState('2500')
  const [techNotes, setTechNotes] = useState('')
  const [customerSigner, setCustomerSigner] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchMyTickets()
  }, [])

  const fetchMyTickets = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('http://localhost:5000/api/tickets?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // If technician, filter to tickets assigned to this technician or open jobs
        const myJobs = (data.data.tickets || []).filter(
          (t) => !user?.id || t.assigned_technician_id === user.id || user.role === 'admin' || user.role === 'manager'
        )
        setTickets(myJobs.length > 0 ? myJobs : data.data.tickets || [])
      }
    } catch (err) {
      toast.error('Failed to load assigned jobs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (ticketId, nextStatus) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus, note: `Status updated to ${nextStatus} via Technician App` })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Job updated to: ${nextStatus.toUpperCase()}`)
        fetchMyTickets()
        if (activeTicket?.id === ticketId) {
          setActiveTicket({ ...activeTicket, status: nextStatus })
        }
      } else {
        toast.error(data.message || 'Status transition failed')
      }
    } catch (err) {
      toast.error('Network error updating status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteJob = async (e) => {
    e.preventDefault()
    if (!activeTicket) return

    setIsSubmitting(true)
    try {
      // 1. Record Unit Economics costs
      const costRes = await fetch(`http://localhost:5000/api/tickets/${activeTicket.id}/costs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          labour_hours: parseFloat(labourHours) || 1,
          labour_cost_kes: 1200,
          labour_billed_kes: parseFloat(labourBilled) || 2500,
          parts_cost_kes: parseFloat(partsCost) || 0,
          travel_cost_kes: parseFloat(travelCost) || 500,
          notes: techNotes
        })
      })

      if (!costRes.ok) {
        const costData = await costRes.json()
        throw new Error(costData.message || 'Failed to record repair costs')
      }

      // 2. Mark resolved
      const statusRes = await fetch(`http://localhost:5000/api/tickets/${activeTicket.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'resolved',
          note: `Repair completed. Sign-off by: ${customerSigner || 'Customer on site'}`
        })
      })

      const statusData = await statusRes.json()
      if (statusRes.ok && statusData.success) {
        toast.success('Job completed & unit economics logged!')
        setActiveTicket(null)
        fetchMyTickets()
      } else {
        toast.error(statusData.message || 'Failed to resolve ticket')
      }
    } catch (err) {
      toast.error(err.message || 'Error completing job')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'assigned') return ['reported', 'triaged', 'scheduled'].includes(t.status)
    if (filter === 'in_progress') return ['in_progress', 'awaiting_parts'].includes(t.status)
    if (filter === 'completed') return ['resolved', 'verified', 'closed'].includes(t.status)
    return true
  })

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-12 font-sans antialiased">
      {/* Mobile Top Navigation */}
      <header className="bg-slate-950 px-4 py-3 border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-black text-sm tracking-tight text-white">SAWA FIELD TECH</span>
            <p className="text-[10px] text-emerald-400 font-bold uppercase">{user?.first_name || 'Specialist'} · Fundi Mode</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="p-2 text-slate-400 hover:text-white rounded-lg"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* If Active Ticket Selected (Job Execution View) */}
        {activeTicket ? (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTicket(null)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white py-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back to My Jobs
            </button>

            {/* Active Ticket Hero */}
            <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Job Ticket</span>
                  <h2 className="text-xl font-black font-mono text-emerald-400">{activeTicket.ticket_number}</h2>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                  activeTicket.priority === 'emergency' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {activeTicket.priority}
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <p><strong>Property:</strong> {activeTicket.property_name || 'Nairobi Property'}</p>
                <p><strong>Trade:</strong> <span className="capitalize">{activeTicket.category}</span></p>
                <p><strong>Current Status:</strong> <span className="font-bold text-emerald-400 uppercase">{activeTicket.status}</span></p>
              </div>

              {/* Big Action Buttons: Call & Navigate */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <a
                  href={`tel:${activeTicket.reported_by?.match(/\+?\d+/)?.[0] || '0700000000'}`}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
                >
                  <Phone className="w-4 h-4" /> Call Client
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeTicket.property_name || activeTicket.property_address || 'Kilimani Nairobi')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
                >
                  <Navigation className="w-4 h-4" /> Open Maps
                </a>
              </div>
            </div>

            {/* Problem Description */}
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reported Issue</h3>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {activeTicket.description}
              </p>
            </div>

            {/* Fast 1-Tap Status Controls */}
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fast Status Update</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStatusChange(activeTicket.id, 'in_progress')}
                  disabled={isSubmitting || activeTicket.status === 'in_progress'}
                  className="py-3 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs"
                >
                  I've Arrived on Site
                </button>
                <button
                  onClick={() => handleStatusChange(activeTicket.id, 'awaiting_parts')}
                  disabled={isSubmitting}
                  className="py-3 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs"
                >
                  Awaiting Parts
                </button>
              </div>
            </div>

            {/* Work Completed & Unit Economics Entry (Mandatory Gate) */}
            <form onSubmit={handleCompleteJob} className="bg-slate-800 rounded-2xl p-5 border border-emerald-500/50 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Complete Job & Enter Costs</h3>
                  <p className="text-[10px] text-slate-400">Enforces accurate Sawa margin & warranty registration</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Labour Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={labourHours}
                    onChange={(e) => setLabourHours(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Labour Billed (KES)</label>
                  <input
                    type="number"
                    required
                    value={labourBilled}
                    onChange={(e) => setLabourBilled(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Parts Cost (KES)</label>
                  <input
                    type="number"
                    value={partsCost}
                    onChange={(e) => setPartsCost(e.target.value)}
                    placeholder="0 if none"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Travel / Fuel (KES)</label>
                  <input
                    type="number"
                    required
                    value={travelCost}
                    onChange={(e) => setTravelCost(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold text-xs mb-1">Customer Sign-off Name</label>
                <input
                  type="text"
                  required
                  value={customerSigner}
                  onChange={(e) => setCustomerSigner(e.target.value)}
                  placeholder="Name of tenant or landlord present"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Saving Job...' : 'Confirm Work Finished & Log Costs'}
              </button>
            </form>
          </div>
        ) : (
          /* Jobs List View */
          <div className="space-y-4">
            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold text-center">
              <button
                onClick={() => setFilter('assigned')}
                className={`py-2 rounded-lg transition-colors ${filter === 'assigned' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
              >
                Assigned
              </button>
              <button
                onClick={() => setFilter('in_progress')}
                className={`py-2 rounded-lg transition-colors ${filter === 'in_progress' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`py-2 rounded-lg transition-colors ${filter === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
              >
                Completed
              </button>
            </div>

            {/* Ticket Cards */}
            {isLoading ? (
              <div className="text-center py-12 text-slate-500 text-xs">Loading my assigned jobs...</div>
            ) : filteredTickets.length > 0 ? (
              <div className="space-y-3">
                {filteredTickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setActiveTicket(t)}
                    className="bg-slate-800 hover:bg-slate-750 p-4 rounded-2xl border border-slate-700 cursor-pointer shadow-sm transition-all active:scale-[0.98] space-y-2.5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-sm font-black text-emerald-400">{t.ticket_number}</span>
                        <h4 className="text-xs font-bold text-white capitalize mt-0.5">{t.category} Repair</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.priority === 'emergency' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {t.priority}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2">{t.description}</p>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                      <span>{t.property_name || 'Nairobi Area'}</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        Open Job <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800/60 rounded-2xl p-8 border border-slate-800 text-center text-slate-400 text-xs">
                No jobs found under "{filter}".
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

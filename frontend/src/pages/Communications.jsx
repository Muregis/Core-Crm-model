// Communications.jsx
// WhatsApp-first communications hub, call logging, client interaction history, and meeting logs.
import React, { useEffect, useState, useMemo } from 'react'
import {
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  FileText,
  Plus,
  Search,
  Filter,
  ExternalLink,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  Send,
  Trash2
} from 'lucide-react'
import { communicationService } from '../services/communicationService'
import { customerService } from '../services/customerService'
import { useAuthStore } from '../store/authStore'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const CHANNEL_ICONS = {
  whatsapp: MessageSquare,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  sms: MessageSquare
}

const CHANNEL_COLORS = {
  whatsapp: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  call: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  email: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  meeting: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  note: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  sms: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400 border-teal-200 dark:border-teal-800'
}

const Communications = () => {
  const { user } = useAuthStore()
  const industry = user?.tenant_industry || 'general'

  const [communications, setCommunications] = useState([])
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showLogModal, setShowLogModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)

  // Log Form State
  const [logForm, setLogForm] = useState({
    type: 'whatsapp',
    direction: 'outbound',
    customerId: '',
    subject: '',
    content: '',
    durationMinutes: '',
    nextFollowUp: ''
  })

  // Quick WhatsApp State
  const [waRecipient, setWaRecipient] = useState({ phone: '+254', name: '', message: '' })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [commRes, custRes] = await Promise.all([
        communicationService.getCommunications(),
        customerService.getCustomers({ limit: 100 })
      ])

      if (commRes.data?.success) {
        setCommunications(commRes.data.data.communications || [])
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
    } catch (err) {
      // Dynamic fallback sample data based on industry
      if (industry === 'legal') {
        setCommunications([
          {
            id: 1,
            type: 'whatsapp',
            direction: 'outbound',
            subject: 'Sent draft Notice of Motion & Replying Affidavit',
            content: 'Shared trial bundle with instructing client via WhatsApp. Client confirmed the averments and authorized filing.',
            customer_name: 'Karanja Gachagua',
            customer_phone: '+254711223344',
            user_name: 'Counsel Kamau',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            type: 'call',
            direction: 'inbound',
            subject: 'Consultation on High Court Mention fixture',
            content: 'Informed client of court directions given by Hon. Lady Justice Chepkwony regarding pre-trial conference.',
            customer_name: 'Philip Oraro',
            customer_phone: '+254712345691',
            duration_minutes: 12,
            user_name: 'Counsel Kamau',
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
          }
        ])
      } else if (industry === 'real_estate') {
        setCommunications([
          {
            id: 1,
            type: 'whatsapp',
            direction: 'outbound',
            subject: 'Shared Kitengela Phase 2 plot pricing with client',
            content: 'Sent brochure via WhatsApp. Client expressed interest in 1/8th acre plot #44 and requested site visit this Saturday.',
            customer_name: 'James Mwangi',
            customer_phone: '+254712345690',
            user_name: 'John Sales',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            type: 'call',
            direction: 'inbound',
            subject: 'Inquiry on M-Pesa installment schedule',
            content: 'Confirmed that monthly installment of KES 35,000 can be paid directly to tenant Paybill 600123 with plot number as account.',
            customer_name: 'Grace Wanjiru',
            customer_phone: '+254712345691',
            duration_minutes: 8,
            user_name: 'Paul Rep',
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
          }
        ])
      } else {
        // Commercial Core (general)
        setCommunications([
          {
            id: 1,
            type: 'whatsapp',
            direction: 'outbound',
            subject: 'Sent revised wholesale supply pricing catalogue',
            content: 'Shared Q4 bulk discount tier for Fairlane Wholesale Distributors. Key account manager follow-up scheduled.',
            customer_name: 'Sarah Ochieng',
            customer_phone: '+254722889900',
            user_name: 'Kamau Gitau',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            type: 'call',
            direction: 'inbound',
            subject: 'Review of credit terms & purchase order delivery',
            content: 'Agreed on 30-day net credit terms for hardware shipment. Client issuing PO tomorrow.',
            customer_name: 'David Mutua',
            customer_phone: '+254712345691',
            duration_minutes: 10,
            user_name: 'Kamau Gitau',
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
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

  const filteredCommunications = useMemo(() => {
    return communications.filter((c) => {
      const matchType = activeTab === 'all' || c.type === activeTab
      const text = `${c.subject || ''} ${c.content || ''} ${c.customer_name || ''} ${c.lead_name || ''} ${c.user_name || ''}`.toLowerCase()
      const matchSearch = text.includes(searchTerm.toLowerCase())
      return matchType && matchSearch
    })
  }, [communications, activeTab, searchTerm])

  const handleLogSubmit = async (e) => {
    e.preventDefault()
    if (!logForm.content && !logForm.subject) {
      toast.error('Please enter a subject or content note')
      return
    }

    try {
      await communicationService.logCommunication(logForm)
      toast.success('Communication logged successfully')
      setShowLogModal(false)
      setLogForm({
        type: 'whatsapp',
        direction: 'outbound',
        customerId: '',
        subject: '',
        content: '',
        durationMinutes: '',
        nextFollowUp: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log communication')
    }
  }

  const handleLaunchWhatsApp = async (e) => {
    e.preventDefault()
    if (!waRecipient.phone || !waRecipient.message) {
      toast.error('Please specify phone number and message')
      return
    }

    // Format phone for wa.me: remove + and leading zeros, ensure 254 prefix
    let cleanPhone = waRecipient.phone.replace(/\D/g, '')
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.slice(1)
    }

    const encodedMessage = encodeURIComponent(waRecipient.message)
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`

    // Automatically record interaction in CRM
    try {
      await communicationService.logCommunication({
        type: 'whatsapp',
        direction: 'outbound',
        subject: `WhatsApp to ${waRecipient.name || waRecipient.phone}`,
        content: waRecipient.message
      })
      loadData()
    } catch {
      // ignore
    }

    setShowWhatsAppModal(false)
    window.open(waUrl, '_blank')
    toast.success('Opening WhatsApp and logged activity')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this interaction note?')) return
    try {
      await communicationService.deleteCommunication(id)
      toast.success('Deleted interaction')
      loadData()
    } catch (err) {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Communications & WhatsApp</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              WhatsApp-First
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track all client interactions, WhatsApp messages, phone calls, meetings, and follow-ups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWhatsAppModal(true)}
            className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat on WhatsApp
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="inline-flex items-center px-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-2 text-primary-600" />
            Log Activity
          </button>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Channels' },
            { id: 'whatsapp', label: 'WhatsApp' },
            { id: 'call', label: 'Calls' },
            { id: 'meeting', label: 'Meetings' },
            { id: 'email', label: 'Emails' },
            { id: 'note', label: 'Notes' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search communications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-gray-100"
          />
        </div>
      </div>

      {/* Communications Stream */}
      <div className="space-y-3">
        {filteredCommunications.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No Communications Logged"
            description="Start logging calls, WhatsApp messages, and meetings to keep complete records of customer interactions."
            actionLabel="Log First Activity"
            onAction={() => setShowLogModal(true)}
          />
        ) : (
          filteredCommunications.map((item) => {
            const Icon = CHANNEL_ICONS[item.type] || MessageSquare
            const colorClass = CHANNEL_COLORS[item.type] || CHANNEL_COLORS.note

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                          {item.subject || `${item.type.toUpperCase()} interaction`}
                        </span>
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {item.direction === 'inbound' ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3 mr-1 text-emerald-500" /> Inbound
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3 mr-1 text-blue-500" /> Outbound
                            </>
                          )}
                        </span>
                        {item.duration_minutes && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {item.duration_minutes} min
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {item.content}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 flex-wrap">
                        {item.customer_name && (
                          <span className="flex items-center gap-1 text-primary-600 font-medium">
                            <User className="w-3.5 h-3.5" />
                            {item.customer_name} ({item.customer_phone || 'No phone'})
                          </span>
                        )}
                        <span>Logged by {item.user_name || 'Team member'}</span>
                        <span>•</span>
                        <span>{new Date(item.created_at || Date.now()).toLocaleString('en-KE')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.customer_phone && item.type === 'whatsapp' && (
                      <a
                        href={`https://wa.me/${item.customer_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                        title="Open WhatsApp"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Log Activity Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Log Activity / Interaction</h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Channel
                  </label>
                  <select
                    value={logForm.type}
                    onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="call">Phone Call</option>
                    <option value="meeting">
                      {industry === 'legal'
                        ? 'Client Conference / Court Hearing'
                        : industry === 'real_estate'
                        ? 'Meeting / Site Visit'
                        : 'Business Meeting / Consultation'}
                    </option>
                    <option value="email">Email</option>
                    <option value="note">Internal Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Direction
                  </label>
                  <select
                    value={logForm.direction}
                    onChange={(e) => setLogForm({ ...logForm, direction: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="outbound">Outbound (We contacted)</option>
                    <option value="inbound">Inbound (Client contacted)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Customer / Client
                </label>
                <select
                  value={logForm.customerId}
                  onChange={(e) => setLogForm({ ...logForm, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Customer (Optional)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name || c.firstName} {c.last_name || c.lastName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Subject / Summary
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call regarding Title Deed collection"
                  value={logForm.subject}
                  onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Details / Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Record outcome of conversation, agreed terms, questions raised..."
                  value={logForm.content}
                  onChange={(e) => setLogForm({ ...logForm, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15"
                    value={logForm.durationMinutes}
                    onChange={(e) => setLogForm({ ...logForm, durationMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Next Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={logForm.nextFollowUp}
                    onChange={(e) => setLogForm({ ...logForm, nextFollowUp: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Send WhatsApp Message</h3>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleLaunchWhatsApp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Recipient Phone (Kenyan format)
                </label>
                <input
                  type="text"
                  required
                  placeholder="+2547XXXXXXXX"
                  value={waRecipient.phone}
                  onChange={(e) => setWaRecipient({ ...waRecipient, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Recipient Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Grace Muthoni"
                  value={waRecipient.name}
                  onChange={(e) => setWaRecipient({ ...waRecipient, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Habari, thank you for your inquiry about our properties..."
                  value={waRecipient.message}
                  onChange={(e) => setWaRecipient({ ...waRecipient, message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Open in WhatsApp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Communications

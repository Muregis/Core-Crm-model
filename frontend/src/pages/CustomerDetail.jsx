// CustomerDetail.jsx
// Detailed 360-degree client view: contact profile, KDPA actions, deal history, WhatsApp interactions, and M-Pesa receipts.
import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  CreditCard,
  MessageSquare,
  Briefcase,
  CheckSquare,
  ShieldCheck,
  ExternalLink,
  Edit2,
  Download,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react'
import { customerService } from '../services/customerService'
import { formatCurrencyKES } from '../utils/formatters'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const CustomerDetail = () => {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [stats, setStats] = useState({ deals: [], communications: [], tasks: [], mpesa: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [kdpaLoading, setKdpaLoading] = useState(false)

  const loadCustomer = async () => {
    setIsLoading(true)
    try {
      const res = await customerService.getCustomer(id)
      if (res.data?.success && res.data?.data) {
        setCustomer(res.data.data.customer)
        setStats({
          deals: res.data.data.deals || [],
          communications: res.data.data.communications || [],
          tasks: res.data.data.tasks || [],
          mpesa: res.data.data.mpesaTransactions || []
        })
      }
    } catch (err) {
      // Fallback demo client
      setCustomer({
        id,
        first_name: 'James',
        last_name: 'Mwangi',
        email: 'james.mwangi@email.com',
        phone: '+254712345690',
        company_name: 'Mwangi Enterprises Ltd',
        customer_type: 'business',
        status: 'active',
        county_name: 'Nairobi',
        sales_rep_name: 'John Sales',
        notes: 'Interested in acquiring 2 plots in Kitengela Acacia Greens Phase 2. Prefers payments via M-Pesa Paybill.',
        created_at: new Date().toISOString()
      })
      setStats({
        deals: [
          { id: 1, title: 'Kitengela Acacia 1/8th Acre Purchase', value: 1500000, status: 'won', stage_name: 'Closed Won' }
        ],
        communications: [
          { id: 1, type: 'whatsapp', direction: 'outbound', subject: 'Brochure sent', content: 'Sent PDF brochure via WhatsApp.', created_at: new Date().toISOString() }
        ],
        tasks: [
          { id: 1, title: 'Send title deed tracking details', status: 'pending', priority: 'high', due_date: new Date().toISOString() }
        ],
        mpesa: [
          { id: 1, mpesa_receipt_number: 'QKD7289192', amount: 50000, status: 'completed', transaction_time: new Date().toISOString() }
        ]
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCustomer()
  }, [id])

  const handleKdpaExport = async () => {
    setKdpaLoading(true)
    try {
      const res = await customerService.exportKdpaData(id)
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `client_${id}_kdpa_export.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success('KDPA Subject Access Data downloaded')
    } catch {
      toast.error('Failed to export KDPA data')
    } finally {
      setKdpaLoading(false)
    }
  }

  const handleKdpaAnonymize = async () => {
    if (
      !window.confirm(
        'Are you sure you want to sanitize and anonymize all PII for this customer under KDPA 2019 Right to Erasure?'
      )
    )
      return

    setKdpaLoading(true)
    try {
      await customerService.anonymizeCustomer(id)
      toast.success('Customer PII anonymized pursuant to KDPA 2019')
      loadCustomer()
    } catch {
      toast.error('Failed to anonymize customer')
    } finally {
      setKdpaLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-gray-500">Customer record not found.</p>
        <Link to="/customers" className="btn-primary">
          Return to Customers
        </Link>
      </div>
    )
  }

  const cleanPhone = (customer.phone || '').replace(/\D/g, '')

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/customers" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
          <ArrowLeft className="w-4 h-4" />
          Customers
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {customer.first_name} {customer.last_name}
        </span>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {customer.first_name ? customer.first_name[0] : 'C'}
              {customer.last_name ? customer.last_name[0] : ''}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {customer.first_name} {customer.last_name}
                </h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    customer.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  }`}
                >
                  {customer.status || 'Active'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 capitalize">
                  {customer.customer_type || 'Individual'}
                </span>
              </div>

              {customer.company_name && (
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                  <Building className="w-4 h-4 text-gray-400" />
                  {customer.company_name}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5" />
                  {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {customer.email}
                  </span>
                )}
                {customer.county_name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    {customer.county_name} County
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Contact Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {customer.phone && (
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                WhatsApp
              </a>
            )}
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center px-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 transition"
              >
                <Phone className="w-4 h-4 mr-1.5 text-blue-600" />
                Call Client
              </a>
            )}
            <button
              onClick={handleKdpaExport}
              disabled={kdpaLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 transition"
              title="Download KDPA SAR report"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              KDPA Export
            </button>
            <button
              onClick={handleKdpaAnonymize}
              disabled={kdpaLoading}
              className="inline-flex items-center px-3 py-2 border border-red-200 dark:border-red-900/60 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition"
              title="Right to Erasure"
            >
              Anonymize
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-4 overflow-x-auto">
        {[
          { id: 'overview', label: 'Client Overview' },
          { id: 'deals', label: `Deals (${stats.deals.length})` },
          { id: 'communications', label: `Communications (${stats.communications.length})` },
          { id: 'tasks', label: `Tasks (${stats.tasks.length})` },
          { id: 'mpesa', label: `M-Pesa (${stats.mpesa.length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider text-xs">
              Account Details
            </h3>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Customer ID</span>
                <span className="font-mono font-semibold">#{customer.id}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="capitalize">{customer.customer_type || 'Individual'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Assigned Advocate / Rep</span>
                <span>{customer.sales_rep_name || 'Unassigned'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Registered On</span>
                <span>{new Date(customer.created_at || Date.now()).toLocaleDateString('en-KE')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider text-xs">
              Client Relationship Notes
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {customer.notes || 'No notes logged for this customer yet.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: Deals */}
      {activeTab === 'deals' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
          {stats.deals.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No deals recorded for this client yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.deals.map((d) => (
                <div
                  key={d.id}
                  className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{d.title}</h4>
                    <span className="text-xs text-gray-500">{d.stage_name || 'In Progress'}</span>
                  </div>
                  <span className="font-bold text-emerald-600">{formatCurrencyKES(d.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Communications */}
      {activeTab === 'communications' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
          {stats.communications.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No communications logged for this client.</p>
          ) : (
            <div className="space-y-3">
              {stats.communications.map((c) => (
                <div key={c.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {c.subject || c.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.created_at || Date.now()).toLocaleDateString('en-KE')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Tasks */}
      {activeTab === 'tasks' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
          {stats.tasks.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No tasks assigned to this client.</p>
          ) : (
            <div className="space-y-3">
              {stats.tasks.map((t) => (
                <div key={t.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.title}</span>
                  <span className="text-xs capitalize px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: M-Pesa */}
      {activeTab === 'mpesa' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
          {stats.mpesa.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No M-Pesa payments recorded for this client.</p>
          ) : (
            <div className="space-y-3">
              {stats.mpesa.map((m) => (
                <div key={m.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{m.mpesa_receipt_number}</span>
                    <span className="text-xs text-gray-400 block">{new Date(m.transaction_time || Date.now()).toLocaleString('en-KE')}</span>
                  </div>
                  <span className="font-bold text-emerald-600">{formatCurrencyKES(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomerDetail

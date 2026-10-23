import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  Building2, 
  MessageSquare, 
  ArrowRightCircle, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  AlertCircle 
} from 'lucide-react'
import { leadService } from '../services/leadService'

const Leads = () => {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [convertingId, setConvertingId] = useState(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '+254',
    email: '',
    companyName: '',
    source: 'website',
    priority: 'medium',
    estimatedValue: '',
    notes: ''
  })

  useEffect(() => {
    fetchLeads()
  }, [statusFilter, priorityFilter])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const params = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (priorityFilter !== 'all') params.priority = priorityFilter
      if (search.trim()) params.search = search.trim()

      const res = await leadService.getLeads(params)
      setLeads(res.data?.leads || [])
      setError(null)
    } catch (err) {
      console.error('Failed to load leads:', err)
      setError('Failed to load leads. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchLeads()
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateLead = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        ...formData,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : null
      }
      await leadService.createLead(payload)
      setSuccessMsg('Lead created successfully!')
      setShowAddModal(false)
      setFormData({
        firstName: '',
        lastName: '',
        phone: '+254',
        email: '',
        companyName: '',
        source: 'website',
        priority: 'medium',
        estimatedValue: '',
        notes: ''
      })
      fetchLeads()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to create lead.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConvertLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to convert this lead to an active customer?')) return

    try {
      setConvertingId(leadId)
      await leadService.convertToCustomer(leadId)
      setSuccessMsg(`Lead #${leadId} successfully converted to an active customer!`)
      fetchLeads()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to convert lead to customer.')
    } finally {
      setConvertingId(null)
    }
  }

  // Calculate metrics
  const totalLeads = leads.length
  const newLeads = leads.filter(l => l.status === 'new').length
  const qualifiedLeads = leads.filter(l => l.status === 'qualified').length
  const totalEstimatedValue = leads.reduce((sum, l) => sum + (parseFloat(l.estimated_value) || 0), 0)

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return <span className="badge badge-info">New</span>
      case 'contacted':
        return <span className="badge badge-primary">Contacted</span>
      case 'qualified':
        return <span className="badge badge-success">Qualified</span>
      case 'converted':
        return <span className="badge bg-purple-100 text-purple-800 border border-purple-200">Converted</span>
      case 'unqualified':
        return <span className="badge badge-warning">Unqualified</span>
      default:
        return <span className="badge badge-gray">{status}</span>
    }
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">High</span>
      case 'medium':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Medium</span>
      case 'low':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">Low</span>
      default:
        return <span className="text-xs text-gray-500">{priority}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads Pipeline</h1>
          <p className="text-gray-600">Track, score, and convert prospective Kenyan SME & institutional clients.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary inline-flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>New Lead</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
          <CheckCircle2 className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Leads</p>
            <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center space-x-4">
          <div className="p-3 bg-sky-100 rounded-lg text-sky-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">New Leads</p>
            <p className="text-2xl font-bold text-gray-900">{newLeads}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Qualified Leads</p>
            <p className="text-2xl font-bold text-gray-900">{qualifiedLeads}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center space-x-4">
          <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Est. Pipeline Value</p>
            <p className="text-xl font-bold text-gray-900">KES {totalEstimatedValue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, company, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>
          <button type="submit" className="btn-secondary">Search</button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-1 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="unqualified">Unqualified</option>
              <option value="converted">Converted</option>
            </select>
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="input py-1 text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-base font-medium text-gray-700">No leads found</p>
            <p className="text-sm text-gray-400">Try adjusting your filters or click "New Lead" to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Direct Channels</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source & Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Est. Value</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm">
                          {lead.first_name?.[0] || 'L'}
                          {lead.last_name?.[0] || ''}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {lead.first_name} {lead.last_name}
                          </div>
                          {lead.company_name && (
                            <div className="text-xs text-gray-500 flex items-center mt-0.5">
                              <Building2 className="h-3 w-3 mr-1" />
                              {lead.company_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center">
                        <Phone className="h-3.5 w-3.5 mr-1 text-gray-400" />
                        <span>{lead.phone}</span>
                      </div>
                      {lead.email && (
                        <div className="text-xs text-gray-500 flex items-center mt-0.5">
                          <Mail className="h-3.5 w-3.5 mr-1 text-gray-400" />
                          <span>{lead.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded capitalize">
                          {lead.source?.replace('_', ' ') || 'Direct'}
                        </span>
                        {getPriorityBadge(lead.priority)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {lead.estimated_value ? `KES ${Number(lead.estimated_value).toLocaleString()}` : '—'}
                      </div>
                      {lead.score > 0 && (
                        <div className="text-xs text-emerald-600 font-medium">
                          Score: {lead.score}/100
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {lead.phone && (
                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </a>
                        )}

                        {lead.status !== 'converted' ? (
                          <button
                            onClick={() => handleConvertLead(lead.id)}
                            disabled={convertingId === lead.id}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50"
                            title="Convert to Customer"
                          >
                            <ArrowRightCircle className="h-3.5 w-3.5 mr-1" />
                            <span>{convertingId === lead.id ? 'Converting...' : 'Convert'}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center text-xs text-gray-400 italic">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Converted
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">Add New Lead</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="input w-full"
                    placeholder="e.g. Samuel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="input w-full"
                    placeholder="e.g. Kamau"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone (+254...) *</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="+254712345678"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Company / Organization</label>
                <input
                  type="text"
                  name="companyName"
                  placeholder="e.g. Rift Valley Land Holdings"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Source</label>
                  <select
                    name="source"
                    value={formData.source}
                    onChange={handleInputChange}
                    className="input w-full text-sm"
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="cold_call">Cold Call</option>
                    <option value="social_media">Social Media</option>
                    <option value="event">Event / Expo</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="input w-full text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Est. Value (KES)</label>
                  <input
                    type="number"
                    name="estimatedValue"
                    placeholder="2500000"
                    value={formData.estimatedValue}
                    onChange={handleInputChange}
                    className="input w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows="3"
                  placeholder="Inquired about 2-acre plot in Nanyuki or conveyancing service..."
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="input w-full"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Leads
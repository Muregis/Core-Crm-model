// Customers.jsx
// Customer list with API data fetching, Kenyan county filters, pagination, customer creation modal, and 360 view links.
import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Phone, Mail, MapPin, MoreHorizontal, Users, RefreshCw } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { formatCurrencyKES, formatDateKe } from '../utils/formatters'
import { customerService } from '../services/customerService'
import toast from 'react-hot-toast'

const KENYAN_COUNTIES = [
  'Nairobi', 'Kiambu', 'Machakos', 'Kajiado', 'Nakuru', 
  'Mombasa', 'Kilifi', 'Uasin Gishu', 'Kisumu', 'Murang\'a'
]

const Customers = () => {
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [countyFilter, setCountyFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '+254',
    email: '',
    companyName: '',
    customerType: 'individual',
    status: 'active',
    notes: ''
  })

  const loadCustomers = async () => {
    setIsLoading(true)
    try {
      const res = await customerService.getCustomers({ limit: 100 })
      if (res.data?.success) {
        const raw = res.data.data.customers || []
        // normalize backend fields
        const formatted = raw.map((c) => ({
          id: c.id,
          firstName: c.first_name || c.firstName,
          lastName: c.last_name || c.lastName,
          email: c.email,
          phone: c.phone,
          company: c.company_name || c.company,
          county: c.county_name || c.county || 'Nairobi',
          status: c.status || 'active',
          type: c.customer_type || c.type || 'individual',
          totalRevenue: c.total_revenue || 0,
          lastContact: c.last_contact || c.created_at,
          salesRep: c.sales_rep_name || 'Team Rep'
        }))
        setCustomers(formatted)
      }
    } catch (err) {
      // Fallback sample data
      setCustomers([
        {
          id: 1,
          firstName: 'James',
          lastName: 'Mwangi',
          email: 'james.mwangi@email.com',
          phone: '+254712345690',
          company: 'Mwangi Enterprises',
          county: 'Nairobi',
          status: 'active',
          type: 'business',
          totalRevenue: 250000,
          lastContact: '2026-03-12',
          salesRep: 'John Sales',
        },
        {
          id: 2,
          firstName: 'Grace',
          lastName: 'Wanjiru',
          email: 'grace.wanjiru@email.com',
          phone: '+254712345691',
          company: 'Wanjiru Farm Supplies',
          county: 'Mombasa',
          status: 'active',
          type: 'business',
          totalRevenue: 150000,
          lastContact: '2026-03-11',
          salesRep: 'John Sales',
        },
        {
          id: 3,
          firstName: 'Peter',
          lastName: 'Karanja',
          email: 'peter.karanja@email.com',
          phone: '+254712345692',
          company: 'Karanja Tech Solutions',
          county: 'Kiambu',
          status: 'prospect',
          type: 'sme',
          totalRevenue: 75000,
          lastContact: '2026-03-10',
          salesRep: 'Paul Rep',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const pageSize = 10

  const counties = useMemo(() => {
    const unique = new Set([...KENYAN_COUNTIES, ...customers.map((c) => c.county).filter(Boolean)])
    return Array.from(unique).sort()
  }, [customers])

  const getStatusBadge = (status) => {
    const styles = {
      active: 'badge-success',
      inactive: 'badge-gray',
      prospect: 'badge-warning',
    }
    return <span className={`badge ${styles[status] ?? 'badge-gray'}`}>{status}</span>
  }

  const getTypeBadge = (type) => {
    const styles = {
      individual: 'badge-primary',
      business: 'badge-success',
      sme: 'badge-warning',
      sacco: 'badge-error',
    }
    return <span className={`badge ${styles[type] ?? 'badge-gray'}`}>{type}</span>
  }

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase()

    return customers.filter((c) => {
      const matchesQuery =
        !q ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        String(c.company ?? '').toLowerCase().includes(q) ||
        String(c.email ?? '').toLowerCase().includes(q) ||
        String(c.phone ?? '').toLowerCase().includes(q)

      const matchesStatus = !statusFilter || c.status === statusFilter
      const matchesType = !typeFilter || c.type === typeFilter
      const matchesCounty = !countyFilter || c.county === countyFilter

      return matchesQuery && matchesStatus && matchesType && matchesCounty
    })
  }, [customers, countyFilter, query, statusFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredCustomers.length)
  const pageCustomers = filteredCustomers.slice(startIndex, endIndex)

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('')
    setTypeFilter('')
    setCountyFilter('')
    setPage(1)
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.phone) {
      toast.error('First name, last name, and phone number are required')
      return
    }

    try {
      await customerService.createCustomer({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email ? form.email.trim() : null,
        companyName: form.companyName ? form.companyName.trim() : null,
        customerType: form.customerType,
        status: form.status,
        notes: form.notes
      })
      toast.success('Customer created successfully')
      setShowAddModal(false)
      setForm({
        firstName: '',
        lastName: '',
        phone: '+254',
        email: '',
        companyName: '',
        customerType: 'individual',
        status: 'active',
        notes: ''
      })
      loadCustomers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create customer')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customers & Clients</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your client directory, customer types (SME, SACCO, Individual), and transaction histories.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadCustomers}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
            title="Refresh"
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            type="button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-10"
                placeholder="Search customers..."
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>

            <div>
              <select
                className="input"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Types</option>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="sme">SME</option>
                <option value="sacco">SACCO</option>
              </select>
            </div>

            <div>
              <select
                className="input"
                value={countyFilter}
                onChange={(e) => {
                  setCountyFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Counties</option>
                {counties.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card">
        <div className="card-body p-0">
          {filteredCustomers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers found"
              description="Try adjusting your search or clearing filters to see results."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Total Revenue</th>
                    <th>Last Contact</th>
                    <th>Sales Rep</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {pageCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                      <td>
                        <Link to={`/customers/${customer.id}`} className="flex items-center group">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center dark:bg-primary-900/30">
                              <span className="text-sm font-medium text-primary-600 dark:text-primary-200 uppercase">
                                {customer.firstName ? customer.firstName[0] : ''}
                                {customer.lastName ? customer.lastName[0] : ''}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 transition">
                              {customer.firstName} {customer.lastName}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{customer.company}</div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center font-mono text-xs">
                            <Phone className="h-3 w-3 mr-1 text-gray-400" />
                            {customer.phone}
                          </div>
                          {customer.email && (
                            <div className="flex items-center mt-1 text-xs">
                              <Mail className="h-3 w-3 mr-1 text-gray-400" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center text-sm text-gray-900 dark:text-gray-100">
                          <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                          {customer.county}
                        </div>
                      </td>
                      <td>{getTypeBadge(customer.type)}</td>
                      <td>{getStatusBadge(customer.status)}</td>
                      <td className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrencyKES(customer.totalRevenue)}
                      </td>
                      <td className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDateKe(customer.lastContact)}
                      </td>
                      <td className="text-sm text-gray-900 dark:text-gray-100">{customer.salesRep}</td>
                      <td className="text-right">
                        <Link
                          to={`/customers/${customer.id}`}
                          className="text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                          View 360°
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredCustomers.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{endIndex}</span> of{' '}
              <span className="font-medium">{filteredCustomers.length}</span> results
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-button"
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                Previous
              </button>
              <button
                className="pagination-button"
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add New Customer</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Phone (+254)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+2547XXXXXXXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="client@domain.co.ke"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mwangi Enterprises"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Customer Type
                  </label>
                  <select
                    value={form.customerType}
                    onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                    <option value="sme">SME</option>
                    <option value="sacco">SACCO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Relationship Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Preferences, property interests, or background..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers

// Customers.jsx
// Customer list with client-side search, filters, pagination, and empty states (Kenya-focused formatting).
import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Phone, Mail, MapPin, MoreHorizontal, Users } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { formatCurrencyKES, formatDateKe } from '../utils/formatters'

const Customers = () => {
  // Mock data - replace with API calls.
  const customers = useMemo(
    () => [
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
    ],
    [],
  )

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [countyFilter, setCountyFilter] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 10

  const counties = useMemo(() => {
    const unique = new Set(customers.map((c) => c.county).filter(Boolean))
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your customer relationships and track interactions.
          </p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-outline" type="button">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
          <Link to="/customers/new" className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  className="input pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
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
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center dark:bg-primary-900/30">
                              <span className="text-sm font-medium text-primary-600 dark:text-primary-200">
                                {customer.firstName[0]}
                                {customer.lastName[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {customer.firstName} {customer.lastName}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{customer.company}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1 text-gray-400" />
                            {customer.phone}
                          </div>
                          <div className="flex items-center mt-1">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            {customer.email}
                          </div>
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
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" type="button">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
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
    </div>
  )
}

export default Customers


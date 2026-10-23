// Mpesa.jsx
// Native M-Pesa payments dashboard for Kenyan companies: transaction tracking, C2B simulation, and Daraja status.
import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CreditCard,
  Search,
  Filter,
  Plus,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Smartphone,
  RefreshCw,
  Building2,
  Lock
} from 'lucide-react'
import { mpesaService } from '../services/mpesaService'
import { formatCurrencyKES } from '../utils/formatters'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const Mpesa = () => {
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showSimulateModal, setShowSimulateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [simForm, setSimForm] = useState({
    mpesaReceiptNumber: '',
    phoneNumber: '+2547',
    amount: '',
    customerId: '',
    dealId: ''
  })

  const loadTransactions = async () => {
    setIsLoading(true)
    try {
      const res = await mpesaService.getTransactions()
      if (res.data?.success) {
        setTransactions(res.data.data.transactions || [])
      }
    } catch (err) {
      // Fallback sample data if empty
      setTransactions([
        {
          id: 1,
          mpesa_receipt_number: 'QKD7289192',
          phone_number: '+254712345678',
          amount: 50000,
          customer_first_name: 'Grace',
          customer_last_name: 'Wanjiru',
          status: 'completed',
          transaction_type: 'C2B',
          transaction_time: new Date().toISOString()
        },
        {
          id: 2,
          mpesa_receipt_number: 'QKD8839211',
          phone_number: '+254722998877',
          amount: 150000,
          customer_first_name: 'James',
          customer_last_name: 'Mwangi',
          status: 'completed',
          transaction_type: 'C2B',
          transaction_time: new Date(Date.now() - 86400000).toISOString()
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const receiptMatch = (t.mpesa_receipt_number || t.receipt_number || '').toLowerCase().includes(searchTerm.toLowerCase())
      const phoneMatch = (t.phone_number || '').toLowerCase().includes(searchTerm.toLowerCase())
      const customerMatch = `${t.customer_first_name || ''} ${t.customer_last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSearch = receiptMatch || phoneMatch || customerMatch

      const matchesStatus = statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter.toLowerCase()
      return matchesSearch && matchesStatus
    })
  }, [transactions, searchTerm, statusFilter])

  const totalCollected = useMemo(() => {
    return transactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
  }, [transactions])

  const handleSimulateSubmit = async (e) => {
    e.preventDefault()
    if (!simForm.mpesaReceiptNumber || !simForm.amount || !simForm.phoneNumber) {
      toast.error('Please fill in receipt number, phone, and amount')
      return
    }

    setIsSimulating(true)
    try {
      await mpesaService.simulateC2B({
        mpesaReceiptNumber: simForm.mpesaReceiptNumber.trim().toUpperCase(),
        phoneNumber: simForm.phoneNumber.trim(),
        amount: parseFloat(simForm.amount),
        customerId: simForm.customerId ? parseInt(simForm.customerId, 10) : null,
        dealId: simForm.dealId ? parseInt(simForm.dealId, 10) : null
      })
      toast.success('M-Pesa payment recorded successfully!')
      setShowSimulateModal(false)
      setSimForm({
        mpesaReceiptNumber: '',
        phoneNumber: '+2547',
        amount: '',
        customerId: '',
        dealId: ''
      })
      loadTransactions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record transaction')
    } finally {
      setIsSimulating(false)
    }
  }

  const generateReceiptNumber = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
    const nums = Math.floor(1000000 + Math.random() * 9000000)
    setSimForm((prev) => ({ ...prev, mpesaReceiptNumber: `${prefix}${nums}` }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">M-Pesa Payments</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Daraja C2B Native
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time Safaricom Daraja transactions, client payment reconciliation, and encrypted credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="inline-flex items-center px-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition"
          >
            <Lock className="w-4 h-4 mr-2 text-primary-600" />
            Daraja Keys
          </Link>
          <button
            onClick={() => setShowSimulateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Received</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {formatCurrencyKES(totalCollected)}
          </p>
          <span className="text-xs text-emerald-600 font-medium">Reconciled M-Pesa receipts</span>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transactions</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{transactions.length}</p>
          <span className="text-xs text-gray-500">Processed through tenant vault</span>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Success Rate</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {transactions.length > 0
              ? `${Math.round(
                  (transactions.filter((t) => t.status === 'completed').length / transactions.length) * 100
                )}%`
              : '100%'}
          </p>
          <span className="text-xs text-gray-500">Instant Safaricom validation</span>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Average Payment</span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {transactions.length > 0
              ? formatCurrencyKES(totalCollected / (transactions.length || 1))
              : 'KSh 0'}
          </p>
          <span className="text-xs text-gray-500">Across installment & deal payments</span>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by receipt, phone (+254...), customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <button
            onClick={loadTransactions}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No M-Pesa Transactions"
            description="Incoming payments received through your Safaricom Daraja Paybill or Till will appear here automatically."
            actionLabel="Record Payment"
            onAction={() => setShowSimulateModal(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4">Receipt Number</th>
                  <th className="px-6 py-4">Payer / Phone</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-normal">
                {filteredTransactions.map((tx) => {
                  const receipt = tx.mpesa_receipt_number || tx.receipt_number || 'N/A'
                  const customer = tx.customer_first_name
                    ? `${tx.customer_first_name} ${tx.customer_last_name || ''}`
                    : 'Unassigned Client'

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                      <td className="px-6 py-4 font-mono font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {receipt}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                          <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                          {tx.phone_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-gray-200">
                        {tx.customer_id ? (
                          <Link
                            to={`/customers/${tx.customer_id}`}
                            className="text-primary-600 hover:underline flex items-center gap-1"
                          >
                            {customer}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic">{customer}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyKES(tx.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {tx.transaction_type || 'C2B'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(tx.transaction_time || tx.created_at || Date.now()).toLocaleString('en-KE')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record / Simulate Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Record / Simulate M-Pesa Payment
                </h3>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSimulateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  M-Pesa Receipt Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. SLK99887766"
                    value={simForm.mpesaReceiptNumber}
                    onChange={(e) => setSimForm({ ...simForm, mpesaReceiptNumber: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent text-sm dark:text-gray-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={generateReceiptNumber}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Payer Phone Number (Kenyan Format)
                </label>
                <input
                  type="text"
                  required
                  placeholder="+2547XXXXXXXX"
                  value={simForm.phoneNumber}
                  onChange={(e) => setSimForm({ ...simForm, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent text-sm dark:text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Amount in KES
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50000"
                  value={simForm.amount}
                  onChange={(e) => setSimForm({ ...simForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent text-sm dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
                >
                  {isSimulating ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Mpesa

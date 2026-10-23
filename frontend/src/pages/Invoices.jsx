import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  Building,
  QrCode,
  DollarSign,
  ChevronRight,
  TrendingDown,
  Trash2,
  Calendar,
  X,
  Share2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { invoiceService } from '../services/invoiceService'
import { customerService } from '../services/customerService'
import { mpesaService } from '../services/mpesaService'
import { formatCurrencyKES } from '../utils/formatters'
import { useAuthStore } from '../store/authStore'

const Invoices = () => {
  const { user } = useAuthStore()
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [agingData, setAgingData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'invoice' | 'quote' | 'proforma'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'unpaid' | 'paid' | 'partial'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showStkModal, setShowStkModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPromptingStk, setIsPromptingStk] = useState(false)

  // STK Form
  const [stkForm, setStkForm] = useState({
    phoneNumber: '',
    amount: ''
  })

  // Create Invoice Form
  const [createForm, setCreateForm] = useState({
    customerId: '',
    invoiceType: 'invoice',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    notes: 'Payment terms: 30 days. Remit payments via M-Pesa or RTGS bank transfer.',
    items: [
      { itemDescription: 'Industrial Supplies / Services', quantity: 1, unitPriceKes: 10000, taxRate: 16 }
    ]
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [invRes, agingRes, custRes] = await Promise.all([
        invoiceService.getInvoices().catch(() => ({ data: { success: false } })),
        invoiceService.getAgingReport().catch(() => ({ data: { success: false } })),
        customerService.getCustomers({ limit: 100 }).catch(() => ({ data: { success: false } }))
      ])

      if (invRes.data?.success) {
        setInvoices(invRes.data.data.invoices || [])
      }
      if (agingRes.data?.success) {
        setAgingData(agingRes.data.data)
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
    } catch (err) {
      toast.error('Failed to load invoice and aging data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const text = `${inv.invoice_number || ''} ${inv.customer_company_name || ''} ${inv.customer_first_name || ''} ${inv.customer_last_name || ''}`.toLowerCase()
      const matchesSearch = text.includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'all' || inv.invoice_type === typeFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'unpaid' && inv.status !== 'paid' && inv.status !== 'cancelled') ||
        inv.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [invoices, searchTerm, typeFilter, statusFilter])

  // Invoice calculations
  const formSubtotal = useMemo(() => {
    return createForm.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPriceKes) || 0), 0)
  }, [createForm.items])

  const formVat = useMemo(() => {
    return createForm.items.reduce((sum, item) => {
      const lineSub = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPriceKes) || 0)
      const rate = item.taxRate ? parseFloat(item.taxRate) : 0
      return sum + (lineSub * (rate / 100))
    }, 0)
  }, [createForm.items])

  const formTotal = formSubtotal + formVat

  // Handle adding line item
  const handleAddItem = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { itemDescription: '', quantity: 1, unitPriceKes: '', taxRate: 16 }
      ]
    }))
  }

  // Handle removing line item
  const handleRemoveItem = (index) => {
    if (createForm.items.length <= 1) return
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Update item field
  const handleItemChange = (index, field, value) => {
    setCreateForm((prev) => {
      const updated = [...prev.items]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, items: updated }
    })
  }

  // Create invoice submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!createForm.customerId || !createForm.items.length) {
      toast.error('Select a customer and provide at least one line item')
      return
    }

    setIsSubmitting(true)
    try {
      await invoiceService.createInvoice({
        customerId: parseInt(createForm.customerId, 10),
        invoiceType: createForm.invoiceType,
        issueDate: createForm.issueDate,
        dueDate: createForm.dueDate,
        notes: createForm.notes,
        items: createForm.items.map((it) => ({
          itemDescription: it.itemDescription || 'Line Item',
          quantity: parseFloat(it.quantity) || 1,
          unitPriceKes: parseFloat(it.unitPriceKes) || 0,
          taxRate: parseFloat(it.taxRate) || 0
        }))
      })

      toast.success(
        createForm.invoiceType === 'quote'
          ? 'Quotation created with 16% VAT breakdown'
          : 'KRA eTIMS Tax Invoice generated'
      )
      setShowCreateModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open STK Push Modal
  const openStkPush = (inv) => {
    setSelectedInvoice(inv)
    const balance = Math.max(0, (parseFloat(inv.total_amount_kes) || 0) - (parseFloat(inv.amount_paid_kes) || 0))
    setStkForm({
      phoneNumber: inv.customer_phone || '',
      amount: balance > 0 ? balance : inv.total_amount_kes
    })
    setShowStkModal(true)
  }

  // Submit STK Push
  const handleStkSubmit = async (e) => {
    e.preventDefault()
    if (!stkForm.phoneNumber || !stkForm.amount) {
      toast.error('Enter a valid phone number and payment amount')
      return
    }

    setIsPromptingStk(true)
    try {
      const res = await mpesaService.stkPush({
        phoneNumber: stkForm.phoneNumber,
        amount: parseFloat(stkForm.amount),
        invoiceId: selectedInvoice.id,
        accountReference: selectedInvoice.invoice_number,
        customerId: selectedInvoice.customer_id
      })

      const receipt = res.data?.data?.mpesaReceiptNumber || 'M-Pesa STK'
      toast.success(`⚡ M-Pesa STK Push prompted! Receipt: ${receipt}. Invoice auto-reconciled!`, {
        duration: 5000
      })
      setShowStkModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'STK Push failed')
    } finally {
      setIsPromptingStk(false)
    }
  }

  // Dispatch WhatsApp Statement / Reminder
  const sendWhatsAppStatement = (debtor) => {
    const phone = (debtor.phone || '').replace(/\D/g, '')
    if (!phone) {
      toast.error('Debtor has no phone number registered')
      return
    }
    const cleanPhone = phone.startsWith('0') ? '254' + phone.slice(1) : phone.startsWith('254') ? phone : '254' + phone
    const msg = encodeURIComponent(
      `Habari ${debtor.name},\n\nThis is a friendly statement notice from ${user?.tenant_name || 'Accounts'}.\nYour account has an outstanding balance of ${formatCurrencyKES(debtor.totalOutstandingKes)} (${debtor.oldestOverdueDays} days overdue across ${debtor.invoiceCount} invoices).\n\nKindly remit payment via M-Pesa Paybill or Bank Transfer at your earliest convenience.\nThank you for your business!`
    )
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank')
  }

  const agingSummary = agingData?.summary || {
    totalReceivablesKes: 0,
    currentKes: 0,
    days31to60Kes: 0,
    days61to90Kes: 0,
    days90PlusKes: 0,
    overduePercentage: 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Invoices, Quotations & eTIMS
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              KRA eTIMS & M-Pesa Ready
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Itemized VAT quotations, eTIMS tax invoices, 1-click M-Pesa STK prompts, and debtor aging.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          + New Invoice / Quote
        </button>
      </div>

      {/* Debtor Aging Analysis Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Accounts Receivable & Debtor Aging
            </h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Overdue Rate: <strong className="text-rose-600">{agingSummary.overduePercentage}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Receivables</span>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
              {formatCurrencyKES(agingSummary.totalReceivablesKes)}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Current (0-30 Days)</span>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {formatCurrencyKES(agingSummary.currentKes)}
            </p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">31 - 60 Days Overdue</span>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-1">
              {formatCurrencyKES(agingSummary.days31to60Kes)}
            </p>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">61 - 90 Days Overdue</span>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-400 mt-1">
              {formatCurrencyKES(agingSummary.days61to90Kes)}
            </p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">90+ Days (Critical)</span>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">
              {formatCurrencyKES(agingSummary.days90PlusKes)}
            </p>
          </div>
        </div>

        {/* Top Debtors Quick Dispatch Bar */}
        {agingData?.topDebtors?.length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Top Overdue Accounts (1-Click WhatsApp Demand):</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {agingData.topDebtors.slice(0, 3).map((deb) => (
                <div
                  key={deb.customerId}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{deb.name}</span>
                  <span className="text-rose-600 font-bold">{formatCurrencyKES(deb.totalOutstandingKes)}</span>
                  <span className="text-[10px] text-gray-400">({deb.oldestOverdueDays}d)</span>
                  <button
                    onClick={() => sendWhatsAppStatement(deb)}
                    className="ml-1 text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5 hover:underline"
                    title="Send WhatsApp Statement"
                  >
                    <Share2 className="w-3 h-3" /> Remind
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Document Type tabs */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs">
            {['all', 'invoice', 'quote', 'proforma'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1 rounded-md font-medium capitalize transition ${
                  typeFilter === type
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {type === 'all' ? 'All Docs' : type}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-gray-100"
          >
            <option value="all">All Statuses</option>
            <option value="unpaid">Unpaid / Overdue</option>
            <option value="partial">Partially Paid</option>
            <option value="paid">Fully Paid</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoice #, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-gray-100"
            />
          </div>

          <button
            onClick={loadData}
            className="p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-950 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3">Doc # & Type</th>
                <th className="px-4 py-3">Customer / Key Account</th>
                <th className="px-4 py-3">Due Date & Aging</th>
                <th className="px-4 py-3">KRA eTIMS CU</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Amount Paid</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Instant Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                    No documents found matching your filter. Click "+ New Invoice / Quote" to create one.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const clientName = inv.customer_company_name || `${inv.customer_first_name} ${inv.customer_last_name || ''}`.trim()
                  const balance = (parseFloat(inv.total_amount_kes) || 0) - (parseFloat(inv.amount_paid_kes) || 0)
                  const isOverdue = inv.status !== 'paid' && inv.days_overdue > 0

                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-primary-600" />
                          {inv.invoice_number}
                        </div>
                        <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                          {inv.invoice_type}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{clientName}</div>
                        <div className="text-xs text-gray-400 font-mono">{inv.customer_phone || 'No phone'}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-900 dark:text-gray-100">{inv.due_date}</div>
                        {isOverdue ? (
                          <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {inv.days_overdue} days overdue
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium">Within terms</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {inv.etims_cu_number ? inv.etims_cu_number.slice(0, 16) + '...' : 'Pending'}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 font-mono">
                        {formatCurrencyKES(inv.total_amount_kes)}
                      </td>

                      <td className="px-4 py-3 font-mono">
                        <span className={inv.amount_paid_kes > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                          {formatCurrencyKES(inv.amount_paid_kes)}
                        </span>
                        {balance > 0 && (
                          <div className="text-[11px] text-rose-500 font-medium">
                            Bal: {formatCurrencyKES(balance)}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : inv.status === 'partial'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {inv.status !== 'paid' ? (
                          <button
                            onClick={() => openStkPush(inv)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition"
                            title="Prompt Client Phone with M-Pesa STK Push"
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1" />
                            ⚡ STK Push
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 font-bold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1-Click M-Pesa STK Push Modal */}
      {showStkModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                    M-Pesa STK Push Prompt
                  </h3>
                  <p className="text-xs text-gray-500">
                    Instantly prompt customer phone & auto-reconcile invoice
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStkModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice Ref:</span>
                <strong className="text-gray-900 dark:text-gray-100">{selectedInvoice.invoice_number}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <strong className="text-gray-900 dark:text-gray-100">
                  {selectedInvoice.customer_company_name || `${selectedInvoice.customer_first_name} ${selectedInvoice.customer_last_name || ''}`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Invoice Amount:</span>
                <strong className="text-gray-900 dark:text-gray-100">{formatCurrencyKES(selectedInvoice.total_amount_kes)}</strong>
              </div>
            </div>

            <form onSubmit={handleStkSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Customer M-Pesa Phone Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0712345678 or 254712345678"
                  value={stkForm.phoneNumber}
                  onChange={(e) => setStkForm({ ...stkForm, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Prompt Amount (KES) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={stkForm.amount}
                  onChange={(e) => setStkForm({ ...stkForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
                <span className="text-[11px] text-gray-500">
                  Will trigger Safaricom PIN dialog directly on client's handset.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStkModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPromptingStk}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isPromptingStk ? 'Sending STK Push...' : '⚡ Trigger M-Pesa Push'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Invoice / Quotation Builder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  Generate Itemized Commercial Document
                </h3>
                <p className="text-xs text-gray-500">
                  Auto-calculates 16% VAT, generates KRA eTIMS CU code, and initializes debtor aging.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Document Type *
                  </label>
                  <select
                    value={createForm.invoiceType}
                    onChange={(e) => setCreateForm({ ...createForm, invoiceType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-medium"
                  >
                    <option value="invoice">Tax Invoice (KRA eTIMS Compliant)</option>
                    <option value="quote">Formal Quotation / Estimate</option>
                    <option value="proforma">Proforma Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Customer / Account *
                  </label>
                  <select
                    required
                    value={createForm.customerId}
                    onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  >
                    <option value="">-- Select Client / Key Account --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name ? `${c.company_name} (${c.first_name})` : `${c.first_name} ${c.last_name || ''}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={createForm.issueDate}
                    onChange={(e) => setCreateForm({ ...createForm, issueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Itemized Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Line Items & VAT Breakdown
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {createForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl items-center border border-gray-200 dark:border-gray-700 text-xs"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Item description / SKU"
                          value={item.itemDescription}
                          onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-center font-mono"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          placeholder="Unit Price (KES)"
                          value={item.unitPriceKes}
                          onChange={(e) => handleItemChange(idx, 'unitPriceKes', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-right font-mono"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-right font-mono">
                          {formatCurrencyKES(((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPriceKes) || 0)) * 1.16)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={createForm.items.length <= 1}
                          className="text-gray-400 hover:text-rose-500 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatCurrencyKES(formSubtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>KRA Standard 16% VAT:</span>
                  <span className="font-mono font-medium">{formatCurrencyKES(formVat)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span>Grand Total (KES):</span>
                  <span className="text-emerald-600 font-mono">{formatCurrencyKES(formTotal)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Generating eTIMS Document...' : 'Generate Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Invoices

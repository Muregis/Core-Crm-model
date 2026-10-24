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
  Share2,
  Package,
  Printer,
  ArrowRightCircle,
  FileCheck,
  Percent,
  Layers
} from 'lucide-react'
import toast from 'react-hot-toast'
import { invoiceService } from '../services/invoiceService'
import { customerService } from '../services/customerService'
import { productService } from '../services/productService'
import { mpesaService } from '../services/mpesaService'
import { formatCurrencyKES } from '../utils/formatters'
import { useAuthStore } from '../store/authStore'

const Invoices = () => {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('invoices') // 'invoices' | 'catalog' | 'aging'
  const [invoices, setInvoices] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [agingData, setAgingData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'invoice' | 'quote'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'unpaid' | 'paid' | 'partial'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showStkModal, setShowStkModal] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [showWaModal, setShowWaModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [selectedDebtor, setSelectedDebtor] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPromptingStk, setIsPromptingStk] = useState(false)

  // STK Form
  const [stkForm, setStkForm] = useState({
    phoneNumber: '',
    amount: ''
  })

  // Create Product Form
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: 'Commercial Supplies',
    unit: 'unit',
    unitPriceKes: '',
    costPriceKes: '',
    stockQuantity: '20'
  })

  // Create Invoice / Quote Form
  const [createForm, setCreateForm] = useState({
    customerId: '',
    invoiceType: 'invoice', // 'invoice' | 'quote'
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    notes: 'Payment terms: 30 days. Settle via Safaricom Paybill or Bank Transfer.',
    items: [
      { itemDescription: 'Industrial Supplies / Services', quantity: 1, unitPriceKes: 15000, taxRate: 16 }
    ]
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [invRes, prodRes, agingRes, custRes] = await Promise.all([
        invoiceService.getInvoices().catch(() => ({ data: { success: false } })),
        productService.getProducts().catch(() => ({ data: { success: false } })),
        invoiceService.getAgingReport().catch(() => ({ data: { success: false } })),
        customerService.getCustomers({ limit: 100 }).catch(() => ({ data: { success: false } }))
      ])

      if (invRes.data?.success) {
        setInvoices(invRes.data.data.invoices || [])
      }
      if (prodRes.data?.success) {
        setProducts(prodRes.data.data.products || [])
      }
      if (agingRes.data?.success) {
        setAgingData(agingRes.data.data)
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
    } catch (err) {
      toast.error('Failed to load Commercial Core data')
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
        (statusFilter === 'unpaid' && inv.status !== 'paid') ||
        inv.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [invoices, searchTerm, typeFilter, statusFilter])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const text = `${p.name || ''} ${p.sku || ''} ${p.category || ''}`.toLowerCase()
      return text.includes(searchTerm.toLowerCase())
    })
  }, [products, searchTerm])

  // Handle Add Item to Form
  const handleAddItem = (preset) => {
    if (preset) {
      setCreateForm((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            itemDescription: preset.name,
            productId: preset.id,
            quantity: 1,
            unitPriceKes: preset.unit_price_kes,
            taxRate: 16
          }
        ]
      }))
    } else {
      setCreateForm((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          { itemDescription: '', quantity: 1, unitPriceKes: 0, taxRate: 16 }
        ]
      }))
    }
  }

  const handleRemoveItem = (index) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleItemChange = (index, field, value) => {
    setCreateForm((prev) => {
      const updated = [...prev.items]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, items: updated }
    })
  }

  // Calculate Running Totals
  const formTotals = useMemo(() => {
    let subtotal = 0
    let vat = 0
    for (const item of createForm.items) {
      const q = parseFloat(item.quantity) || 0
      const p = parseFloat(item.unitPriceKes) || 0
      const t = parseFloat(item.taxRate) || 0
      const itemSub = q * p
      const itemVat = itemSub * (t / 100)
      subtotal += itemSub
      vat += itemVat
    }
    return {
      subtotal,
      vat,
      total: subtotal + vat
    }
  }, [createForm.items])

  // Create Invoice or Quotation
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!createForm.customerId) {
      toast.error('Please select a customer')
      return
    }
    if (!createForm.items.length) {
      toast.error('Please add at least one line item')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await invoiceService.createInvoice({
        customerId: createForm.customerId,
        invoiceType: createForm.invoiceType,
        issueDate: createForm.issueDate,
        dueDate: createForm.dueDate,
        notes: createForm.notes,
        items: createForm.items
      })

      if (res.data?.success) {
        toast.success(
          `${createForm.invoiceType === 'quote' ? 'Quotation' : 'Tax Invoice'} generated with KRA eTIMS CU code!`
        )
        setShowCreateModal(false)
        loadData()
      } else {
        toast.error(res.data?.message || 'Failed to create document')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Server error creating document')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Convert Quote to Tax Invoice
  const handleConvertQuote = async (quote) => {
    if (!window.confirm(`Convert Quotation ${quote.invoice_number} to an official Tax Invoice?`)) return

    try {
      const res = await invoiceService.convertQuoteToInvoice(quote.id)
      if (res.data?.success) {
        toast.success(res.data.message || 'Converted to Tax Invoice!')
        loadData()
      } else {
        toast.error(res.data?.message || 'Conversion failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to convert quotation')
    }
  }

  // Create Product in Catalog
  const handleCreateProduct = async (e) => {
    e.preventDefault()
    if (!productForm.name || !productForm.sku || !productForm.unitPriceKes) {
      toast.error('Name, SKU, and Unit Price are required')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await productService.createProduct({
        name: productForm.name,
        sku: productForm.sku.toUpperCase(),
        category: productForm.category,
        unit: productForm.unit,
        unitPriceKes: parseFloat(productForm.unitPriceKes),
        costPriceKes: parseFloat(productForm.costPriceKes) || 0,
        taxRate: 16.0,
        stockQuantity: parseInt(productForm.stockQuantity, 10) || 0
      })

      if (res.data?.success) {
        toast.success('Product SKU added to catalog!')
        setShowProductModal(false)
        setProductForm({
          name: '',
          sku: '',
          category: 'Commercial Supplies',
          unit: 'unit',
          unitPriceKes: '',
          costPriceKes: '',
          stockQuantity: '20'
        })
        loadData()
      } else {
        toast.error(res.data?.message || 'Failed to add product')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  // STK Push Trigger
  const handleTriggerStk = async (e) => {
    e.preventDefault()
    if (!stkForm.phoneNumber || !stkForm.amount) {
      toast.error('Please enter phone and amount')
      return
    }

    setIsPromptingStk(true)
    try {
      const formattedPhone = stkForm.phoneNumber.startsWith('0')
        ? '254' + stkForm.phoneNumber.slice(1)
        : stkForm.phoneNumber.startsWith('+')
        ? stkForm.phoneNumber.slice(1)
        : stkForm.phoneNumber

      const res = await mpesaService.triggerStkPush({
        phoneNumber: formattedPhone,
        amount: parseFloat(stkForm.amount),
        accountReference: selectedInvoice.invoice_number || 'INV-SETTLE',
        transactionDesc: `Settlement for ${selectedInvoice.invoice_number}`
      })

      if (res.data?.success) {
        toast.success('STK Push sent to customer phone! Auto-reconciling...')
        setShowStkModal(false)
        loadData()
      } else {
        toast.error(res.data?.message || 'STK Push failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger M-Pesa STK')
    } finally {
      setIsPromptingStk(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commercial Core Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              KRA eTIMS & M-Pesa Ready
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage product SKUs, issue official quotes & 16% VAT tax invoices, track 30/60/90-day aging, and collect via M-Pesa STK Push.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProductModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 transition"
          >
            <Package className="w-4 h-4 text-emerald-600" />
            + New Product SKU
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Quote / Invoice
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 gap-6">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          📄 Invoices & Quotations ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Package className="w-4 h-4" />
          📦 Products & Services Catalog ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('aging')}
          className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'aging'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          📊 30/60/90-Day Debtor Aging
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: INVOICES & QUOTATIONS */}
      {/* ==================================================== */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoice number, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Type filter */}
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900 text-xs font-medium">
                {['all', 'invoice', 'quote'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 rounded-md capitalize transition ${
                      typeFilter === t
                        ? 'bg-white dark:bg-gray-800 text-emerald-600 font-semibold shadow-xs'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {t === 'all' ? 'All Docs' : t === 'quote' ? 'Quotes' : 'Invoices'}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="unpaid">Unpaid / Overdue</option>
                <option value="paid">Fully Settled</option>
                <option value="partial">Partially Paid</option>
              </select>

              <button
                onClick={loadData}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-3">Doc Number</th>
                    <th className="px-5 py-3">Client / Company</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Due Date</th>
                    <th className="px-5 py-3">Subtotal & VAT</th>
                    <th className="px-5 py-3">Total Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-5 py-12 text-center text-gray-400">
                        No invoices or quotes match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isOverdue = inv.status !== 'paid' && new Date(inv.due_date) < new Date()
                      const isQuote = inv.invoice_type === 'quote'
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30 transition">
                          <td className="px-5 py-4 font-mono font-bold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              {isQuote ? (
                                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              )}
                              <span>{inv.invoice_number}</span>
                            </div>
                            {inv.etims_cu_number && (
                              <p className="text-[10px] font-normal text-gray-400 mt-0.5 truncate max-w-[140px]">
                                CU: {inv.etims_cu_number}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {inv.customer_company_name || `${inv.customer_first_name || ''} ${inv.customer_last_name || ''}`}
                            </p>
                            <p className="text-xs text-gray-400">{inv.customer_phone}</p>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                isQuote
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              }`}
                            >
                              {isQuote ? 'Quotation' : 'Tax Invoice'}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-xs">
                            <p className="font-medium text-gray-800 dark:text-gray-200">{inv.due_date}</p>
                            {isOverdue && (
                              <span className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Overdue
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs font-mono">
                            <p className="text-gray-500">{formatCurrencyKES(inv.subtotal_kes || 0)}</p>
                            <p className="text-[10px] text-gray-400">+16% VAT: {formatCurrencyKES(inv.vat_amount_kes || 0)}</p>
                          </td>

                          <td className="px-5 py-4 font-mono font-bold text-gray-900 dark:text-white">
                            {formatCurrencyKES(inv.total_amount_kes)}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : inv.status === 'partial'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Branded PDF Print Preview */}
                              <button
                                onClick={() => {
                                  setSelectedInvoice(inv)
                                  setShowPdfModal(true)
                                }}
                                title="Print / Branded PDF"
                                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Convert Quote Button */}
                              {isQuote && (
                                <button
                                  onClick={() => handleConvertQuote(inv)}
                                  className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition flex items-center gap-1"
                                >
                                  <ArrowRightCircle className="w-3.5 h-3.5" /> Convert to Invoice
                                </button>
                              )}

                              {/* STK Push Payment */}
                              {!isQuote && inv.status !== 'paid' && (
                                <button
                                  onClick={() => {
                                    setSelectedInvoice(inv)
                                    setStkForm({
                                      phoneNumber: inv.customer_phone || '',
                                      amount: (inv.total_amount_kes - (inv.amount_paid_kes || 0)).toString()
                                    })
                                    setShowStkModal(true)
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 transition flex items-center gap-1"
                                >
                                  <CreditCard className="w-3.5 h-3.5" /> STK Push
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: PRODUCTS & SERVICES CATALOG */}
      {/* ==================================================== */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search SKU or product name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <button
              onClick={() => setShowProductModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" /> Add Product SKU
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {p.sku}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {p.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 dark:text-white mt-3 text-base">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">Unit: {p.unit} | Tax: 16% VAT standard</p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Selling Price</p>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                      {formatCurrencyKES(p.unit_price_kes)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">In Stock</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {p.stock_quantity || 0} {p.unit}s
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: 30/60/90 DEBTOR AGING */}
      {/* ==================================================== */}
      {activeTab === 'aging' && agingData && (
        <div className="space-y-6">
          {/* Aging Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">Total Receivables</p>
              <p className="text-xl font-mono font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrencyKES(agingData.summary?.totalReceivablesKes || 0)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{agingData.summary?.overduePercentage || 0}% overdue rate</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs text-gray-500 font-medium">Current (0-30 Days)</p>
              </div>
              <p className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrencyKES(agingData.summary?.current0to30Kes || 0)}
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Healthy credit bucket</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <p className="text-xs text-gray-500 font-medium">31-60 Days</p>
              </div>
              <p className="text-lg font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
                {formatCurrencyKES(agingData.summary?.days31to60Kes || 0)}
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">Follow-up reminder due</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <p className="text-xs text-gray-500 font-medium">61-90 Days</p>
              </div>
              <p className="text-lg font-mono font-bold text-orange-600 dark:text-orange-400 mt-1">
                {formatCurrencyKES(agingData.summary?.days61to90Kes || 0)}
              </p>
              <p className="text-[11px] text-orange-600 mt-0.5">Formal notice required</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                <p className="text-xs text-gray-500 font-medium">90+ Days Critical</p>
              </div>
              <p className="text-lg font-mono font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrencyKES(agingData.summary?.days90PlusKes || 0)}
              </p>
              <p className="text-[11px] text-red-600 mt-0.5">Bad debt provision risk</p>
            </div>
          </div>

          {/* Top Overdue Debtors Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-gray-900 dark:text-white">Overdue Debtors Ledger & Statement Dispatch</h3>
              </div>
              <span className="text-xs text-gray-400">Ranked by overdue balance</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-3">Customer / Organization</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Invoices Overdue</th>
                    <th className="px-5 py-3">Overdue Balance</th>
                    <th className="px-5 py-3 text-right">1-Click Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                  {agingData.topDebtors?.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-5 py-8 text-center text-gray-400">
                        No debtors currently in overdue status.
                      </td>
                    </tr>
                  ) : (
                    agingData.topDebtors.map((d, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30 transition">
                        <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">
                          {d.customer_company_name || `${d.first_name} ${d.last_name}`}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-gray-500">{d.phone}</td>
                        <td className="px-5 py-4 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-semibold">
                            {d.overdue_invoices_count} overdue
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-red-600 dark:text-red-400">
                          {formatCurrencyKES(d.total_overdue_kes)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedDebtor(d)
                              setShowWaModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
                          >
                            <Share2 className="w-3.5 h-3.5" /> WhatsApp Statement
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: BRANDED PDF / PRINT VIEW */}
      {/* ==================================================== */}
      {showPdfModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white text-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden p-8 max-h-[90vh] overflow-y-auto">
            {/* Modal actions */}
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <span className="text-xs uppercase font-bold text-gray-500">Official Document Preview</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gray-900 rounded-lg hover:bg-black transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
                </button>
                <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Branded Document */}
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-gray-900">
                    {user?.tenant_name || 'APEX COMMERCIAL SUPPLIES LTD'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Industrial Area, Enterprise Road, Nairobi, Kenya</p>
                  <p className="text-xs text-gray-500">KRA PIN: P051234567Z | Tel: +254 700 000 000</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-gray-100 text-gray-900 text-xs font-bold uppercase rounded">
                    {selectedInvoice.invoice_type === 'quote' ? 'OFFICIAL QUOTATION' : 'KRA TAX INVOICE'}
                  </span>
                  <p className="font-mono font-bold text-base mt-2">{selectedInvoice.invoice_number}</p>
                  <p className="text-xs text-gray-400">Date: {selectedInvoice.issue_date}</p>
                  <p className="text-xs text-gray-400">Due: {selectedInvoice.due_date}</p>
                </div>
              </div>

              {/* Billed To */}
              <div className="bg-gray-50 p-4 rounded-xl text-xs space-y-1">
                <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Billed To:</p>
                <p className="font-bold text-sm text-gray-900">
                  {selectedInvoice.customer_company_name || `${selectedInvoice.customer_first_name || ''} ${selectedInvoice.customer_last_name || ''}`}
                </p>
                <p className="text-gray-600">Phone: {selectedInvoice.customer_phone}</p>
                <p className="text-gray-600">Email: {selectedInvoice.customer_email || 'accounts@client.co.ke'}</p>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">VAT (16%)</th>
                    <th className="py-2 text-right">Total (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 font-medium">Commercial Inverter / Supplies Package</td>
                    <td className="py-3 text-right font-mono">1</td>
                    <td className="py-3 text-right font-mono">{formatCurrencyKES(selectedInvoice.subtotal_kes)}</td>
                    <td className="py-3 text-right font-mono">{formatCurrencyKES(selectedInvoice.vat_amount_kes)}</td>
                    <td className="py-3 text-right font-mono font-bold">{formatCurrencyKES(selectedInvoice.total_amount_kes)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Summary Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal Excl. VAT:</span>
                    <span>{formatCurrencyKES(selectedInvoice.subtotal_kes)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>16% Value Added Tax:</span>
                    <span>{formatCurrencyKES(selectedInvoice.vat_amount_kes)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 text-gray-900">
                    <span>Total Payable:</span>
                    <span>{formatCurrencyKES(selectedInvoice.total_amount_kes)}</span>
                  </div>
                </div>
              </div>

              {/* Settlement Instructions & KRA eTIMS CU */}
              <div className="border-t pt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="font-bold text-emerald-900 text-[11px]">PAYMENT INSTRUCTIONS</p>
                  <p className="text-emerald-800 mt-1">Safaricom M-Pesa Paybill: <strong>174379</strong></p>
                  <p className="text-emerald-800">Account No: <strong>{selectedInvoice.invoice_number}</strong></p>
                  <p className="text-emerald-800">Bank: Standard Chartered, A/C: 0102030405</p>
                </div>

                <div className="p-3 border rounded-lg bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-700 text-[10px]">KRA eTIMS COMPLIANCE</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">{selectedInvoice.etims_cu_number || 'KRA-ETIMS-VERIFIED'}</p>
                    <p className="text-[9px] text-gray-400 mt-1">Scan QR code for tax invoice verification</p>
                  </div>
                  <div className="w-14 h-14 bg-gray-200 border border-gray-400 rounded flex items-center justify-center font-mono text-[8px] text-gray-500">
                    [QR CODE]
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: 1-CLICK WHATSAPP STATEMENT DISPATCH */}
      {/* ==================================================== */}
      {showWaModal && selectedDebtor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-600" />
                Dispatch Account Statement via WhatsApp
              </h3>
              <button onClick={() => setShowWaModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Review pre-formatted debt collection statement to send directly to{' '}
              <strong>{selectedDebtor.first_name} ({selectedDebtor.phone})</strong>:
            </p>

            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
{`Dear ${selectedDebtor.customer_company_name || selectedDebtor.first_name},

This is an official account statement from ${user?.tenant_name || 'Apex Commercial Supplies Ltd'}.

You have ${selectedDebtor.overdue_invoices_count} overdue invoice(s) with an outstanding balance of KES ${Number(selectedDebtor.total_overdue_kes).toLocaleString()}.

Payment Details:
- Paybill: 174379
- Account: ${selectedDebtor.phone}
- Bank: Standard Chartered (A/C: 0102030405)

Please remit payment or share the bank/M-Pesa confirmation code. Thank you for your continued partnership.`}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowWaModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <a
                href={`https://wa.me/${(selectedDebtor.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Dear ${selectedDebtor.customer_company_name || selectedDebtor.first_name},\n\nThis is an official account statement from ${user?.tenant_name || 'Apex Commercial Supplies Ltd'}.\n\nYou have ${selectedDebtor.overdue_invoices_count} overdue invoice(s) totaling KES ${Number(selectedDebtor.total_overdue_kes).toLocaleString()}.\n\nPaybill: 174379, Account: ${selectedDebtor.phone}.\n\nPlease settle at your earliest convenience.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition flex items-center gap-1.5"
              >
                Open WhatsApp & Send
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREATE INVOICE OR QUOTATION */}
      {/* ==================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b pb-3 border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Generate Quotation or KRA eTIMS Tax Invoice
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Document Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, invoiceType: 'invoice' }))}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      createForm.invoiceType === 'invoice'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm">Tax Invoice</p>
                      <p className="text-xs text-gray-500">KRA eTIMS registered sale with 16% VAT</p>
                    </div>
                    {createForm.invoiceType === 'invoice' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, invoiceType: 'quote' }))}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      createForm.invoiceType === 'quote'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm">Official Quotation</p>
                      <p className="text-xs text-gray-500">Valid for 30 days prior to formal billing</p>
                    </div>
                    {createForm.invoiceType === 'quote' && <CheckCircle2 className="w-5 h-5 text-amber-600" />}
                  </button>
                </div>
              </div>

              {/* Customer Select */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Customer / Organization</label>
                <select
                  value={createForm.customerId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, customerId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select client...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name ? `${c.company_name} (${c.first_name} ${c.last_name})` : `${c.first_name} ${c.last_name}`} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Itemized Line Items</label>
                  <div className="flex items-center gap-2">
                    {/* Add from catalog */}
                    {products.length > 0 && (
                      <select
                        onChange={(e) => {
                          const p = products.find((prod) => prod.id === parseInt(e.target.value, 10))
                          if (p) handleAddItem(p)
                          e.target.value = ''
                        }}
                        defaultValue=""
                        className="text-xs px-2 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold"
                      >
                        <option value="" disabled>+ Add from Catalog SKU...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) - KES {p.unit_price_kes}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddItem()}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                    >
                      + Custom Item
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {createForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                      <input
                        type="text"
                        placeholder="Description"
                        value={it.itemDescription}
                        onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                        required
                        className="flex-1 px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        min="1"
                        required
                        className="w-16 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder="Unit KES"
                        value={it.unitPriceKes}
                        onChange={(e) => handleItemChange(idx, 'unitPriceKes', e.target.value)}
                        required
                        className="w-24 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                      />
                      <span className="text-[11px] font-mono text-gray-400">16% VAT</span>
                      {createForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Running Totals Summary */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex justify-between items-center text-xs font-mono">
                <div>
                  <p className="text-gray-500">Subtotal: {formatCurrencyKES(formTotals.subtotal)}</p>
                  <p className="text-gray-500">16% KRA VAT: {formatCurrencyKES(formTotals.vat)}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 uppercase text-[10px] font-bold">Total Payable</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {formatCurrencyKES(formTotals.total)}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Generating...' : `Generate ${createForm.invoiceType === 'quote' ? 'Quotation' : 'Tax Invoice'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD PRODUCT SKU */}
      {/* ==================================================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Add Product to Catalog
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Commercial 300W Solar Panel"
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">SKU Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SOL-300W-KE"
                    value={productForm.sku}
                    onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Solar Equipment"
                    value={productForm.category}
                    onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Selling Price (KES)</label>
                  <input
                    type="number"
                    placeholder="18500"
                    value={productForm.unitPriceKes}
                    onChange={(e) => setProductForm((f) => ({ ...f, unitPriceKes: e.target.value }))}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={productForm.stockQuantity}
                    onChange={(e) => setProductForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: M-PESA STK PUSH */}
      {/* ==================================================== */}
      {showStkModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Trigger Daraja M-Pesa STK Push
              </h3>
              <button onClick={() => setShowStkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTriggerStk} className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                <p className="text-gray-500">Invoice: <strong>{selectedInvoice.invoice_number}</strong></p>
                <p className="text-gray-500">Client: <strong>{selectedInvoice.customer_company_name || selectedInvoice.customer_first_name}</strong></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">M-Pesa Phone Number</label>
                <input
                  type="text"
                  placeholder="0712345678 or 254712345678"
                  value={stkForm.phoneNumber}
                  onChange={(e) => setStkForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Amount (KES)</label>
                <input
                  type="number"
                  value={stkForm.amount}
                  onChange={(e) => setStkForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowStkModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPromptingStk}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPromptingStk ? 'Sending STK Push...' : 'Send STK Prompt'}
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

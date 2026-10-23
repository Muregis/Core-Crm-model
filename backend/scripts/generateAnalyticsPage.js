const fs = require('fs');
const path = require('path');

const analyticsComponent = `// Analytics.jsx
// Executive Analytics & Productivity Return Dashboard for Board Meetings, Staff Appraisals, Layoff / Bonus Decisions, and Expenditure ROI.
import React, { useEffect, useState, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Search,
  Printer,
  Building,
  Scale,
  Briefcase,
  Calendar,
  ChevronRight,
  Trash2,
  Landmark,
  ShieldAlert,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileText,
  UserCheck
} from 'lucide-react'
import { analyticsService } from '../services/analyticsService'
import { userService } from '../services/userService'
import { formatCurrencyKES } from '../utils/formatters'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const EXPENSE_CATEGORIES = [
  { key: 'payroll', label: 'Payroll & Staff Salaries', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  { key: 'marketing_leads', label: 'Marketing & Lead Generation', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  { key: 'operations_logistics', label: 'Operations, Fuel & Logistics', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
  { key: 'commissions', label: 'Commissions & Performance Incentives', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' },
  { key: 'legal_regulatory', label: 'Regulatory, LCB & Filing Fees', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
  { key: 'office_overhead', label: 'Office Rent, Technology & Overhead', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  { key: 'other', label: 'Other Operating Expenses', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' }
]

const Analytics = () => {
  const { user } = useAuthStore()
  const industry = user?.tenant_industry || 'general'

  const [activeTab, setActiveTab] = useState('productivity') // 'productivity' | 'expenses' | 'trends' | 'industry'
  const [overviewData, setOverviewData] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [hrFilter, setHrFilter] = useState('all') // 'all' | 'bonus' | 'retain' | 'at_risk'
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)

  const [expenseForm, setExpenseForm] = useState({
    category: 'operations_logistics',
    title: '',
    amountKes: '',
    expenseDate: new Date().toISOString().split('T')[0],
    assignedUserId: '',
    paymentMethod: 'mpesa_b2b',
    receiptRef: '',
    notes: ''
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [overviewRes, expensesRes, usersRes] = await Promise.all([
        analyticsService.getOverview().catch(() => ({ data: { success: false } })),
        analyticsService.getExpenses().catch(() => ({ data: { success: false } })),
        userService.getUsers().catch(() => ({ data: { success: false } }))
      ])

      if (overviewRes.data?.success) {
        setOverviewData(overviewRes.data.data)
      }
      if (expensesRes.data?.success) {
        setExpenses(expensesRes.data.data.expenses || [])
      }
      if (usersRes.data?.success) {
        setTeamMembers(usersRes.data.data.users || [])
      }
    } catch (err) {
      toast.error('Failed to load analytics overview')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered staff productivity leaderboard
  const filteredStaff = useMemo(() => {
    const list = overviewData?.staffProductivityLeaderboard || []
    return list.filter((s) => {
      const matchSearch = \`\${s.name} \${s.email} \${s.role}\`.toLowerCase().includes(searchTerm.toLowerCase())
      let matchHr = true
      if (hrFilter === 'bonus') matchHr = s.actionTag === 'Bonus Recommended'
      else if (hrFilter === 'retain') matchHr = s.actionTag === 'Retain & Expand' || s.actionTag === 'Retain & Grow'
      else if (hrFilter === 'at_risk') matchHr = s.actionTag === 'At-Risk / Restructure' || s.roiMultiplier < 0.8
      return matchSearch && matchHr
    })
  }, [overviewData, searchTerm, hrFilter])

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const text = \`\${e.title} \${e.category} \${e.staff_name || ''} \${e.receipt_ref || ''}\`.toLowerCase()
      return text.includes(searchTerm.toLowerCase())
    })
  }, [expenses, searchTerm])

  const handleCreateExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.title || !expenseForm.amountKes) {
      toast.error('Please fill in title and amount in KES')
      return
    }

    try {
      await analyticsService.createExpense({
        ...expenseForm,
        amountKes: parseFloat(expenseForm.amountKes),
        assignedUserId: expenseForm.assignedUserId ? parseInt(expenseForm.assignedUserId, 10) : null
      })
      toast.success('Expenditure logged successfully')
      setShowAddExpenseModal(false)
      setExpenseForm({
        category: 'operations_logistics',
        title: '',
        amountKes: '',
        expenseDate: new Date().toISOString().split('T')[0],
        assignedUserId: '',
        paymentMethod: 'mpesa_b2b',
        receiptRef: '',
        notes: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record expense')
    }
  }

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expenditure entry?')) return
    try {
      await analyticsService.deleteExpense(id)
      toast.success('Expenditure removed')
      loadData()
    } catch {
      toast.error('Failed to delete expenditure')
    }
  }

  const handlePrintReport = () => {
    window.print()
  }

  const financial = overviewData?.financialSummary || {
    grossRevenueKes: 0,
    totalExpenditureKes: 0,
    netProfitKes: 0,
    netMarginPercent: 0,
    roiMultiplier: '1.00',
    pipelineValueKes: 0
  }

  const industryMetrics = overviewData?.industryMetrics || {}

  return (
    <div className="space-y-6 print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Executive Analytics & Productivity Return
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
              {industry === 'legal' ? 'Legal Practice P&L' : industry === 'real_estate' ? 'Real Estate P&L' : 'Commercial Core P&L'}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            Boardroom financial returns, expenditure tracking, staff productivity ROI, and performance appraisals for bonuses or restructuring.
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center px-3.5 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold shadow-xs transition"
            title="Print or Export PDF for Board / Management Meeting"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Boardroom Brief (Print)
          </button>

          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Expenditure
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards: P&L and Net Margin */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Gross Inflows</span>
            <span className="text-emerald-600 flex items-center text-[11px] font-mono">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> Revenue
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-2">
            {formatCurrencyKES(financial.grossRevenueKes)}
          </p>
          <div className="mt-2 text-xs text-gray-400 flex items-center justify-between">
            <span>Pipeline: {formatCurrencyKES(financial.pipelineValueKes)}</span>
            <span className="font-semibold text-gray-600 dark:text-gray-300">{financial.wonDealsCount || 0} Won</span>
          </div>
        </div>

        {/* Operating Expenditure (OPEX) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-600 uppercase tracking-wider">
            <span>Total Expenditure (OPEX)</span>
            <span className="text-rose-500 flex items-center text-[11px] font-mono">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> Costs
            </span>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">
            {formatCurrencyKES(financial.totalExpenditureKes)}
          </p>
          <div className="mt-2 text-xs text-gray-400 flex items-center justify-between">
            <span>Payroll, Marketing & Logistics</span>
            <span className="font-semibold text-gray-600 dark:text-gray-300">{expenses.length} Records</span>
          </div>
        </div>

        {/* Net Profit & Margin */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-primary-600 uppercase tracking-wider">
            <span>Net Operating Margin</span>
            <span className={\`text-xs font-bold px-2 py-0.5 rounded-full \${financial.netProfitKes >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800'}\`}>
              {financial.netMarginPercent}% Net
            </span>
          </div>
          <p className={\`text-2xl font-black mt-2 \${financial.netProfitKes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}\`}>
            {formatCurrencyKES(financial.netProfitKes)}
          </p>
          <div className="mt-2 text-xs text-gray-400">
            <span>Net cash contribution after all operating costs</span>
          </div>
        </div>

        {/* Productivity Return Multiplier */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-amber-600 uppercase tracking-wider">
            <span>Productivity Return</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
              ROI Factor
            </span>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">
            {financial.roiMultiplier}x
          </p>
          <div className="mt-2 text-xs text-gray-400">
            <span>Return generated for every KES 1.00 spent</span>
          </div>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 print:hidden">
        <button
          onClick={() => setActiveTab('productivity')}
          className={\`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition \${
            activeTab === 'productivity'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }\`}
        >
          <Users className="w-4 h-4" />
          Staff Productivity & HR Decision Matrix
          <span className="px-2 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300 font-bold">
            {overviewData?.staffProductivityLeaderboard?.length || 0} Staff
          </span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={\`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition \${
            activeTab === 'expenses'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }\`}
        >
          <DollarSign className="w-4 h-4" />
          Operating Expenditures (OPEX)
          <span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold">
            {expenses.length} Logged
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trends')}
          className={\`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition \${
            activeTab === 'trends'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }\`}
        >
          <BarChart3 className="w-4 h-4" />
          6-Month Cash Flow & Net Margin Trajectory
        </button>

        <button
          onClick={() => setActiveTab('industry')}
          className={\`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition \${
            activeTab === 'industry'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }\`}
        >
          {industry === 'legal' ? <Scale className="w-4 h-4" /> : industry === 'real_estate' ? <Building className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
          {industry === 'legal' ? 'Legal Operations & Billable Realization' : industry === 'real_estate' ? 'Estate Land Inventory & Turnover' : 'Commercial Velocity & Inventory'}
        </button>
      </div>

      {/* TAB 1: STAFF PRODUCTIVITY & HR DECISION MATRIX */}
      {activeTab === 'productivity' && (
        <div className="space-y-4">
          {/* Executive Strategy Banner for Layoffs vs Bonuses */}
          <div className="bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-emerald-900/10 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                  Executive Staff Productivity & Appraisal Decision Matrix
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Provides quantitative, audit-backed metrics on individual return on investment. Enables fair allocation of quarterly performance bonuses for top revenue earners, identifies coaching candidates, and surfaces loss-making positions for restructuring.
                </p>
              </div>
            </div>

            {/* HR Filter Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap print:hidden">
              <button
                onClick={() => setHrFilter('all')}
                className={\`px-2.5 py-1 text-xs rounded-lg font-bold transition \${hrFilter === 'all' ? 'bg-primary-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}\`}
              >
                All Staff
              </button>
              <button
                onClick={() => setHrFilter('bonus')}
                className={\`px-2.5 py-1 text-xs rounded-lg font-bold transition \${hrFilter === 'bonus' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'}\`}
              >
                🌟 Bonus Candidates
              </button>
              <button
                onClick={() => setHrFilter('at_risk')}
                className={\`px-2.5 py-1 text-xs rounded-lg font-bold transition \${hrFilter === 'at_risk' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}\`}
              >
                ⚠️ At-Risk / Layoff Review
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs print:hidden">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search staff by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-gray-100"
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

          {/* Staff Leaderboard Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-950 text-[11px] uppercase font-bold text-gray-500 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3.5">Employee & Role</th>
                    <th className="px-4 py-3.5">Won Revenue (KES)</th>
                    <th className="px-4 py-3.5">Allocated Cost (KES)</th>
                    <th className="px-4 py-3.5">Net Contribution (KES)</th>
                    <th className="px-4 py-3.5">ROI Multiplier</th>
                    <th className="px-4 py-3.5">Activity (Tasks/Comms)</th>
                    <th className="px-4 py-3.5">Appraisal Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredStaff.map((s) => {
                    const isPositive = s.netContributionKes >= 0
                    const isStar = s.actionTag === 'Bonus Recommended'
                    const isRisk = s.actionTag === 'At-Risk / Restructure'

                    return (
                      <tr
                        key={s.id}
                        className={\`hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition \${isStar ? 'bg-purple-50/20 dark:bg-purple-950/10' : isRisk ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''}\`}
                      >
                        {/* Employee & Role */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-gray-400 capitalize">
                                {s.role.replace('_', ' ')} • {s.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Won Revenue */}
                        <td className="px-4 py-3.5 font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                          {formatCurrencyKES(s.wonRevenueKes)}
                          <div className="text-[10px] font-normal text-gray-400">
                            {s.wonCount} won deals
                          </div>
                        </td>

                        {/* Direct / Allocated Cost */}
                        <td className="px-4 py-3.5 font-mono text-rose-600 font-semibold">
                          {formatCurrencyKES(s.allocatedCostKes)}
                          <div className="text-[10px] text-gray-400 font-normal">
                            Salary & expenses
                          </div>
                        </td>

                        {/* Net Contribution */}
                        <td className="px-4 py-3.5 font-mono font-black text-sm">
                          <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                            {formatCurrencyKES(s.netContributionKes)}
                          </span>
                        </td>

                        {/* ROI Multiplier */}
                        <td className="px-4 py-3.5">
                          <span
                            className={\`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono \${
                              s.roiMultiplier >= 3.0
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : s.roiMultiplier >= 1.5
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : s.roiMultiplier >= 0.8
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }\`}
                          >
                            {s.roiMultiplier}x Return
                          </span>
                        </td>

                        {/* Activity */}
                        <td className="px-4 py-3.5 text-gray-500">
                          <div className="font-semibold text-gray-800 dark:text-gray-200">
                            {s.completedTasks} Tasks
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {s.loggedCommunications} Client Comms
                          </div>
                        </td>

                        {/* Appraisal Decision & Guidance */}
                        <td className="px-4 py-3.5">
                          <div>
                            <span
                              className={\`inline-block text-[11px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider \${
                                isStar
                                  ? 'bg-purple-600 text-white'
                                  : isRisk
                                  ? 'bg-rose-600 text-white'
                                  : s.tier === 'Executive Leadership'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-emerald-600 text-white'
                              }\`}
                            >
                              {s.actionTag}
                            </span>
                            <p className="text-[10px] text-gray-400 mt-1 line-clamp-1 max-w-[200px]" title={s.hrRecommendation}>
                              {s.hrRecommendation}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPERATING EXPENDITURES (OPEX) BREAKDOWN & REGISTER */}
      {activeTab === 'expenses' && (
        <div className="space-y-5">
          {/* Category Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {EXPENSE_CATEGORIES.map((cat) => {
              const amount = overviewData?.expenditureBreakdown?.[cat.key] || 0
              return (
                <div
                  key={cat.key}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-xs space-y-1"
                >
                  <span className="text-[10px] font-bold uppercase text-gray-400 block truncate">
                    {cat.label.split(' ')[0]}
                  </span>
                  <div className="text-base font-black text-gray-900 dark:text-gray-100">
                    {formatCurrencyKES(amount)}
                  </div>
                  <span className={\`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block truncate max-w-full \${cat.color}\`}>
                    {cat.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Expenses Ledger Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search expenses by title, staff, or receipt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-gray-100"
              />
            </div>

            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Expense Entry
            </button>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-950 text-[11px] uppercase font-bold text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Expense Title & Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Assigned Staff Member</th>
                  <th className="px-4 py-3">Payment & Receipt</th>
                  <th className="px-4 py-3 text-right">Amount (KES)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {new Date(exp.expense_date).toLocaleDateString('en-KE')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {exp.title}
                      {exp.notes && (
                        <div className="text-[10px] text-gray-400 font-normal truncate max-w-xs">
                          {exp.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 capitalize">
                        {exp.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 font-medium">
                      {exp.staff_name || 'General Overhead'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span className="capitalize">{exp.payment_method?.replace('_', ' ')}</span>
                      {exp.receipt_ref && <span className="text-gray-400 block text-[10px]">{exp.receipt_ref}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-rose-600 text-sm">
                      {formatCurrencyKES(exp.amount_kes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 text-gray-400 hover:text-rose-600 transition"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: 6-MONTH CASH FLOW & NET PROFIT TRAJECTORY */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                6-Month Financial Performance & Net Margin Trajectory
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Tracks monthly gross revenue collections against operating expenditure to demonstrate firm cash generation capacity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(overviewData?.monthlyTrends || []).map((m) => (
                <div
                  key={m.month}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="font-bold text-xs uppercase text-gray-700 dark:text-gray-300">
                      {m.month}
                    </span>
                    <span
                      className={\`text-[11px] font-bold px-2 py-0.5 rounded-full \${
                        m.netProfitKes >= 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800'
                      }\`}
                    >
                      {m.revenueKes > 0 ? Math.round((m.netProfitKes / m.revenueKes) * 100) : 0}% Net
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Gross Inflow:</span>
                      <span className="font-mono font-bold text-emerald-600">{formatCurrencyKES(m.revenueKes)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Expenditure Outflow:</span>
                      <span className="font-mono text-rose-600 font-semibold">{formatCurrencyKES(m.expenditureKes)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-200/60 dark:border-gray-700">
                      <span className="font-bold text-gray-700 dark:text-gray-200">Net Profit:</span>
                      <span className="font-mono font-black text-gray-900 dark:text-gray-100 text-sm">
                        {formatCurrencyKES(m.netProfitKes)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INDUSTRY OPERATIONS & INVENTORY VELOCITY */}
      {activeTab === 'industry' && (
        <div className="space-y-6">
          {industry === 'real_estate' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-600" />
                  Real Estate Land Inventory & Plot Sales Velocity
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Live plot matrix status distribution, acreage turnover velocity, and ArdhiSasa regulatory conveyancing filings.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Available Plots (Green)</span>
                  <p className="text-3xl font-black text-emerald-600 mt-1">{industryMetrics.realEstate?.availablePlots || 0}</p>
                  <span className="text-[11px] text-gray-400">Ready for instant sale & LOO</span>
                </div>

                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Reserved on Hold (Yellow)</span>
                  <p className="text-3xl font-black text-amber-600 mt-1">{industryMetrics.realEstate?.reservedPlots || 0}</p>
                  <span className="text-[11px] text-gray-400">48h deposit countdown active</span>
                </div>

                <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-xl">
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase">Sold & Closed (Red)</span>
                  <p className="text-3xl font-black text-rose-600 mt-1">{industryMetrics.realEstate?.soldPlots || 0}</p>
                  <span className="text-[11px] text-gray-400">Title deeds transferred</span>
                </div>

                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl">
                  <span className="text-xs font-bold text-primary-800 dark:text-primary-300 uppercase">Total Estate Valuation</span>
                  <p className="text-2xl font-black text-primary-600 mt-1">{formatCurrencyKES(industryMetrics.realEstate?.inventoryValuationKes || 0)}</p>
                  <span className="text-[11px] text-gray-400">{industryMetrics.realEstate?.activeConveyancingFiles || 0} ArdhiSasa files active</span>
                </div>
              </div>
            </div>
          )}

          {industry === 'legal' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary-600" />
                  Legal Practice Realization & Fee Earner Productivity
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Advocates Act (Cap 16) fee recovery, billable hours tracking, and court litigation velocity.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-gray-500 uppercase">Active Retainers & Briefs</span>
                  <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{industryMetrics.legal?.activeMattersCount || 0}</p>
                  <span className="text-[11px] text-gray-400">High Court & ELC litigation</span>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-primary-600 uppercase">Billable Hours Logged</span>
                  <p className="text-3xl font-black text-primary-600 mt-1">{industryMetrics.legal?.billableHoursLogged || 0} hrs</p>
                  <span className="text-[11px] text-gray-400">Recorded across advocates</span>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-emerald-600 uppercase">Time Entries Billed</span>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrencyKES(industryMetrics.legal?.totalBilledKes || 0)}</p>
                  <span className="text-[11px] text-gray-400">Order 11 & trial prep</span>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-amber-600 uppercase">Average Retainer Value</span>
                  <p className="text-2xl font-black text-amber-600 mt-1">{formatCurrencyKES(industryMetrics.legal?.averageRetainerValueKes || 0)}</p>
                  <span className="text-[11px] text-gray-400">Per commercial instruction</span>
                </div>
              </div>
            </div>
          )}

          {industry === 'general' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary-600" />
                  Commercial Core Product Catalog & Cash Conversion Efficiency
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  B2B supply orders, SKU warehouse valuation, and invoice cash collection velocity.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-gray-500 uppercase">Active Catalog SKUs</span>
                  <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{industryMetrics.commercial?.catalogSkusCount || 0}</p>
                  <span className="text-[11px] text-gray-400">FMCG & Industrial lines</span>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-primary-600 uppercase">Inventory Valuation</span>
                  <p className="text-2xl font-black text-primary-600 mt-1">{formatCurrencyKES(industryMetrics.commercial?.warehouseInventoryValuationKes || 0)}</p>
                  <span className="text-[11px] text-gray-400">Warehouse stock on hand</span>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-emerald-600 uppercase">Average Order Value</span>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrencyKES(industryMetrics.commercial?.averageOrderValueKes || 0)}</p>
                  <span className="text-[11px] text-gray-400">Per won corporate contract</span>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <span className="text-xs font-bold text-amber-600 uppercase">Collection Efficiency</span>
                  <p className="text-3xl font-black text-amber-600 mt-1">{industryMetrics.commercial?.cashCollectionEfficiency || 0}%</p>
                  <span className="text-[11px] text-gray-400">Invoices settled via M-Pesa/Bank</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Record New Expenditure */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-rose-600" />
                  Record Operating Expenditure
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Log operational cost, salary, or overhead for ROI calculation.</p>
              </div>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Expense Category *
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Expense Title / Payee *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grace Njeri - Field Sales Fuel & Tour Guide Allowance"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Amount (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 75000"
                    value={expenseForm.amountKes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amountKes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Assign to Staff (For ROI Attribution)
                  </label>
                  <select
                    value={expenseForm.assignedUserId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">General Company Overhead</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Payment Method
                  </label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="mpesa_b2b">M-Pesa B2B / Till</option>
                    <option value="bank_transfer">Bank Wire / EFT</option>
                    <option value="petty_cash">Petty Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Receipt / Transaction Ref Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. MPESA-Q4-88124 or INV-SUP-2026"
                  value={expenseForm.receiptRef}
                  onChange={(e) => setExpenseForm({ ...expenseForm, receiptRef: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Notes / Justification
                </label>
                <textarea
                  rows={2}
                  placeholder="Details, invoice vouchers, approval notes..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Analytics
`;

const targetPath = path.join(__dirname, '../../frontend/src/pages/Analytics.jsx');
fs.writeFileSync(targetPath, analyticsComponent, 'utf8');
console.log('Successfully wrote Analytics.jsx to:', targetPath);

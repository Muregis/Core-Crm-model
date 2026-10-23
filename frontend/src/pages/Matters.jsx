// Matters.jsx
// Legal Practice Edition: Kenyan Constitution 2010 (Chapter 10, Arts. 159-173) & Advocates Act (Cap 16) compliant case management.
import React, { useEffect, useState, useMemo } from 'react'
import {
  Scale,
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Gavel,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Landmark,
  ShieldCheck,
  Award,
  BookOpen
} from 'lucide-react'
import { matterService } from '../services/matterService'
import { customerService } from '../services/customerService'
import { formatCurrencyKES } from '../utils/formatters'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

export const PRACTICE_AREAS = [
  'Commercial Litigation',
  'Conveyancing & Land Law',
  'Constitutional & Judicial Review',
  'Corporate & M&A',
  'Employment & Labour Relations',
  'Family & Succession Law',
  'Tax Advisory & Dispute',
  'Banking & Securities Enforcement',
  'Arbitration & ADR',
  'Criminal Defense & Anti-Corruption'
]

// Exact hierarchy mandated by Chapter 10 of the Constitution of Kenya 2010
export const KENYAN_COURT_GROUPS = [
  {
    category: 'Superior Courts of Record (Articles 162-165, CoK 2010)',
    badge: 'Superior Court',
    courts: [
      {
        name: 'Supreme Court of Kenya (SCORK)',
        article: 'CoK 2010 Art. 163',
        division: 'Apex Court',
        defaultPreset: 'SCORK PETITION NO. E001 OF 2026',
        coramPrefix: 'Hon. Justice [Name], SCJ'
      },
      {
        name: 'Court of Appeal of Kenya (COA)',
        article: 'CoK 2010 Art. 164',
        division: 'Appellate Jurisdiction',
        defaultPreset: 'COA CIVIL APPEAL NO. E001 OF 2026',
        coramPrefix: 'Hon. Justice [Name], JA'
      },
      {
        name: 'High Court Commercial & Tax Division',
        article: 'CoK 2010 Art. 165',
        division: 'Commercial & Tax',
        defaultPreset: 'HCCC NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      },
      {
        name: 'High Court Constitutional & Human Rights Division',
        article: 'CoK 2010 Art. 165(3)(b)',
        division: 'Constitutional',
        defaultPreset: 'PETITION NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      },
      {
        name: 'High Court Judicial Review Division',
        article: 'CoK 2010 Art. 165(6)',
        division: 'Judicial Review',
        defaultPreset: 'HCJR APPLICATION NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      },
      {
        name: 'High Court Family & Administration of Estates Division',
        article: 'CoK 2010 Art. 165 & Cap 160',
        division: 'Family & Succession',
        defaultPreset: 'SUCCESSION CAUSE NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      },
      {
        name: 'High Court Anti-Corruption & Economic Crimes Division',
        article: 'CoK 2010 Art. 165 & ACECA',
        division: 'Anti-Corruption',
        defaultPreset: 'ACEC MISC. APPLICATION NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      },
      {
        name: 'High Court Civil Division',
        article: 'CoK 2010 Art. 165',
        division: 'Civil',
        defaultPreset: 'HCCC NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      },
      {
        name: 'Environment and Land Court (ELC)',
        article: 'CoK 2010 Art. 162(2)(b)',
        division: 'Land & Environment',
        defaultPreset: 'ELC NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      },
      {
        name: 'Employment and Labour Relations Court (ELRC)',
        article: 'CoK 2010 Art. 162(2)(a)',
        division: 'Labour & Employment',
        defaultPreset: 'ELRC CAUSE NO. E001 OF 2026',
        coramPrefix: 'Hon. Lady / Mr. Justice [Name], J'
      }
    ]
  },
  {
    category: 'Subordinate Courts (Articles 169-170, CoK 2010)',
    badge: 'Subordinate Court',
    courts: [
      {
        name: "Chief Magistrate's Commercial Court",
        article: 'CoK 2010 Art. 169(1)(a) & MCA 2015',
        division: 'Subordinate Commercial',
        defaultPreset: 'MCCCOMM NO. E001 OF 2026',
        coramPrefix: 'Hon. [Name], Chief Magistrate'
      },
      {
        name: "Chief Magistrate's Civil & Criminal Court",
        article: 'CoK 2010 Art. 169(1)(a)',
        division: 'Subordinate Civil',
        defaultPreset: 'MCCIVIL NO. E001 OF 2026',
        coramPrefix: 'Hon. [Name], SPM / PM / RM'
      },
      {
        name: "Kadhis' Court",
        article: 'CoK 2010 Art. 169(1)(b) & Art. 170',
        division: 'Islamic Personal Law',
        defaultPreset: 'KADHIS CAUSE NO. 001 OF 2026',
        coramPrefix: 'Hon. Chief Kadhi [Name]'
      },
      {
        name: 'Small Claims Court (SCC)',
        article: 'CoK 2010 Art. 169(1)(d) & SCCA 2016',
        division: 'Fast-Track Civil/Commercial (Under KES 1M)',
        defaultPreset: 'SCC NO. E001 OF 2026',
        coramPrefix: 'Hon. [Name], Adjudicator'
      }
    ]
  },
  {
    category: 'Specialized Quasi-Judicial Tribunals (Article 169(1)(d))',
    badge: 'Tribunal / ADR',
    courts: [
      {
        name: 'Tax Appeals Tribunal (TAT)',
        article: 'Tax Appeals Tribunal Act 2013',
        division: 'Tax Disputes',
        defaultPreset: 'TAT APPEAL NO. E001 OF 2026',
        coramPrefix: 'Hon. Chairperson [Name]'
      },
      {
        name: 'Business Premises Rent Tribunal (BPRT)',
        article: 'Cap 301 Laws of Kenya',
        division: 'Commercial Tenancy Disputes',
        defaultPreset: 'BPRT CAUSE NO. 001 OF 2026',
        coramPrefix: 'Hon. Chairperson [Name]'
      },
      {
        name: 'Co-operative Tribunal',
        article: 'Co-operative Societies Act (Cap 490)',
        division: 'SACCO & Societies Disputes',
        defaultPreset: 'COOP TRIBUNAL CAUSE NO. 001 OF 2026',
        coramPrefix: 'Hon. Chairperson [Name]'
      },
      {
        name: 'National Environment Tribunal (NET)',
        article: 'EMCA 1999',
        division: 'Environmental Appeals',
        defaultPreset: 'NET APPEAL NO. 001 OF 2026',
        coramPrefix: 'Hon. Chairperson [Name]'
      },
      {
        name: 'Political Parties Disputes Tribunal (PPDT)',
        article: 'Political Parties Act',
        division: 'Electoral & Party Disputes',
        defaultPreset: 'PPDT COMPLAINT NO. 001 OF 2026',
        coramPrefix: 'Hon. Chairperson [Name]'
      },
      {
        name: 'Public Procurement Administrative Review Board (PPARB)',
        article: 'PPADA 2015',
        division: 'Tender & Procurement Appeals',
        defaultPreset: 'PPARB APPLICATION NO. 001 OF 2026',
        coramPrefix: 'Hon. Board Chairman [Name]'
      },
      {
        name: 'Arbitration / NCIA (ADR Article 159(2)(c))',
        article: 'CoK 2010 Art. 159(2)(c) & Arbitration Act 1995',
        division: 'Commercial ADR',
        defaultPreset: 'NCIA ARBITRATION NO. 001 OF 2026',
        coramPrefix: 'Sole Arbitrator / Arbitral Tribunal'
      }
    ]
  }
]

export const KENYAN_COURT_STATIONS = [
  'Milimani Law Courts, Nairobi',
  'Supreme Court Building, Nairobi',
  'Mombasa Law Courts',
  'Kisumu Law Courts',
  'Nakuru Law Courts',
  'Eldoret Law Courts',
  'Kajiado Law Courts',
  'Machakos Law Courts',
  'Kiambu Law Courts',
  'Nyeri Law Courts',
  'Meru Law Courts',
  'Malindi Law Courts',
  'Thika Law Courts',
  'Kakamega Law Courts',
  'Kisii Law Courts',
  'Garissa Law Courts'
]

export const PROCEDURAL_ROLES = [
  { client: 'Plaintiff', opposing: 'Defendant', label: 'Civil Action (Plaint - Order 3 CPR)' },
  { client: 'Petitioner', opposing: 'Respondent', label: 'Constitutional / Family Petition (Arts. 22/258)' },
  { client: 'Claimant', opposing: 'Respondent', label: 'Labour / Employment Claim (ELRC Act)' },
  { client: 'Ex-Parte Applicant', opposing: 'Respondent', label: 'Judicial Review (Order 53 CPR)' },
  { client: 'Appellant', opposing: 'Respondent', label: 'Appellate Appeal (Court of Appeal / High Court)' },
  { client: 'Applicant', opposing: 'Respondent', label: 'Chamber Summons / Originating Summons' },
  { client: 'Defendant', opposing: 'Plaintiff', label: 'Civil Defense / Statement of Defense' },
  { client: 'Respondent', opposing: 'Petitioner', label: 'Replying to Petition' }
]

export const HEARING_PURPOSES = [
  'Mention for Directions / Compliance (Order 11 CPR)',
  'Hearing of Interlocutory Application (Notice of Motion)',
  'Pre-Trial Conference (Order 11 CPR)',
  'Main Hearing / Trial (Viva Voce Evidence & Cross-examination)',
  'Highlighting Written Submissions',
  'Ruling on Interlocutory Application',
  'Final Judgment / Decree Delivery',
  'Taxation of Advocate-Client / Party-and-Party Bill of Costs',
  'Court-Annexed Mediation / ADR Session (Art. 159(2)(c))'
]

export const CORAM_HONORIFICS = [
  'Hon. Lady Justice',
  'Hon. Mr. Justice',
  'Hon. Chief Magistrate',
  'Hon. Senior Principal Magistrate',
  'Hon. Principal Magistrate',
  'Hon. Resident Magistrate',
  'Hon. Chief Kadhi',
  'Hon. Kadhi',
  'Hon. Small Claims Adjudicator',
  'Hon. Tribunal Chairperson',
  'Sole Arbitrator'
]

export const ARO_SCALES = [
  'Schedule 6 - Litigation (High Court / Subordinate)',
  'Schedule 1 - Conveyancing, Sales & Purchases',
  'Schedule 2 - Securities, Mortgages & Charges',
  'Schedule 9 - Arbitration & Alternative Dispute Resolution',
  'Section 45 Advocates Act - Formal Written Fee Agreement',
  'Pro Bono Publico (Legal Aid Act 2016)'
]

const STATUS_BADGES = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  pending_hearing: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  on_hold: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800'
}

const Matters = () => {
  const [matters, setMatters] = useState([])
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [showNewMatterModal, setShowNewMatterModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedMatterForTime, setSelectedMatterForTime] = useState(null)
  const [showDossierModal, setShowDossierModal] = useState(false)
  const [dossierMatter, setDossierMatter] = useState(null)
  const [dossierTimeEntries, setDossierTimeEntries] = useState([])
  const [dossierLoading, setDossierLoading] = useState(false)

  // New Matter Form (Full Kenyan Constitutional & Statutory Alignment)
  const [form, setForm] = useState({
    caseNumber: '',
    title: '',
    clientId: '',
    practiceArea: 'Commercial Litigation',
    courtName: 'High Court Commercial & Tax Division',
    courtLevel: 'Superior Courts of Record (Articles 162-165, CoK 2010)',
    courtStation: 'Milimani Law Courts, Nairobi',
    coramPrefix: 'Hon. Lady Justice',
    coramName: '',
    partyRole: 'Plaintiff',
    opposingRole: 'Defendant',
    hearingPurpose: 'Pre-Trial Conference (Order 11 CPR)',
    opposingParty: '',
    opposingCounsel: '',
    billingType: 'fixed_fee',
    aroScale: 'Schedule 6 - Litigation (High Court / Subordinate)',
    feeAmountKes: '',
    disbursementsKes: '',
    vatAmountKes: '',
    hourlyRateKes: '',
    priority: 'medium',
    nextHearingDate: '',
    filingDeadline: '',
    notes: ''
  })

  // Time Entry Form
  const [timeForm, setTimeForm] = useState({
    activityType: 'drafting',
    durationMinutes: '60',
    hourlyRateKes: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [mattersRes, custRes] = await Promise.all([
        matterService.getMatters({ limit: 100 }),
        customerService.getCustomers({ limit: 100 })
      ])

      if (mattersRes.data?.success) {
        setMatters(mattersRes.data.data.matters || [])
      }
      if (custRes.data?.success) {
        setCustomers(custRes.data.data.customers || [])
      }
    } catch (err) {
      toast.error('Failed to load legal matters from server')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredMatters = useMemo(() => {
    return matters.filter((m) => {
      const text = `${m.title || ''} ${m.case_number || ''} ${m.client_name || ''} ${m.court_name || ''} ${m.court_station || ''} ${m.opposing_party || ''} ${m.judge_or_arbitrator || ''} ${m.party_role || ''}`.toLowerCase()
      const matchSearch = text.includes(searchTerm.toLowerCase())
      const matchPractice = practiceFilter === 'all' || m.practice_area === practiceFilter
      const matchStatus = statusFilter === 'all' || m.status === statusFilter
      return matchSearch && matchPractice && matchStatus
    })
  }, [matters, searchTerm, practiceFilter, statusFilter])

  const metrics = useMemo(() => {
    const total = matters.length
    const active = matters.filter((m) => m.status === 'active' || m.status === 'pending_hearing').length
    const pendingHearings = matters.filter((m) => m.next_hearing_date).length
    const totalFixedFees = matters.reduce((sum, m) => sum + (parseFloat(m.fee_amount_kes) || 0), 0)
    const totalDisbursements = matters.reduce((sum, m) => sum + (parseFloat(m.disbursements_kes) || 0), 0)
    return { total, active, pendingHearings, totalFixedFees, totalDisbursements }
  }, [matters])

  // Calculated VAT preview for creation form
  const computedVat = useMemo(() => {
    const fee = parseFloat(form.feeAmountKes) || 0
    return (fee * 0.16).toFixed(2)
  }, [form.feeAmountKes])

  const computedTotalFee = useMemo(() => {
    const fee = parseFloat(form.feeAmountKes) || 0
    const vat = parseFloat(computedVat) || 0
    const disb = parseFloat(form.disbursementsKes) || 0
    return fee + vat + disb
  }, [form.feeAmountKes, computedVat, form.disbursementsKes])

  const handleCourtChange = (courtName) => {
    // Find court details
    let selectedCourt = null
    let categoryName = ''
    for (const group of KENYAN_COURT_GROUPS) {
      const found = group.courts.find((c) => c.name === courtName)
      if (found) {
        selectedCourt = found
        categoryName = group.category
        break
      }
    }

    setForm((prev) => ({
      ...prev,
      courtName,
      courtLevel: categoryName || prev.courtLevel,
      caseNumber: prev.caseNumber ? prev.caseNumber : (selectedCourt?.defaultPreset || prev.caseNumber)
    }))
  }

  const handleRolePreset = (clientRole, opposingRole) => {
    setForm((prev) => ({
      ...prev,
      partyRole: clientRole,
      opposingRole: opposingRole
    }))
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.clientId) {
      toast.error('Matter title and Instructing Client are required')
      return
    }

    const fullJudge = form.coramName ? `${form.coramPrefix} ${form.coramName.trim()}` : ''

    try {
      await matterService.createMatter({
        caseNumber: form.caseNumber.trim().toUpperCase(),
        title: form.title,
        clientId: parseInt(form.clientId, 10),
        practiceArea: form.practiceArea,
        courtName: form.courtName,
        courtLevel: form.courtLevel,
        courtStation: form.courtStation,
        coramTitle: fullJudge,
        judgeOrArbitrator: fullJudge,
        partyRole: form.partyRole,
        opposingRole: form.opposingRole,
        hearingPurpose: form.hearingPurpose,
        opposingParty: form.opposingParty,
        opposingCounsel: form.opposingCounsel,
        billingType: form.billingType,
        aroScale: form.aroScale,
        feeAmountKes: form.feeAmountKes ? parseFloat(form.feeAmountKes) : null,
        disbursementsKes: form.disbursementsKes ? parseFloat(form.disbursementsKes) : 0,
        vatAmountKes: form.feeAmountKes ? parseFloat(computedVat) : 0,
        hourlyRateKes: form.hourlyRateKes ? parseFloat(form.hourlyRateKes) : null,
        priority: form.priority,
        nextHearingDate: form.nextHearingDate || null,
        filingDeadline: form.filingDeadline || null,
        notes: form.notes
      })
      toast.success('Legal matter opened under Kenyan Civil Procedure Rules')
      setShowNewMatterModal(false)
      setForm({
        caseNumber: '',
        title: '',
        clientId: '',
        practiceArea: 'Commercial Litigation',
        courtName: 'High Court Commercial & Tax Division',
        courtLevel: 'Superior Courts of Record (Articles 162-165, CoK 2010)',
        courtStation: 'Milimani Law Courts, Nairobi',
        coramPrefix: 'Hon. Lady Justice',
        coramName: '',
        partyRole: 'Plaintiff',
        opposingRole: 'Defendant',
        hearingPurpose: 'Pre-Trial Conference (Order 11 CPR)',
        opposingParty: '',
        opposingCounsel: '',
        billingType: 'fixed_fee',
        aroScale: 'Schedule 6 - Litigation (High Court / Subordinate)',
        feeAmountKes: '',
        disbursementsKes: '',
        vatAmountKes: '',
        hourlyRateKes: '',
        priority: 'medium',
        nextHearingDate: '',
        filingDeadline: '',
        notes: ''
      })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to open matter')
    }
  }

  const handleTimeSubmit = async (e) => {
    e.preventDefault()
    if (!selectedMatterForTime || !timeForm.durationMinutes) return

    try {
      await matterService.logTimeEntry(selectedMatterForTime.id, {
        activityType: timeForm.activityType,
        durationMinutes: parseInt(timeForm.durationMinutes, 10),
        hourlyRateKes: timeForm.hourlyRateKes ? parseFloat(timeForm.hourlyRateKes) : null,
        date: timeForm.date,
        description: timeForm.description
      })
      toast.success('Billable time entry recorded')
      setShowTimeModal(false)

      if (showDossierModal && dossierMatter?.id === selectedMatterForTime.id) {
        viewMatterDossier(selectedMatterForTime)
      }

      setSelectedMatterForTime(null)
      setTimeForm({
        activityType: 'drafting',
        durationMinutes: '60',
        hourlyRateKes: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      })
    } catch (err) {
      toast.error('Failed to log time entry')
    }
  }

  const viewMatterDossier = async (matter) => {
    setDossierMatter(matter)
    setShowDossierModal(true)
    setDossierLoading(true)
    try {
      const res = await matterService.getMatter(matter.id)
      if (res.data?.success && res.data?.data) {
        setDossierMatter(res.data.data.matter)
        setDossierTimeEntries(res.data.data.timeEntries || [])
      }
    } catch (e) {
      toast.error('Could not load matter dossier')
    } finally {
      setDossierLoading(false)
    }
  }

  const handleStatusChange = async (matterId, newStatus) => {
    try {
      await matterService.updateMatter(matterId, { status: newStatus })
      toast.success(`Matter status updated to ${newStatus}`)
      loadData()
      if (dossierMatter && dossierMatter.id === matterId) {
        setDossierMatter((prev) => ({ ...prev, status: newStatus }))
      }
    } catch (e) {
      toast.error('Failed to update status')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Scale className="w-7 h-7 text-purple-600" />
              Legal Practice & Case Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
              <Award className="w-3.5 h-3.5" />
              Constitution of Kenya 2010 (Chap. 10) Compliant
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            Litigation docket, Judiciary e-Filing nomenclature, Order 11 fixtures, Coram registry & Section 45 Advocates Act remuneration.
          </p>
        </div>

        <button
          onClick={() => setShowNewMatterModal(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Open New Legal Matter / Case
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Active Matters</span>
            <Scale className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{metrics.active}</p>
          <span className="text-[11px] text-gray-400">Superior & Subordinate suits ongoing</span>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase">Court Fixtures</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.pendingHearings}</p>
          <span className="text-[11px] text-gray-400">Order 11 mentions & trials scheduled</span>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 uppercase">Total Matter Files</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-600 mt-1">{metrics.total}</p>
          <span className="text-[11px] text-gray-400">Litigation & advisory dossiers</span>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase">Agreed Fee Pipeline</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            {formatCurrencyKES(metrics.totalFixedFees)}
          </p>
          <span className="text-[11px] text-gray-400">ARO Section 45 retainers</span>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search case #, parties, coram, station..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <select
            value={practiceFilter}
            onChange={(e) => setPracticeFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Practice Areas</option>
            {PRACTICE_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_hearing">Pending Hearing</option>
            <option value="closed">Closed / Settled</option>
            <option value="on_hold">On Hold</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Matters List */}
      {filteredMatters.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No Legal Matters Found"
          description="Open your law firm cases, track hearing dates in Kenyan courts (Arts. 162-170), and record billable advocate hours."
          actionLabel="Open First Matter"
          onAction={() => setShowNewMatterModal(true)}
        />
      ) : (
        <div className="space-y-4">
          {filteredMatters.map((matter) => {
            const statusClass = STATUS_BADGES[matter.status] || STATUS_BADGES.active
            const hasHearing = Boolean(matter.next_hearing_date)
            const clientPhone = matter.client_phone ? matter.client_phone.replace(/[^0-9]/g, '') : ''

            return (
              <div
                key={matter.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {matter.case_number ? (
                        <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                          {matter.case_number}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                          FILE #{matter.id}
                        </span>
                      )}
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        {matter.practice_area}
                      </span>
                      {matter.court_level && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                          {matter.court_level.includes('Superior') ? 'Superior Court' : matter.court_level.includes('Subordinate') ? 'Subordinate' : 'Tribunal'}
                        </span>
                      )}
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusClass}`}>
                        {matter.status ? matter.status.replace('_', ' ') : 'Active'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {matter.title}
                    </h3>

                    {/* Procedural Pleadings Representation */}
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                      <span className="text-primary-700 dark:text-primary-400 font-semibold">
                        {matter.client_name || 'Instructing Client'}
                      </span>
                      <span className="text-gray-400">
                        ({matter.party_role || 'Plaintiff'})
                      </span>
                      {matter.opposing_party && (
                        <>
                          <span className="text-gray-400 font-bold">vs.</span>
                          <span className="text-red-700 dark:text-red-400 font-semibold">
                            {matter.opposing_party}
                          </span>
                          <span className="text-gray-400">
                            ({matter.opposing_role || 'Defendant'})
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 flex-wrap">
                      {matter.court_name && (
                        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <Landmark className="w-3.5 h-3.5 text-purple-600" />
                          {matter.court_name} {matter.court_station ? `(${matter.court_station})` : ''}
                        </span>
                      )}

                      {matter.judge_or_arbitrator && (
                        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                          <Gavel className="w-3.5 h-3.5" />
                          Coram: {matter.judge_or_arbitrator}
                        </span>
                      )}

                      {matter.client_phone && (
                        <a
                          href={`https://wa.me/${clientPhone}?text=${encodeURIComponent(`Hello ${matter.client_name || ''}, regarding Matter ${matter.case_number || matter.title}: `)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 font-semibold hover:underline"
                          title="WhatsApp client"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp Client</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewMatterDossier(matter)}
                        className="inline-flex items-center px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 transition"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-purple-600" />
                        Case Dossier
                      </button>

                      <button
                        onClick={() => {
                          setSelectedMatterForTime(matter)
                          setTimeForm((prev) => ({
                            ...prev,
                            hourlyRateKes: matter.hourly_rate_kes || ''
                          }))
                          setShowTimeModal(true)
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-800 transition"
                      >
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Log Time
                      </button>
                    </div>

                    {matter.fee_amount_kes ? (
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-600 block">
                          {formatCurrencyKES(matter.fee_amount_kes)} (Instruction Fee)
                        </span>
                        {matter.disbursements_kes > 0 && (
                          <span className="text-[10px] text-gray-400 block font-mono">
                            + {formatCurrencyKES(matter.disbursements_kes)} Disb.
                          </span>
                        )}
                      </div>
                    ) : matter.hourly_rate_kes ? (
                      <span className="text-xs text-gray-500 font-mono">
                        {formatCurrencyKES(matter.hourly_rate_kes)} / hr
                      </span>
                    ) : null}
                  </div>
                </div>

                {hasHearing && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex-wrap">
                    <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      <strong className="font-semibold">Court Fixture:</strong>{' '}
                      {new Date(matter.next_hearing_date).toLocaleDateString('en-KE', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    {matter.hearing_purpose && (
                      <span className="px-2 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/40 font-semibold text-amber-950 dark:text-amber-100">
                        {matter.hearing_purpose}
                      </span>
                    )}
                    {matter.judge_or_arbitrator && (
                      <span className="text-amber-800 dark:text-amber-300">
                        • Coram: {matter.judge_or_arbitrator}
                      </span>
                    )}
                    {matter.filing_deadline && (
                      <span className="ml-auto text-amber-700 dark:text-amber-400 font-medium">
                        Filing Deadline: {new Date(matter.filing_deadline).toLocaleDateString('en-KE')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Case Dossier & Billable Time Modal */}
      {showDossierModal && dossierMatter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded">
                    {dossierMatter.case_number || `FILE #${dossierMatter.id}`}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {dossierMatter.practice_area}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {dossierMatter.title}
                </h2>
              </div>
              <button
                onClick={() => setShowDossierModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Matter Overview Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-xl text-xs">
              <div>
                <span className="text-gray-400 uppercase font-semibold">Instructing Client</span>
                <p className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                  {dossierMatter.client_name || 'Direct Client'}
                </p>
                <p className="text-purple-600 font-medium">Standing: {dossierMatter.party_role || 'Plaintiff'}</p>
                {dossierMatter.client_phone && (
                  <p className="text-gray-500 font-mono">{dossierMatter.client_phone}</p>
                )}
              </div>

              <div>
                <span className="text-gray-400 uppercase font-semibold">Court / Registry</span>
                <p className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                  {dossierMatter.court_name || 'Not filed yet'}
                </p>
                <p className="text-gray-500">{dossierMatter.court_station || 'Nairobi Station'}</p>
                {dossierMatter.judge_or_arbitrator && (
                  <p className="text-amber-600 font-medium">Coram: {dossierMatter.judge_or_arbitrator}</p>
                )}
              </div>

              <div>
                <span className="text-gray-400 uppercase font-semibold">Opposing Side</span>
                <p className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                  {dossierMatter.opposing_party || 'None / Ex-Parte'}
                </p>
                <p className="text-gray-500">Role: {dossierMatter.opposing_role || 'Defendant'}</p>
                <p className="text-gray-500">Counsel: {dossierMatter.opposing_counsel || 'Not on record'}</p>
              </div>

              <div>
                <span className="text-gray-400 uppercase font-semibold">Hearing Purpose</span>
                <p className="font-semibold text-amber-600 mt-0.5">
                  {dossierMatter.hearing_purpose || 'General Hearing'}
                </p>
                <p className="text-gray-500">
                  {dossierMatter.next_hearing_date
                    ? new Date(dossierMatter.next_hearing_date).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No date fixed'}
                </p>
              </div>

              <div>
                <span className="text-gray-400 uppercase font-semibold">ARO Remuneration</span>
                <p className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                  {dossierMatter.aro_scale || 'Section 45 Advocates Act'}
                </p>
                <p className="text-emerald-600 font-semibold">
                  {dossierMatter.fee_amount_kes
                    ? `${formatCurrencyKES(dossierMatter.fee_amount_kes)} + VAT`
                    : dossierMatter.hourly_rate_kes
                    ? `${formatCurrencyKES(dossierMatter.hourly_rate_kes)}/hr`
                    : 'Pro Bono'}
                </p>
              </div>

              <div>
                <span className="text-gray-400 uppercase font-semibold">Matter Status</span>
                <div className="mt-0.5">
                  <select
                    value={dossierMatter.status}
                    onChange={(e) => handleStatusChange(dossierMatter.id, e.target.value)}
                    className="text-xs py-1 px-2 border rounded font-semibold bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  >
                    <option value="active">Active</option>
                    <option value="pending_hearing">Pending Hearing</option>
                    <option value="closed">Closed / Settled</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Billable Time Entries Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Billable Advocate Time Entries
                </h4>
                <button
                  onClick={() => {
                    setSelectedMatterForTime(dossierMatter)
                    setTimeForm((prev) => ({ ...prev, hourlyRateKes: dossierMatter.hourly_rate_kes || '' }))
                    setShowTimeModal(true)
                  }}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Log Time Entry
                </button>
              </div>

              {dossierLoading ? (
                <div className="p-4 text-center text-xs text-gray-500">Loading time ledger...</div>
              ) : dossierTimeEntries.length === 0 ? (
                <div className="p-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-center text-xs text-gray-500">
                  No billable time entries recorded for this matter yet. Click "Log Time Entry" above to add research, court appearance, or drafting hours.
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Activity</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Duration</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Rate (KES)</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {dossierTimeEntries.map((t) => {
                        const rate = t.hourly_rate_kes || dossierMatter.hourly_rate_kes || 0
                        const amount = (t.duration_minutes / 60) * rate
                        return (
                          <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-500">
                              {t.date ? new Date(t.date).toLocaleDateString('en-KE') : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                                {t.activity_type?.replace('_', ' ')}
                              </span>
                              {t.description && (
                                <p className="text-[11px] text-gray-500 line-clamp-1">{t.description}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono whitespace-nowrap">
                              {t.duration_minutes} min ({(t.duration_minutes / 60).toFixed(1)}h)
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                              {rate > 0 ? formatCurrencyKES(rate) : '—'}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-right text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {amount > 0 ? formatCurrencyKES(amount) : 'Fixed'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                className="btn-secondary"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open New Matter Modal - Fully Compliant with Kenyan Constitution 2010 */}
      {showNewMatterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-purple-600" />
                  Open New Matter (Kenyan Law & Judiciary Nomenclature)
                </h3>
                <p className="text-xs text-gray-500">
                  Compliant with Constitution of Kenya 2010 (Articles 159-170) & Civil Procedure Rules.
                </p>
              </div>
              <button
                onClick={() => setShowNewMatterModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Quick Case Number Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Judiciary Case / e-Filing Number *
                  </label>
                  <span className="text-[11px] text-gray-400">Quick Kenyan Formats:</span>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {['HCCC/E.../2026', 'PETITION/E.../2026', 'ELC/E.../2026', 'ELRC/E.../2026', 'SUCCESSION/E.../2026', 'MCCCOMM/E.../2026'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setForm({ ...form, caseNumber: fmt })}
                      className="px-2 py-0.5 text-[10px] font-mono bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800"
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. HCCC NO. E102 OF 2026"
                  value={form.caseNumber}
                  onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono font-bold text-purple-900 dark:text-purple-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Practice Area
                  </label>
                  <select
                    value={form.practiceArea}
                    onChange={(e) => setForm({ ...form, practiceArea: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {PRACTICE_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Instructing Client *
                  </label>
                  <select
                    required
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select Client</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name || c.firstName} {c.last_name || c.lastName} {c.company_name ? `(${c.company_name})` : ''} - {c.phone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Matter Title / Cause of Action *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mwangi & Sons v. Kenya Power (Commercial Damages Claim)"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              {/* Procedural Role Designation (Order 3 CPR & Constitutional Petitions) */}
              <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-xl border border-purple-100 dark:border-purple-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Procedural Pleadings Designation (Plea Standing)
                  </span>
                  <div className="flex gap-1">
                    {PROCEDURAL_ROLES.slice(0, 3).map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => handleRolePreset(r.client, r.opposing)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border text-gray-700 dark:text-gray-300 hover:border-purple-500"
                      >
                        {r.client} v. {r.opposing}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Client Standing
                    </label>
                    <select
                      value={form.partyRole}
                      onChange={(e) => setForm({ ...form, partyRole: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                    >
                      <option value="Plaintiff">Plaintiff (Civil Suit - Order 3 CPR)</option>
                      <option value="Petitioner">Petitioner (Constitutional Petition - Art. 22/258)</option>
                      <option value="Claimant">Claimant (Labour / Arbitration)</option>
                      <option value="Ex-Parte Applicant">Ex-Parte Applicant (Judicial Review - Order 53)</option>
                      <option value="Appellant">Appellant (Appellate Appeal)</option>
                      <option value="Applicant">Applicant (Miscellaneous / Chamber Summons)</option>
                      <option value="Defendant">Defendant</option>
                      <option value="Respondent">Respondent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Opposing Party Standing
                    </label>
                    <select
                      value={form.opposingRole}
                      onChange={(e) => setForm({ ...form, opposingRole: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                    >
                      <option value="Defendant">Defendant</option>
                      <option value="Respondent">Respondent</option>
                      <option value="Plaintiff">Plaintiff</option>
                      <option value="Claimant">Claimant</option>
                      <option value="Interested Party">Interested Party</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Constitutional Court Hierarchy & Station */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Kenyan Court / Tribunal (CoK 2010)
                  </label>
                  <select
                    value={form.courtName}
                    onChange={(e) => handleCourtChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {KENYAN_COURT_GROUPS.map((group) => (
                      <optgroup key={group.category} label={group.category}>
                        {group.courts.map((court) => (
                          <option key={court.name} value={court.name}>
                            {court.name} ({court.article})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Court Station / Registry
                  </label>
                  <select
                    value={form.courtStation}
                    onChange={(e) => setForm({ ...form, courtStation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {KENYAN_COURT_STATIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Coram Honorific & Name */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Coram Honorific
                  </label>
                  <select
                    value={form.coramPrefix}
                    onChange={(e) => setForm({ ...form, coramPrefix: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {CORAM_HONORIFICS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Judge / Magistrate / Kadhi Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ndung'u, J / Majanja, J / Chepkwony, J"
                    value={form.coramName}
                    onChange={(e) => setForm({ ...form, coramName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Opposing Party & Opposing Counsel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Opposing Party
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kenya Power & Lighting Co. PLC"
                    value={form.opposingParty}
                    onChange={(e) => setForm({ ...form, opposingParty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Opposing Counsel (Law Firm)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oraro & Company Advocates"
                    value={form.opposingCounsel}
                    onChange={(e) => setForm({ ...form, opposingCounsel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Hearing Fixture & Purpose (Order 11 CPR) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Hearing Purpose (Civil Procedure Rules)
                  </label>
                  <select
                    value={form.hearingPurpose}
                    onChange={(e) => setForm({ ...form, hearingPurpose: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {HEARING_PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Next Court Hearing Date
                  </label>
                  <input
                    type="date"
                    value={form.nextHearingDate}
                    onChange={(e) => setForm({ ...form, nextHearingDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Advocates Remuneration Order (ARO) Fees & VAT */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    Advocates Remuneration Order (ARO) & Section 45 Retainer
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    VAT Rate: 16% (VAT Act 2013)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      ARO Fee Scale
                    </label>
                    <select
                      value={form.aroScale}
                      onChange={(e) => setForm({ ...form, aroScale: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      {ARO_SCALES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Instruction Fee (KES)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 250000"
                      value={form.feeAmountKes}
                      onChange={(e) => setForm({ ...form, feeAmountKes: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-transparent dark:text-gray-100 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Disbursements (KES)
                    </label>
                    <input
                      type="number"
                      placeholder="Filing fees, search..."
                      value={form.disbursementsKes}
                      onChange={(e) => setForm({ ...form, disbursementsKes: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-transparent dark:text-gray-100 font-mono"
                    />
                  </div>
                </div>

                {/* Live Retainer Total Calculation */}
                {parseFloat(form.feeAmountKes) > 0 && (
                  <div className="flex items-center justify-between text-xs p-2 rounded bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-200 font-mono">
                    <span>Instruction: {formatCurrencyKES(parseFloat(form.feeAmountKes))}</span>
                    <span>+ 16% VAT: {formatCurrencyKES(parseFloat(computedVat))}</span>
                    <span>+ Disbursements: {formatCurrencyKES(parseFloat(form.disbursementsKes) || 0)}</span>
                    <span className="font-bold underline">Total Retainer: {formatCurrencyKES(computedTotalFee)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Brief Case Notes / Prayers
                </label>
                <textarea
                  rows={2}
                  placeholder="Material facts, statutory prayers under Kenyan law, and client instructions..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowNewMatterModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Open Matter File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Time Entry Modal */}
      {showTimeModal && selectedMatterForTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Log Billable Hours</h3>
                <p className="text-xs text-gray-500 truncate">{selectedMatterForTime.title}</p>
              </div>
              <button
                onClick={() => setShowTimeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleTimeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Advocate Activity Type
                </label>
                <select
                  value={timeForm.activityType}
                  onChange={(e) => setTimeForm({ ...timeForm, activityType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="drafting">Pleadings Drafting (Plaint / Affidavit / Submissions)</option>
                  <option value="court_appearance">Court Appearance / Mention / Trial</option>
                  <option value="legal_research">Legal Research & Authorities Citation</option>
                  <option value="client_conference">Client Conference / Witness Preparation</option>
                  <option value="settlement_negotiation">ADR / Settlement Negotiation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 90"
                    value={timeForm.durationMinutes}
                    onChange={(e) => setTimeForm({ ...timeForm, durationMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Hourly Rate (KES)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={timeForm.hourlyRateKes}
                    onChange={(e) => setTimeForm({ ...timeForm, hourlyRateKes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={timeForm.date}
                  onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Description of Legal Work Done
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Drafted Replying Affidavit to Notice of Motion dated 12th Oct..."
                  value={timeForm.description}
                  onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Record Billable Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Matters

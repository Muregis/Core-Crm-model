// Settings.jsx
// Company tenant profile, Safaricom Daraja M-Pesa vault credentials, team member management, and KDPA settings.
import React, { useEffect, useState } from 'react'
import {
  Building2,
  Lock,
  Users,
  ShieldCheck,
  Plus,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  UserCheck,
  UserX
} from 'lucide-react'
import { userService } from '../services/userService'
import { mpesaService } from '../services/mpesaService'
import { customerService } from '../services/customerService'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const Settings = () => {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('organization')
  const [isLoading, setIsLoading] = useState(true)

  // Tenant Organization State
  const [tenant, setTenant] = useState({
    name: '',
    slug: '',
    domain: '',
    kra_pin: '',
    plan: 'starter',
    industry: 'general',
    status: 'active'
  })
  const [isSavingTenant, setIsSavingTenant] = useState(false)

  // Daraja Vault State
  const [mpesaCreds, setMpesaCreds] = useState({
    configured: false,
    shortcode: '',
    keyType: 'paybill',
    consumerKey: '',
    consumerSecret: '',
    passkey: '',
    isSandbox: true,
    maskedConsumerKey: ''
  })
  const [isSavingMpesa, setIsSavingMpesa] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  // Team Members State
  const [teamMembers, setTeamMembers] = useState([])
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '+254',
    role: 'sales_rep'
  })

  // KDPA Compliance Tool
  const [kdpaCustomerId, setKdpaCustomerId] = useState('')
  const [kdpaLoading, setKdpaLoading] = useState(false)

  const loadAllSettings = async () => {
    setIsLoading(true)
    try {
      const [tenantRes, mpesaRes, usersRes] = await Promise.all([
        userService.getTenant().catch(() => ({ data: { success: false } })),
        mpesaService.getCredentials().catch(() => ({ data: { success: false } })),
        userService.getUsers().catch(() => ({ data: { success: false } }))
      ])

      if (tenantRes.data?.success && tenantRes.data?.data?.tenant) {
        setTenant(tenantRes.data.data.tenant)
      } else {
        setTenant({
          name: user?.tenant_name || 'My Organization',
          slug: 'org',
          domain: 'corecrm.co.ke',
          kra_pin: 'P051234567Z',
          plan: 'starter',
          status: 'active'
        })
      }

      if (mpesaRes.data?.success && mpesaRes.data?.data) {
        const d = mpesaRes.data.data
        setMpesaCreds({
          configured: d.configured,
          shortcode: d.shortcode || '',
          keyType: d.keyType || 'paybill',
          consumerKey: '',
          consumerSecret: '',
          passkey: '',
          isSandbox: d.isSandbox !== undefined ? d.isSandbox : true,
          maskedConsumerKey: d.maskedConsumerKey || ''
        })
      }

      if (usersRes.data?.success && usersRes.data?.data?.users) {
        setTeamMembers(usersRes.data.data.users)
      } else {
        setTeamMembers([
          {
            id: user?.id || 1,
            first_name: user?.first_name || 'Admin',
            last_name: user?.last_name || 'User',
            email: user?.email || 'admin@example.com',
            role: user?.role || 'admin',
            is_active: 1
          }
        ])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAllSettings()
  }, [])

  const handleSaveTenant = async (e) => {
    e.preventDefault()
    setIsSavingTenant(true)
    try {
      await userService.updateTenant({
        name: tenant.name,
        domain: tenant.domain,
        kraPin: tenant.kra_pin,
        industry: tenant.industry
      })
      toast.success('Organization details & industry edition saved!')
      if (useAuthStore.getState().checkAuth) {
        useAuthStore.getState().checkAuth()
      }
    } catch (err) {
      toast.error('Failed to update organization details')
    } finally {
      setIsSavingTenant(false)
    }
  }

  const handleSaveMpesa = async (e) => {
    e.preventDefault()
    if (!mpesaCreds.shortcode || !mpesaCreds.consumerKey || !mpesaCreds.consumerSecret) {
      toast.error('Shortcode, Consumer Key, and Consumer Secret are required')
      return
    }

    setIsSavingMpesa(true)
    try {
      await mpesaService.saveCredentials({
        shortcode: mpesaCreds.shortcode,
        keyType: mpesaCreds.keyType,
        consumerKey: mpesaCreds.consumerKey,
        consumerSecret: mpesaCreds.consumerSecret,
        passkey: mpesaCreds.passkey,
        isSandbox: mpesaCreds.isSandbox
      })
      toast.success('Safaricom Daraja credentials encrypted and saved in vault')
      loadAllSettings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save Daraja credentials')
    } finally {
      setIsSavingMpesa(false)
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    try {
      await userService.createUser(userForm)
      toast.success('Team member added successfully')
      setShowAddUserModal(false)
      setUserForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '+254',
        role: 'sales_rep'
      })
      loadAllSettings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add user')
    }
  }

  const handleToggleUserStatus = async (targetUser) => {
    try {
      const newStatus = targetUser.is_active ? 0 : 1
      await userService.updateUser(targetUser.id, { isActive: newStatus })
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'}`)
      setTeamMembers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: newStatus } : u))
      )
    } catch {
      toast.error('Failed to update user status')
    }
  }

  const handleKdpaExport = async () => {
    if (!kdpaCustomerId) {
      toast.error('Please enter a Customer ID')
      return
    }
    setKdpaLoading(true)
    try {
      const res = await customerService.exportKdpaData(kdpaCustomerId)
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `kdpa_subject_export_client_${kdpaCustomerId}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success('KDPA Subject Access Report downloaded')
    } catch {
      toast.error('Customer not found or export failed')
    } finally {
      setKdpaLoading(false)
    }
  }

  const handleKdpaAnonymize = async () => {
    if (!kdpaCustomerId) {
      toast.error('Please enter a Customer ID')
      return
    }
    if (
      !window.confirm(
        `Are you sure you want to permanently ANONYMIZE Customer #${kdpaCustomerId} per KDPA Right to Erasure? This cannot be undone.`
      )
    )
      return

    setKdpaLoading(true)
    try {
      await customerService.anonymizeCustomer(kdpaCustomerId)
      toast.success('Customer PII anonymized pursuant to KDPA 2019')
      setKdpaCustomerId('')
    } catch {
      toast.error('Failed to anonymize customer')
    } finally {
      setKdpaLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings & Administration</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your organization profile, Safaricom Daraja M-Pesa credentials vault, team access, and KDPA compliance.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-4 overflow-x-auto">
        {[
          { id: 'organization', label: 'Organization Profile', icon: Building2 },
          { id: 'daraja', label: 'M-Pesa Daraja Vault', icon: Lock },
          { id: 'team', label: 'Team Members & Roles', icon: Users },
          { id: 'kdpa', label: 'KDPA Compliance', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                isActive
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* TAB 1: Organization Profile */}
      {activeTab === 'organization' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm max-w-2xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Company Information</h3>
            <p className="text-xs text-gray-500">Your multi-tenant organization identification details.</p>
          </div>

          <form onSubmit={handleSaveTenant} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Company / Business Name
              </label>
              <input
                type="text"
                required
                value={tenant.name}
                onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Tenant Slug / Subdomain
                </label>
                <input
                  type="text"
                  disabled
                  value={tenant.slug}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-mono"
                />
                <span className="text-[11px] text-gray-400">Fixed identifier for data isolation</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  KRA PIN (Kenya Revenue)
                </label>
                <input
                  type="text"
                  placeholder="e.g. P051234567Z"
                  value={tenant.kra_pin || ''}
                  onChange={(e) => setTenant({ ...tenant, kra_pin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Custom Domain (Optional)
              </label>
              <input
                type="text"
                placeholder="crm.mycompany.co.ke"
                value={tenant.domain || ''}
                onChange={(e) => setTenant({ ...tenant, domain: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Industry Edition & Modular Workspace
              </label>
              <select
                value={tenant.industry || 'general'}
                onChange={(e) => setTenant({ ...tenant, industry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
              >
                <option value="real_estate">🏢 Real Estate & Property (Land, Plots & Title Deeds)</option>
                <option value="legal">⚖️ Law Firm & Legal Practice (Matters, Hearings & Time Billing)</option>
                <option value="general">💼 General SME & Commerce (Clean Operational Core)</option>
                <option value="all">🌐 Multi-Discipline Firm (Both Real Estate & Legal Packs)</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Customizes sidebar and modules so law firms don't see plot inventory, and property sellers don't see court litigation.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingTenant}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSavingTenant ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: M-Pesa Daraja Vault */}
      {activeTab === 'daraja' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm max-w-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-600" />
                Safaricom Daraja API Credentials Vault
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Keys are encrypted with AES-256 and scoped strictly to your company tenant.
              </p>
            </div>
            {mpesaCreds.configured && (
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Vault Configured
              </span>
            )}
          </div>

          {mpesaCreds.configured && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 text-xs space-y-1">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">Active Daraja Integration</p>
              <p className="text-emerald-700 dark:text-emerald-400">
                Shortcode: <span className="font-mono font-bold">{mpesaCreds.shortcode}</span> ({mpesaCreds.keyType})
                • Mode: <span className="font-bold">{mpesaCreds.isSandbox ? 'Sandbox' : 'Production Live'}</span>
                • Key: <span className="font-mono">{mpesaCreds.maskedConsumerKey}</span>
              </p>
            </div>
          )}

          <form onSubmit={handleSaveMpesa} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Business Shortcode (Paybill / Till)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 600123"
                  value={mpesaCreds.shortcode}
                  onChange={(e) => setMpesaCreds({ ...mpesaCreds, shortcode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Account Type
                </label>
                <select
                  value={mpesaCreds.keyType}
                  onChange={(e) => setMpesaCreds({ ...mpesaCreds, keyType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="paybill">Paybill</option>
                  <option value="till">Buy Goods Till</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Daraja Consumer Key
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="text-xs text-primary-600 flex items-center gap-1"
                >
                  {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showSecrets ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <input
                type={showSecrets ? 'text' : 'password'}
                required
                placeholder="Enter Safaricom Consumer Key"
                value={mpesaCreds.consumerKey}
                onChange={(e) => setMpesaCreds({ ...mpesaCreds, consumerKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Daraja Consumer Secret
              </label>
              <input
                type={showSecrets ? 'text' : 'password'}
                required
                placeholder="Enter Safaricom Consumer Secret"
                value={mpesaCreds.consumerSecret}
                onChange={(e) => setMpesaCreds({ ...mpesaCreds, consumerSecret: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Lipa Na M-Pesa Online Passkey (STK Push)
              </label>
              <input
                type={showSecrets ? 'text' : 'password'}
                placeholder="Optional passkey for initiating STK Push"
                value={mpesaCreds.passkey}
                onChange={(e) => setMpesaCreds({ ...mpesaCreds, passkey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={mpesaCreds.isSandbox}
                  onChange={(e) => setMpesaCreds({ ...mpesaCreds, isSandbox: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span>Sandbox Mode (Use Safaricom Daraja test environment)</span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingMpesa}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
              >
                <Key className="w-4 h-4 mr-2" />
                {isSavingMpesa ? 'Encrypting & Saving...' : 'Save & Encrypt Daraja Keys'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: Team Members & Roles */}
      {activeTab === 'team' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Team Members & Access Roles</h3>
              <p className="text-xs text-gray-500">
                Manage roles (Admin, Manager, Sales Rep) and active statuses for your company staff.
              </p>
            </div>

            <button
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-normal">
                {teamMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {m.first_name} {m.last_name}
                    </td>
                    <td className="px-4 py-3">{m.email}</td>
                    <td className="px-4 py-3 font-mono">{m.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {m.role ? m.role.replace('_', ' ') : 'Sales Rep'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.is_active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        {m.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.id !== user?.id && (
                        <button
                          onClick={() => handleToggleUserStatus(m)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                            m.is_active
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: KDPA Compliance */}
      {activeTab === 'kdpa' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm max-w-2xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
              Kenya Data Protection Act (KDPA 2019) Tools
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Ensure compliance with Section 26 (Subject Access Requests) and Right to Erasure while preserving deal and financial transaction audit trails.
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-4 border border-gray-200 dark:border-gray-800">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Target Customer ID
              </label>
              <input
                type="number"
                placeholder="Enter client ID from Customers table"
                value={kdpaCustomerId}
                onChange={(e) => setKdpaCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleKdpaExport}
                disabled={kdpaLoading}
                className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Export Subject Data (JSON)
              </button>
              <button
                type="button"
                onClick={handleKdpaAnonymize}
                disabled={kdpaLoading}
                className="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Anonymize PII (Erasure)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Team Member</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
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
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Phone (+254)
                  </label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-transparent dark:text-gray-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Role
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="sales_rep">Sales Rep / Advocate</option>
                    <option value="manager">Manager / Team Lead</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings

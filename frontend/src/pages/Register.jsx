import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Phone, User, Mail, Building2, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  companyName: z.string().min(2, 'Company / Organization name is required'),
  industry: z.string().default('general'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+254\d{9}$/, 'Phone must be in Kenyan format (+254XXXXXXXXX)'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

const Register = () => {
  const navigate = useNavigate()
  const { register: registerUser } = useAuthStore()
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      industry: 'general'
    }
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      const { confirmPassword, ...userData } = data
      const payload = {
        ...userData,
        tenantName: userData.companyName,
        industry: userData.industry
      }
      const result = await registerUser(payload)
      if (result.success) {
        toast.success('Registration successful! Welcome to Kenya CRM.')
        navigate('/dashboard')
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center shadow-md">
            <Building2 className="h-7 w-7 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Your CRM Workspace
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Tailored specifically for Kenyan Real Estate, Legal Firms & Growing SMEs.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {/* Company / Business Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                Company / Organization Name *
              </label>
              <div className="mt-1">
                <input
                  {...register('companyName')}
                  id="companyName"
                  type="text"
                  className="input"
                  placeholder="e.g. Acacia Land Ltd or Nairobi Advocates LLP"
                />
                {errors.companyName && (
                  <p className="form-error">{errors.companyName.message}</p>
                )}
              </div>
            </div>

            {/* Profession / Industry Selector */}
            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                Primary Profession / Industry *
              </label>
              <div className="mt-1">
                <select
                  {...register('industry')}
                  id="industry"
                  className="input text-sm"
                >
                  <option value="real_estate">🏢 Real Estate & Land Selling (Plots, Title Deeds & Site Visits)</option>
                  <option value="legal">⚖️ Law Firm & Legal Practice (Litigation, Court Dates & Billable Time)</option>
                  <option value="general">💼 General SME & Commerce (Clean Operational Core)</option>
                  <option value="all">🌐 Multi-Discipline Firm (Activate Both Packs)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Activates your industry pack: law firms won't see plot inventories, and property sellers won't see court cases.
                </p>
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <div className="mt-1">
                  <input
                    {...register('firstName')}
                    id="firstName"
                    type="text"
                    className="input"
                    placeholder="First name"
                  />
                  {errors.firstName && (
                    <p className="form-error">{errors.firstName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <div className="mt-1">
                  <input
                    {...register('lastName')}
                    id="lastName"
                    type="text"
                    className="input"
                    placeholder="Last name"
                  />
                  {errors.lastName && (
                    <p className="form-error">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Work Email Address *
              </label>
              <div className="mt-1">
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input"
                  placeholder="name@company.co.ke"
                />
                {errors.email && (
                  <p className="form-error">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number (Kenyan +254...) *
              </label>
              <div className="mt-1">
                <input
                  {...register('phone')}
                  id="phone"
                  type="tel"
                  className="input"
                  placeholder="+254712345678"
                />
                {errors.phone && (
                  <p className="form-error">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    {...register('password')}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="form-error">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm *
                </label>
                <div className="mt-1 relative">
                  <input
                    {...register('confirmPassword')}
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="form-error">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex justify-center py-2.5 px-4 text-sm font-medium shadow-sm transition disabled:opacity-50"
              >
                {isLoading ? 'Creating Workspace...' : 'Create Account & Workspace'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-500">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register

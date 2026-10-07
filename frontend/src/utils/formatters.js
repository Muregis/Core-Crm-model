/**
 * formatters.js
 * Kenyan-friendly formatting helpers for currency (KES) and dates (DD MMM YYYY).
 */

export const formatCurrencyKES = (amount) => {
  const numeric = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(numeric)) return 'KSh 0'

  const formatted = new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: 0,
  }).format(numeric)

  return `KSh ${formatted}`
}

export const formatDateKe = (dateInput) => {
  if (!dateInput) return ''

  const date =
    typeof dateInput === 'string'
      ? new Date(`${dateInput}T00:00:00`)
      : new Date(dateInput)

  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}


import type { CustomerStatus } from '~/types'

export type BadgeTone = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

export const customerLifecycleStages: CustomerStatus[] = ['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned']

export function customerStatusColor(status: CustomerStatus): BadgeTone {
  if (status === 'active') return 'success'
  if (status === 'onboarding') return 'secondary'
  if (status === 'at_risk') return 'warning'
  if (status === 'paused') return 'info'
  if (status === 'churned') return 'error'
  return 'neutral'
}

export function customerStatusIcon(status: CustomerStatus): string {
  if (status === 'prospect') return 'i-lucide-telescope'
  if (status === 'onboarding') return 'i-lucide-rocket'
  if (status === 'active') return 'i-lucide-circle-check'
  if (status === 'at_risk') return 'i-lucide-heart-pulse'
  if (status === 'paused') return 'i-lucide-pause'
  return 'i-lucide-circle-off'
}

export function healthScoreColor(score: number): BadgeTone {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

export function formatStatusLabel(value: string): string {
  return value.replaceAll('_', ' ')
}

export function formatMoney(value: number, currency = 'GBP'): string {
  const wholeNumber = Number.isInteger(value)
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: wholeNumber ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value)
}

export function formatRelativeTime(date: string | Date): string {
  const timestamp = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - timestamp.getTime()

  if (diff < 60_000) return 'just now'

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  return timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: string | Date): string {
  const timestamp = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}

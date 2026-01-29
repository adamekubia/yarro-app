'use client'

import { cn } from '@/lib/utils'

type StatusBadgeProps = {
  status: string
  variant?: 'default' | 'outline'
  size?: 'sm' | 'md'
  className?: string
}

const statusColors: Record<string, { bg: string; text: string; dot: string; hideDot?: boolean }> = {
  // Ticket statuses
  open: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },

  // Job stages
  created: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
  contractor_notified: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  quote_received: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  pm_approved: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  ll_approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  booked: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', hideDot: true },
  scheduled: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  reminder_sent: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', hideDot: true },

  // Priority
  urgent: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  emergency: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  high: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  low: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },

  // Conversation stages
  greeting: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  address_collection: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  issue_collection: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  availability_collection: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  handoff: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },

  // Default
  default: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b(pm|ll)\b/gi, (m) => m.toUpperCase()) // Keep PM, LL as uppercase acronyms
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export function StatusBadge({ status, variant = 'default', size = 'sm', className }: StatusBadgeProps) {
  const colors = statusColors[status.toLowerCase()] || statusColors.default

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        colors.bg,
        colors.text,
        className
      )}
    >
      {!colors.hideDot && <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />}
      {formatStatus(status)}
    </span>
  )
}

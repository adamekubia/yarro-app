'use client'

import { format } from 'date-fns'
import { ArrowRight, Bot, User, Cog } from 'lucide-react'
import type { LedgerEntry } from '@/hooks/use-ticket-detail'

interface TicketActivityTabProps {
  ledger: LedgerEntry[]
}

const ACTOR_ICONS: Record<string, typeof Cog> = {
  system: Cog,
  ai: Bot,
  manager: User,
}

const EVENT_LABELS: Record<string, string> = {
  STATUS_CHANGED: 'Status changed',
  PRIORITY_CLASSIFIED: 'Priority classified',
  ISSUE_REPORTED: 'Issue reported',
  TICKET_CREATED: 'Ticket created',
  CONTRACTOR_NOTIFIED: 'Contractor notified',
  LANDLORD_NOTIFIED: 'Landlord notified',
  JOB_COMPLETED: 'Job completed',
  JOB_SCHEDULED: 'Job scheduled',
}

function formatEventDetail(entry: LedgerEntry): string | null {
  const data = entry.data
  if (!data) return null

  if (entry.event_type === 'STATUS_CHANGED' && data.from && data.to) {
    return `${data.from} → ${data.to}`
  }
  if (entry.event_type === 'PRIORITY_CLASSIFIED' && data.priority) {
    return `${data.priority}`
  }
  if (entry.event_type === 'ISSUE_REPORTED' && data.source) {
    return `Source: ${data.source}`
  }

  // Fallback: show any simple key-value pairs
  const parts = Object.entries(data)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => `${k}: ${v}`)
  return parts.length > 0 ? parts.join(', ') : null
}

export function TicketActivityTab({ ledger }: TicketActivityTabProps) {
  if (ledger.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Cog className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity recorded yet</p>
          <p className="text-xs mt-1 opacity-60">Events will appear here as the ticket progresses</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {ledger.map((entry, index) => {
        const Icon = ACTOR_ICONS[entry.actor_role] || Cog
        const label = EVENT_LABELS[entry.event_type] || entry.event_type.replace(/_/g, ' ').toLowerCase()
        const detail = formatEventDetail(entry)
        const isLast = index === ledger.length - 1

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border" />}
            </div>

            {/* Content */}
            <div className="pb-4 min-w-0">
              <p className="text-sm font-medium capitalize">{label}</p>
              {detail && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  {entry.event_type === 'STATUS_CHANGED' && entry.data?.from && entry.data?.to ? (
                    <>
                      <span>{String(entry.data.from)}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="font-medium text-foreground">{String(entry.data.to)}</span>
                    </>
                  ) : (
                    detail
                  )}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm')}
                {entry.actor_role !== 'system' && ` • ${entry.actor_role}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { format } from 'date-fns'
import { Building2, Users, Wrench, MapPin, Crown } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import type { TicketContext, TicketBasic, MessageData } from '@/hooks/use-ticket-detail'
import { formatCurrency, getContractors, getRecipient } from '@/hooks/use-ticket-detail'

interface TicketOverviewTabProps {
  context: TicketContext
  basic: TicketBasic
  messages?: MessageData | null
}

function formatDate(date: string | null) {
  if (!date) return null
  return format(new Date(date), 'dd MMM yyyy')
}

/** Dashed separator — receipt style */
function DashedLine() {
  return <div className="w-full border-t-2 border-dashed border-border/60" aria-hidden="true" />
}

/** Single detail row — label left, value right, clean receipt style */
function DetailRow({ label, value, mono, highlight }: {
  label: string
  value: string | null | undefined
  mono?: boolean
  highlight?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">{label}</span>
      <span className={cn(
        'text-sm text-right',
        mono && 'font-mono',
        highlight ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-medium text-foreground',
      )}>
        {value}
      </span>
    </div>
  )
}

export function TicketOverviewTab({ context, basic, messages }: TicketOverviewTabProps) {
  const images = basic.images || []

  const contractorNotes = (() => {
    if (!messages?.contractors) return null
    const contractors = getContractors(messages.contractors)
    const approved = contractors.find(c => c.manager_decision === 'approved')
    if (approved?.quote_notes) return approved.quote_notes
    if (basic.contractor_id) {
      const matched = contractors.find(c => c.id === basic.contractor_id)
      if (matched?.quote_notes) return matched.quote_notes
    }
    const withNotes = contractors.find(c => c.quote_notes)
    return withNotes?.quote_notes || null
  })()

  const markup = (() => {
    if (basic.contractor_quote && basic.final_amount) return formatCurrency(basic.final_amount - basic.contractor_quote)
    const mgr = getRecipient(messages?.manager ?? null)
    if (basic.contractor_quote && mgr?.approval_amount) return formatCurrency(Number(mgr.approval_amount) - basic.contractor_quote)
    return null
  })()

  return (
    <div className="space-y-4">
      {/* Issue Description — prominent */}
      <div className="bg-muted/30 rounded-xl p-4">
        <p className="text-sm leading-relaxed">
          {context.issue_description || 'No description provided'}
        </p>
      </div>

      <DashedLine />

      {/* Details Grid — receipt rows */}
      <div className="px-1 space-y-0">
        <DetailRow label="Category" value={context.category} />
        <DetailRow label="Priority" value={basic.priority || null} />
        <DetailRow label="Logged" value={formatDate(context.date_logged)} />
        <DetailRow label="Reporter" value={context.reporter_role ? context.reporter_role.charAt(0).toUpperCase() + context.reporter_role.slice(1) : null} />
        <DetailRow label="Availability" value={context.availability} />
        <DetailRow label="Access" value={context.access} />
      </div>

      {/* Financial section — only if we have quote data */}
      {basic.contractor_quote && (
        <>
          <DashedLine />
          <div className="px-1 space-y-0">
            <DetailRow label="Quote" value={formatCurrency(basic.contractor_quote)} mono />
            {contractorNotes && <DetailRow label="Notes" value={contractorNotes} />}
            <DetailRow label="Markup" value={markup} mono />
            <DetailRow label="Total" value={basic.final_amount ? formatCurrency(basic.final_amount) : null} mono highlight />
          </div>
        </>
      )}

      {/* Scheduled — highlighted if present */}
      {basic.scheduled_date && (
        <>
          <DashedLine />
          <div className="px-1">
            <DetailRow label="Scheduled" value={formatDate(basic.scheduled_date)} highlight />
          </div>
        </>
      )}

      <DashedLine />

      {/* Linked Parties — tenant, address, contractor, landlord */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Linked</p>

        {/* Tenant */}
        {context.tenant_name && (
          <Link
            href={basic.tenant_id ? `/tenants?id=${basic.tenant_id}` : '#'}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="h-7 w-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:underline">{context.tenant_name}</p>
              <p className="text-[11px] text-muted-foreground">Tenant</p>
            </div>
          </Link>
        )}

        {/* Property / Address */}
        <Link
          href={`/properties?id=${context.property_id}`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
        >
          <div className="h-7 w-7 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
            <MapPin className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:underline">{context.property_address}</p>
            <p className="text-[11px] text-muted-foreground">Property</p>
          </div>
        </Link>

        {/* Contractor */}
        {basic.contractor_name && basic.contractor_id && (
          <Link
            href={`/contractors?id=${basic.contractor_id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="h-7 w-7 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
              <Wrench className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:underline">{basic.contractor_name}</p>
              <p className="text-[11px] text-muted-foreground">Contractor</p>
            </div>
          </Link>
        )}

        {/* Landlord */}
        {context.landlord_name && (
          <Link
            href={`/properties?id=${context.property_id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Crown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:underline">{context.landlord_name}</p>
              <p className="text-[11px] text-muted-foreground">Landlord</p>
            </div>
          </Link>
        )}
      </div>

      {/* Photos */}
      {images.length > 0 && (
        <>
          <DashedLine />
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Photos ({images.length})
            </p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <img
                    src={url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border group-hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

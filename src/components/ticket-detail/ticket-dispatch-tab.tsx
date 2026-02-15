'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, X, MessageCircle } from 'lucide-react'
import type { MessageData, OutboundLogEntry, ContractorEntry } from '@/hooks/use-ticket-detail'
import { getContractors, getRecipient, getContractorStatus, formatAmount } from '@/hooks/use-ticket-detail'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'

// ─── Config ───

const SECTION_LABELS: Record<string, string> = {
  contractor_dispatch: 'Quote Request Sent',
  contractor_reminder: 'Reminder Sent',
  no_contractors_left: 'No Contractors Available',
  pm_quote: 'Quote Forwarded',
  landlord_quote: 'Approval Request Sent',
  landlord_followup: 'Follow-up Sent',
  pm_landlord_timeout: 'Landlord Timeout Alert',
  pm_landlord_approved: 'Approval Notification',
  tenant_job_booked: 'Tenant Notified',
  pm_job_booked: 'Manager Notified',
  landlord_job_booked: 'Landlord Notified',
  contractor_job_reminder: 'Day-of Reminder',
  contractor_completion_reminder: 'Completion Reminder',
  pm_completion_overdue: 'Completion Overdue Alert',
}

const CONTRACTOR_MSG_TYPES = new Set(['contractor_dispatch', 'contractor_reminder', 'no_contractors_left'])
const MANAGER_MSG_TYPES = new Set(['pm_quote'])
const LANDLORD_MSG_TYPES = new Set(['landlord_quote', 'landlord_followup', 'pm_landlord_timeout', 'pm_landlord_approved'])
const BOOKING_MSG_TYPES = new Set(['tenant_job_booked', 'pm_job_booked', 'landlord_job_booked'])
const FOLLOWUP_MSG_TYPES = new Set(['contractor_job_reminder', 'contractor_completion_reminder', 'pm_completion_overdue'])

// ─── Bubble types ───

interface BubbleMsg {
  direction: 'out' | 'in'
  text: string
  timestamp?: string
  html?: boolean
  footer?: string
}

// ─── Helpers ───

function formatBody(text: string): string {
  return text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

function buildContractorBubbles(c: ContractorEntry, logEntries: OutboundLogEntry[]): BubbleMsg[] {
  const msgs: BubbleMsg[] = []

  // Outbound dispatch
  const dispatchLog = logEntries.find(e => e.message_type === 'contractor_dispatch')
  const body = dispatchLog?.body || c.body
  if (body) {
    msgs.push({
      direction: 'out',
      text: body,
      timestamp: dispatchLog?.sent_at || c.sent_at,
      html: true,
    })
  }

  // Reminders
  for (const r of logEntries.filter(e => e.message_type === 'contractor_reminder')) {
    if (r.body) msgs.push({ direction: 'out', text: r.body, timestamp: r.sent_at, html: true })
  }

  // Inbound reply
  if (c.reply_text) {
    const parts: string[] = []
    if (c.quote_amount) parts.push(formatAmount(c.quote_amount))
    if (c.quote_notes) parts.push(c.quote_notes)
    if (c.manager_decision === 'approved') parts.unshift('✓ Approved')

    msgs.push({
      direction: 'in',
      text: c.reply_text,
      timestamp: c.replied_at,
      footer: parts.length > 0 ? parts.join(' · ') : undefined,
    })
  }

  return msgs
}

function buildRecipientBubbles(json: Json | null, logEntries: OutboundLogEntry[]): BubbleMsg[] {
  const msgs: BubbleMsg[] = []
  const entry = getRecipient(json)

  // Outbound from log
  for (const log of logEntries) {
    if (log.body) msgs.push({ direction: 'out', text: log.body, timestamp: log.sent_at, html: true })
  }

  // Fallback: JSONB outbound body if no log entries
  if (msgs.length === 0 && entry?.last_outbound_body) {
    msgs.push({ direction: 'out', text: entry.last_outbound_body, timestamp: entry.review_request_sent_at, html: true })
  }

  // Inbound reply
  if (entry?.last_text) {
    const footer = entry.approval !== undefined
      ? `${entry.approval ? '✓ Approved' : '✗ Declined'}${entry.approval_amount ? ` · ${entry.approval_amount}` : ''}`
      : undefined
    msgs.push({ direction: 'in', text: entry.last_text, timestamp: entry.replied_at, footer })
  }

  return msgs
}

// ─── Sub-components ───

function StatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    quoted: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    declined: 'bg-red-500/10 text-red-700 dark:text-red-400',
  }
  return (
    <span className={cn('px-2 py-0.5 text-[11px] rounded-full font-medium capitalize', style[status] || style.pending)}>
      {status}
    </span>
  )
}

function SectionBlock({ title, badge, children, visible = true, defaultOpen = false }: {
  title: string
  badge?: string
  children: React.ReactNode
  visible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (!visible) return null

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {badge && (
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  )
}

function MessageOverlay({ title, messages, onClose }: {
  title: string
  messages: BubbleMsg[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">{title}</span>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length > 0 ? messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.direction === 'out' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed',
                msg.direction === 'out' ? 'bg-primary/10 border' : 'bg-muted',
              )}>
                {msg.html ? (
                  <div dangerouslySetInnerHTML={{ __html: formatBody(msg.text) }} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
                {msg.footer && (
                  <p className={cn(
                    'mt-1.5 pt-1.5 border-t text-[11px] font-medium',
                    msg.footer.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' :
                    msg.footer.startsWith('✗') ? 'text-red-600 dark:text-red-400' : 'text-foreground/70',
                  )}>
                    {msg.footer}
                  </p>
                )}
                {msg.timestamp && (
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {format(new Date(msg.timestamp), 'dd MMM, HH:mm')}
                  </p>
                )}
              </div>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground text-center py-8">No messages recorded</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───

interface TicketDispatchTabProps {
  messages: MessageData | null
  outboundLog: OutboundLogEntry[]
}

export function TicketDispatchTab({ messages, outboundLog }: TicketDispatchTabProps) {
  const [overlay, setOverlay] = useState<{ title: string; messages: BubbleMsg[] } | null>(null)

  // Group outbound log entries by section
  const logBySection = useMemo(() => {
    const groups = {
      contractor: [] as OutboundLogEntry[],
      manager: [] as OutboundLogEntry[],
      landlord: [] as OutboundLogEntry[],
      booking: [] as OutboundLogEntry[],
      followup: [] as OutboundLogEntry[],
    }
    for (const entry of outboundLog) {
      if (CONTRACTOR_MSG_TYPES.has(entry.message_type)) groups.contractor.push(entry)
      else if (MANAGER_MSG_TYPES.has(entry.message_type)) groups.manager.push(entry)
      else if (LANDLORD_MSG_TYPES.has(entry.message_type)) groups.landlord.push(entry)
      else if (BOOKING_MSG_TYPES.has(entry.message_type)) groups.booking.push(entry)
      else if (FOLLOWUP_MSG_TYPES.has(entry.message_type)) groups.followup.push(entry)
    }
    return groups
  }, [outboundLog])

  // Contractor data from JSONB
  const contractors = useMemo(() => messages ? getContractors(messages.contractors) : [], [messages])
  const manager = useMemo(() => messages ? getRecipient(messages.manager) : null, [messages])
  const landlord = useMemo(() => messages ? getRecipient(messages.landlord) : null, [messages])

  // Section visibility
  const hasContractors = contractors.length > 0 || logBySection.contractor.length > 0
  const hasManager = manager !== null || logBySection.manager.length > 0
  const hasLandlord = landlord !== null || logBySection.landlord.length > 0
  const hasBooking = logBySection.booking.length > 0
  const hasFollowup = logBySection.followup.length > 0

  if (!hasContractors && !hasManager && !hasLandlord && !hasBooking && !hasFollowup) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="text-center">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No dispatch activity yet</p>
        </div>
      </div>
    )
  }

  // ─── Contractor section click handler ───
  const openContractor = (c: ContractorEntry) => {
    const logEntries = logBySection.contractor.filter(e => e.recipient_phone === c.phone)
    const bubbles = buildContractorBubbles(c, logEntries)
    setOverlay({ title: c.name, messages: bubbles })
  }

  // ─── Manager section click handler ───
  const openManager = () => {
    const bubbles = buildRecipientBubbles(messages?.manager ?? null, logBySection.manager)
    setOverlay({ title: manager?.name || 'Manager', messages: bubbles })
  }

  // ─── Landlord section click handler ───
  const openLandlord = () => {
    const bubbles = buildRecipientBubbles(messages?.landlord ?? null, logBySection.landlord)
    setOverlay({ title: landlord?.name || 'Landlord', messages: bubbles })
  }

  // ─── Log entry click handler ───
  const openLogEntry = (entry: OutboundLogEntry) => {
    if (!entry.body) return
    const label = SECTION_LABELS[entry.message_type] || entry.message_type.replace(/_/g, ' ')
    setOverlay({
      title: label,
      messages: [{ direction: 'out', text: entry.body, timestamp: entry.sent_at, html: true }],
    })
  }

  // Contractor badge
  const quotedCount = contractors.filter(c => c.replied_at || c.quote_amount).length
  const contractorBadge = quotedCount > 0
    ? `${quotedCount} quoted · ${contractors.length} total`
    : `${contractors.length} contractor${contractors.length !== 1 ? 's' : ''}`

  // Manager status
  const managerStatus = manager?.approval !== undefined
    ? (manager.approval ? 'approved' : 'declined')
    : manager?.replied_at ? 'replied' : manager?.review_request_sent_at ? 'sent' : 'pending'

  // Landlord status
  const landlordStatus = landlord?.approval !== undefined
    ? (landlord.approval ? 'approved' : 'declined')
    : landlord?.replied_at ? 'replied' : landlord?.review_request_sent_at ? 'sent' : 'pending'

  return (
    <div className="space-y-3">
      {/* ─── Section 1: Contractor Quote Collection ─── */}
      <SectionBlock
        title="Contractor Quotes"
        badge={hasContractors ? contractorBadge : undefined}
        visible={hasContractors}
        defaultOpen={hasContractors}
      >
        <div className="divide-y">
          {contractors.map(c => {
            const status = getContractorStatus(c)
            const statusLabel = status === 'approved' ? 'approved' : status === 'replied' ? 'quoted' : status === 'sent' ? 'sent' : 'pending'

            return (
              <button
                key={c.id}
                onClick={() => openContractor(c)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.category && <>{c.category} · </>}
                    {c.sent_at ? format(new Date(c.sent_at), 'dd MMM, HH:mm') : 'Not yet sent'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.quote_amount && (
                    <span className="text-xs font-medium">{formatAmount(c.quote_amount)}</span>
                  )}
                  <StatusBadge status={statusLabel} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            )
          })}

          {/* Log-only entries not tied to a contractor (e.g. no_contractors_left) */}
          {logBySection.contractor
            .filter(e => e.message_type === 'no_contractors_left')
            .map(entry => (
              <div key={entry.id} className="px-4 py-3 text-sm text-muted-foreground">
                No contractors available · {format(new Date(entry.sent_at), 'dd MMM, HH:mm')}
              </div>
            ))
          }
        </div>
      </SectionBlock>

      {/* ─── Section 2: Manager Approval ─── */}
      <SectionBlock
        title="Quote Approval"
        badge={hasManager ? managerStatus : undefined}
        visible={hasManager}
        defaultOpen={hasManager}
      >
        <button
          onClick={openManager}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{manager?.name || 'Property Manager'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {manager?.review_request_sent_at
                ? `Sent ${format(new Date(manager.review_request_sent_at), 'dd MMM, HH:mm')}`
                : 'Pending'
              }
              {manager?.approval_amount && ` · ${manager.approval_amount}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={managerStatus} />
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </button>
      </SectionBlock>

      {/* ─── Section 3: Landlord Approval ─── */}
      <SectionBlock
        title="Landlord Approval"
        badge={hasLandlord ? landlordStatus : undefined}
        visible={hasLandlord}
        defaultOpen={hasLandlord}
      >
        <button
          onClick={openLandlord}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{landlord?.name || 'Landlord'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {landlord?.review_request_sent_at
                ? `Sent ${format(new Date(landlord.review_request_sent_at), 'dd MMM, HH:mm')}`
                : 'Pending'
              }
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={landlordStatus} />
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </button>
      </SectionBlock>

      {/* ─── Section 4: Job Booking ─── */}
      <SectionBlock
        title="Job Booking"
        badge={hasBooking ? `${logBySection.booking.length} sent` : undefined}
        visible={hasBooking}
        defaultOpen={false}
      >
        <div className="divide-y">
          {logBySection.booking.map(entry => (
            <button
              key={entry.id}
              onClick={() => openLogEntry(entry)}
              disabled={!entry.body}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-left',
                entry.body ? 'hover:bg-muted/30 transition-colors' : 'opacity-70',
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {SECTION_LABELS[entry.message_type] || entry.message_type}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(entry.sent_at), 'dd MMM, HH:mm')}
                </p>
              </div>
              {entry.body && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>
      </SectionBlock>

      {/* ─── Section 5: Follow-up & Reminders ─── */}
      <SectionBlock
        title="Follow-up"
        badge={hasFollowup ? `${logBySection.followup.length}` : undefined}
        visible={hasFollowup}
        defaultOpen={false}
      >
        <div className="divide-y">
          {logBySection.followup.map(entry => (
            <button
              key={entry.id}
              onClick={() => openLogEntry(entry)}
              disabled={!entry.body}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-left',
                entry.body ? 'hover:bg-muted/30 transition-colors' : 'opacity-70',
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {SECTION_LABELS[entry.message_type] || entry.message_type}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(entry.sent_at), 'dd MMM, HH:mm')}
                </p>
              </div>
              {entry.body && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>
      </SectionBlock>

      {/* ─── Message Overlay ─── */}
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          messages={overlay.messages}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}

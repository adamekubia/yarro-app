'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ChevronRight, X, MessageCircle } from 'lucide-react'
import { ChatHistory } from '@/components/chat-message'
import type { MessageData, OutboundLogEntry } from '@/hooks/use-ticket-detail'
import { getContractors, getRecipient, getContractorStatus, formatAmount } from '@/hooks/use-ticket-detail'
import { cn } from '@/lib/utils'

// ─── Config ───

const TYPE_LABELS: Record<string, string> = {
  tenant_job_booked: 'Tenant Notified',
  pm_job_booked: 'Manager Notified',
  landlord_job_booked: 'Landlord Notified',
  contractor_job_reminder: 'Day-of Reminder',
  contractor_completion_reminder: 'Completion Reminder',
  pm_completion_overdue: 'Completion Overdue',
}

const CONTRACTOR_LOG_TYPES = new Set(['contractor_dispatch', 'contractor_reminder', 'no_contractors_left'])
const MANAGER_LOG_TYPES = new Set(['pm_quote'])
const LANDLORD_LOG_TYPES = new Set(['landlord_quote', 'landlord_followup', 'pm_landlord_timeout', 'pm_landlord_approved'])
const BOOKING_LOG_TYPES = new Set(['tenant_job_booked', 'pm_job_booked', 'landlord_job_booked'])
const FOLLOWUP_LOG_TYPES = new Set(['contractor_job_reminder', 'contractor_completion_reminder', 'pm_completion_overdue'])

// ─── Types ───

type ChatMsg = { role: string; text: string; timestamp?: string; allowHtml?: boolean; meta?: { quote?: string; approved?: boolean; amount?: string } }

interface PurposeEntry {
  id: string
  phase: string
  label: string
  sublabel?: string
  status: string
  amount?: string
  timestamp: string
  isEscalation: boolean
  chatMessages: ChatMsg[]
}

// ─── Badge ───

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  awaiting: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  quoted: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  declined: 'bg-red-500/10 text-red-700 dark:text-red-400',
  escalation: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

// ─── Build purpose entries ───

function buildEntries(messages: MessageData | null, outboundLog: OutboundLogEntry[]): PurposeEntry[] {
  const entries: PurposeEntry[] = []

  // Group log entries
  const contractorLogs = outboundLog.filter(e => CONTRACTOR_LOG_TYPES.has(e.message_type))
  const managerLogs = outboundLog.filter(e => MANAGER_LOG_TYPES.has(e.message_type))
  const landlordLogs = outboundLog.filter(e => LANDLORD_LOG_TYPES.has(e.message_type))
  const bookingLogs = outboundLog.filter(e => BOOKING_LOG_TYPES.has(e.message_type))
  const followupLogs = outboundLog.filter(e => FOLLOWUP_LOG_TYPES.has(e.message_type))

  // ─── Contractors: one row per contractor ───
  if (messages) {
    const contractors = getContractors(messages.contractors)
    for (const c of contractors) {
      const rawStatus = getContractorStatus(c)
      const status = rawStatus === 'approved' ? 'approved' : rawStatus === 'replied' ? 'quoted' : rawStatus === 'sent' ? 'sent' : 'pending'

      // Chat messages: dispatch + reminders + reply
      const chatMsgs: ChatMsg[] = []
      const myLogs = contractorLogs.filter(e => e.recipient_phone === c.phone)

      const dispatchLog = myLogs.find(e => e.message_type === 'contractor_dispatch')
      const dispatchBody = dispatchLog?.body || c.body
      if (dispatchBody) chatMsgs.push({ role: 'assistant', text: dispatchBody, timestamp: dispatchLog?.sent_at || c.sent_at, allowHtml: true })

      for (const r of myLogs.filter(e => e.message_type === 'contractor_reminder')) {
        if (r.body) chatMsgs.push({ role: 'assistant', text: r.body, timestamp: r.sent_at, allowHtml: true })
      }

      if (c.reply_text) {
        chatMsgs.push({
          role: 'tenant',
          text: c.reply_text,
          timestamp: c.replied_at,
          meta: c.quote_amount ? { quote: formatAmount(c.quote_amount), approved: c.manager_decision === 'approved' } : undefined,
        })
      }

      // Sublabel
      const parts: string[] = []
      if (c.category) parts.push(c.category)
      if (c.sent_at) parts.push(format(new Date(c.sent_at), 'dd MMM, HH:mm'))
      const reminders = myLogs.filter(e => e.message_type === 'contractor_reminder')
      if (reminders.length > 0) parts.push(`${reminders.length} reminder${reminders.length > 1 ? 's' : ''}`)
      if (c.quote_notes) parts.push(c.quote_notes)

      entries.push({
        id: `contractor-${c.id}`,
        phase: 'Contractor Quotes',
        label: c.name,
        sublabel: parts.join(' · '),
        status,
        amount: c.quote_amount ? formatAmount(c.quote_amount) : undefined,
        timestamp: c.sent_at || '',
        isEscalation: false,
        chatMessages: chatMsgs,
      })
    }
  }

  // No contractors available
  for (const entry of contractorLogs.filter(e => e.message_type === 'no_contractors_left')) {
    entries.push({
      id: entry.id,
      phase: 'Contractor Quotes',
      label: 'No Contractors Available',
      sublabel: format(new Date(entry.sent_at), 'dd MMM, HH:mm'),
      status: 'escalation',
      timestamp: entry.sent_at,
      isEscalation: true,
      chatMessages: entry.body ? [{ role: 'assistant', text: entry.body, timestamp: entry.sent_at, allowHtml: true }] : [],
    })
  }

  // ─── Manager: one row ───
  if (messages) {
    const manager = getRecipient(messages.manager)
    if (manager && (manager.review_request_sent_at || managerLogs.length > 0)) {
      const chatMsgs: ChatMsg[] = []

      for (const log of managerLogs) {
        if (log.body) chatMsgs.push({ role: 'assistant', text: log.body, timestamp: log.sent_at, allowHtml: true })
      }
      if (chatMsgs.length === 0 && manager.last_outbound_body) {
        chatMsgs.push({ role: 'assistant', text: manager.last_outbound_body, timestamp: manager.review_request_sent_at, allowHtml: true })
      }
      if (manager.last_text) {
        chatMsgs.push({
          role: 'tenant', text: manager.last_text, timestamp: manager.replied_at,
          meta: { approved: manager.approval ?? undefined, amount: manager.approval_amount },
        })
      }

      const status = manager.approval !== undefined
        ? (manager.approval ? 'approved' : 'declined')
        : manager.replied_at ? 'quoted' : 'awaiting'

      entries.push({
        id: 'manager-approval',
        phase: 'Quote Approval',
        label: manager.name || 'Manager Approval',
        sublabel: manager.review_request_sent_at ? `Sent ${format(new Date(manager.review_request_sent_at), 'dd MMM, HH:mm')}` : undefined,
        status,
        amount: manager.approval_amount || undefined,
        timestamp: manager.review_request_sent_at || '',
        isEscalation: false,
        chatMessages: chatMsgs,
      })
    }
  }

  // ─── Landlord: one row (includes follow-ups, timeouts) ───
  if (messages) {
    const landlord = getRecipient(messages.landlord)
    if (landlord && (landlord.review_request_sent_at || landlordLogs.length > 0)) {
      const chatMsgs: ChatMsg[] = []

      // All outbound chronologically (quote, follow-ups, timeout alerts, approval notifs)
      const sortedLogs = [...landlordLogs].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
      for (const log of sortedLogs) {
        if (log.body) chatMsgs.push({ role: 'assistant', text: log.body, timestamp: log.sent_at, allowHtml: true })
      }
      if (chatMsgs.length === 0 && landlord.last_outbound_body) {
        chatMsgs.push({ role: 'assistant', text: landlord.last_outbound_body, timestamp: landlord.review_request_sent_at, allowHtml: true })
      }
      if (landlord.last_text) {
        chatMsgs.push({
          role: 'tenant', text: landlord.last_text, timestamp: landlord.replied_at,
          meta: { approved: landlord.approval ?? undefined },
        })
      }

      const status = landlord.approval !== undefined
        ? (landlord.approval ? 'approved' : 'declined')
        : landlord.replied_at ? 'quoted' : 'awaiting'

      // Sublabel with context
      const subParts: string[] = []
      if (landlord.review_request_sent_at) subParts.push(`Sent ${format(new Date(landlord.review_request_sent_at), 'dd MMM, HH:mm')}`)
      const followups = landlordLogs.filter(e => e.message_type === 'landlord_followup')
      if (followups.length > 0) subParts.push(`${followups.length} follow-up${followups.length > 1 ? 's' : ''}`)
      const timeouts = landlordLogs.filter(e => e.message_type === 'pm_landlord_timeout')
      if (timeouts.length > 0) subParts.push('timeout alert')

      entries.push({
        id: 'landlord-approval',
        phase: 'Landlord Approval',
        label: landlord.name || 'Landlord Approval',
        sublabel: subParts.join(' · '),
        status,
        timestamp: landlord.review_request_sent_at || '',
        isEscalation: false,
        chatMessages: chatMsgs,
      })
    }
  }

  // ─── Booking: individual notifications ───
  for (const entry of bookingLogs) {
    entries.push({
      id: entry.id,
      phase: 'Job Booking',
      label: TYPE_LABELS[entry.message_type] || entry.message_type,
      sublabel: format(new Date(entry.sent_at), 'dd MMM, HH:mm'),
      status: 'sent',
      timestamp: entry.sent_at,
      isEscalation: false,
      chatMessages: entry.body ? [{ role: 'assistant', text: entry.body, timestamp: entry.sent_at, allowHtml: true }] : [],
    })
  }

  // ─── Follow-up: individual reminders/escalations ───
  for (const entry of followupLogs) {
    entries.push({
      id: entry.id,
      phase: 'Follow-up',
      label: TYPE_LABELS[entry.message_type] || entry.message_type,
      sublabel: format(new Date(entry.sent_at), 'dd MMM, HH:mm'),
      status: entry.message_type === 'pm_completion_overdue' ? 'escalation' : 'sent',
      timestamp: entry.sent_at,
      isEscalation: entry.message_type === 'pm_completion_overdue',
      chatMessages: entry.body ? [{ role: 'assistant', text: entry.body, timestamp: entry.sent_at, allowHtml: true }] : [],
    })
  }

  return entries
}

// ─── Component ───

interface TicketDispatchTabProps {
  messages: MessageData | null
  outboundLog: OutboundLogEntry[]
}

export function TicketDispatchTab({ messages, outboundLog }: TicketDispatchTabProps) {
  const [overlay, setOverlay] = useState<{ title: string; messages: ChatMsg[] } | null>(null)
  const entries = useMemo(() => buildEntries(messages, outboundLog), [messages, outboundLog])

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="text-center">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No dispatch activity yet</p>
        </div>
      </div>
    )
  }

  let lastPhase = ''

  return (
    <div>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1
        const showDivider = entry.phase !== lastPhase
        lastPhase = entry.phase

        const isClickable = entry.chatMessages.length > 0

        return (
          <div key={entry.id}>
            {/* Phase divider */}
            {showDivider && (
              <div className={cn('flex items-center gap-3', index > 0 ? 'pt-4 pb-2' : 'pb-2')}>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{entry.phase}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {/* Entry row */}
            <div className="flex gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'rounded-full shrink-0 mt-1.5 h-2.5 w-2.5',
                  entry.isEscalation ? 'bg-red-500' : 'bg-foreground/40',
                )} />
                {!isLast && <div className="w-px flex-1 bg-border/40 mt-1" />}
              </div>

              {/* Content */}
              <div className={cn('min-w-0 flex-1', !isLast ? 'pb-4' : 'pb-1')}>
                <button
                  onClick={() => isClickable && setOverlay({ title: entry.label, messages: entry.chatMessages })}
                  disabled={!isClickable}
                  className={cn(
                    'w-full text-left',
                    isClickable && 'hover:bg-muted/30 -mx-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer',
                    !isClickable && 'py-0.5 cursor-default',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{entry.label}</p>
                        {entry.amount && (
                          <span className="text-xs font-medium text-foreground/70">{entry.amount}</span>
                        )}
                        <span className={cn('px-1.5 py-0.5 text-[10px] rounded-full font-medium capitalize', STATUS_STYLES[entry.status] || STATUS_STYLES.pending)}>
                          {entry.status}
                        </span>
                      </div>
                      {entry.sublabel && (
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.sublabel}</p>
                      )}
                    </div>
                    {isClickable && (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Message overlay — ChatHistory from conversation tab */}
      {overlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOverlay(null)}>
          <div
            className="bg-background border rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">{overlay.title}</span>
              <button onClick={() => setOverlay(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 rounded-b-xl p-4">
              <ChatHistory
                messages={overlay.messages}
                allowHtmlForAssistant
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

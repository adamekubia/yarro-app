'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, X, MessageCircle } from 'lucide-react'
import { ChatHistory } from '@/components/chat-message'
import type { MessageData, OutboundLogEntry, ContractorEntry } from '@/hooks/use-ticket-detail'
import { getContractors, getRecipient, getContractorStatus, formatAmount } from '@/hooks/use-ticket-detail'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'

// ─── Config ───

const TYPE_LABELS: Record<string, string> = {
  contractor_dispatch: 'Contractor Dispatched',
  contractor_reminder: 'Contractor Reminder',
  no_contractors_left: 'No Contractors Available',
  pm_quote: 'Quote Sent to Manager',
  landlord_quote: 'Quote Sent to Landlord',
  landlord_followup: 'Landlord Follow-up',
  pm_landlord_timeout: 'Landlord Timeout Alert',
  pm_landlord_approved: 'Landlord Approved — PM Notified',
  tenant_job_booked: 'Job Booked — Tenant',
  pm_job_booked: 'Job Booked — Manager',
  landlord_job_booked: 'Job Booked — Landlord',
  contractor_job_reminder: 'Job Reminder',
  contractor_completion_reminder: 'Completion Reminder',
  pm_completion_overdue: 'Completion Overdue',
  contractor_reply: 'Contractor Quoted',
  manager_reply: 'Manager Responded',
  landlord_reply: 'Landlord Responded',
}

// Phase grouping for section dividers
const PHASE_MAP: Record<string, string> = {
  contractor_dispatch: 'Contractor Quotes',
  contractor_reminder: 'Contractor Quotes',
  no_contractors_left: 'Contractor Quotes',
  contractor_reply: 'Contractor Quotes',
  pm_quote: 'Quote Approval',
  manager_reply: 'Quote Approval',
  landlord_quote: 'Landlord Approval',
  landlord_followup: 'Landlord Approval',
  pm_landlord_timeout: 'Landlord Approval',
  pm_landlord_approved: 'Landlord Approval',
  landlord_reply: 'Landlord Approval',
  tenant_job_booked: 'Job Booking',
  pm_job_booked: 'Job Booking',
  landlord_job_booked: 'Job Booking',
  contractor_job_reminder: 'Follow-up',
  contractor_completion_reminder: 'Follow-up',
  pm_completion_overdue: 'Follow-up',
}

const ESCALATION_TYPES = new Set(['pm_landlord_timeout', 'pm_completion_overdue', 'no_contractors_left'])
const CONTRACTOR_MSG_TYPES = new Set(['contractor_dispatch', 'contractor_reminder'])
const MANAGER_MSG_TYPES = new Set(['pm_quote'])
const LANDLORD_MSG_TYPES = new Set(['landlord_quote', 'landlord_followup', 'pm_landlord_timeout', 'pm_landlord_approved'])

// ─── Timeline item ───

interface TimelineItem {
  id: string
  timestamp: string
  direction: 'outbound' | 'inbound'
  messageType: string
  label: string
  sublabel?: string
  body?: string | null
  isEscalation: boolean
  badge?: { text: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
  // For overlay
  chatMessages?: { role: string; text: string; timestamp?: string; allowHtml?: boolean; meta?: { quote?: string; approved?: boolean; amount?: string } }[]
}

// ─── Build timeline ───

function buildTimeline(messages: MessageData | null, outboundLog: OutboundLogEntry[]): TimelineItem[] {
  const items: TimelineItem[] = []
  const logPhones = new Set(outboundLog.map(e => `${e.message_type}:${e.recipient_phone}`))

  // 1. Outbound log entries
  for (const entry of outboundLog) {
    const item: TimelineItem = {
      id: entry.id,
      timestamp: entry.sent_at,
      direction: 'outbound',
      messageType: entry.message_type,
      label: TYPE_LABELS[entry.message_type] || entry.message_type.replace(/_/g, ' '),
      body: entry.body,
      isEscalation: ESCALATION_TYPES.has(entry.message_type),
    }

    // Enrich contractor entries with name
    if (messages && entry.recipient_role === 'contractor') {
      const contractors = getContractors(messages.contractors)
      const match = contractors.find(c => c.phone === entry.recipient_phone)
      if (match) {
        item.sublabel = `${match.name}${match.category ? ` · ${match.category}` : ''}`
      }
    }

    // Build chat messages for overlay
    if (entry.body) {
      item.chatMessages = [{ role: 'assistant', text: entry.body, timestamp: entry.sent_at, allowHtml: true }]
    }

    items.push(item)
  }

  // 2. Synthetic entries from JSONB
  if (messages) {
    const contractors = getContractors(messages.contractors)
    for (const c of contractors) {
      // Synthetic dispatch (if not in outbound log)
      if (c.sent_at && !logPhones.has(`contractor_dispatch:${c.phone}`)) {
        const chatMsgs: TimelineItem['chatMessages'] = []
        if (c.body) chatMsgs.push({ role: 'assistant', text: c.body, timestamp: c.sent_at, allowHtml: true })

        items.push({
          id: `synth-dispatch-${c.id}`,
          timestamp: c.sent_at,
          direction: 'outbound',
          messageType: 'contractor_dispatch',
          label: 'Contractor Dispatched',
          sublabel: `${c.name}${c.category ? ` · ${c.category}` : ''}`,
          body: c.body || null,
          isEscalation: false,
          chatMessages: chatMsgs.length > 0 ? chatMsgs : undefined,
        })
      }

      // Contractor reply (always synthetic — inbound)
      if (c.replied_at) {
        // Build chat messages: outbound dispatch + inbound reply
        const chatMsgs: TimelineItem['chatMessages'] = []
        // Find the outbound body for this contractor
        const dispatchLog = outboundLog.find(e => e.message_type === 'contractor_dispatch' && e.recipient_phone === c.phone)
        const outBody = dispatchLog?.body || c.body
        if (outBody) chatMsgs.push({ role: 'assistant', text: outBody, timestamp: dispatchLog?.sent_at || c.sent_at, allowHtml: true })
        if (c.reply_text) {
          chatMsgs.push({
            role: 'tenant',
            text: c.reply_text,
            timestamp: c.replied_at,
            meta: c.quote_amount ? { quote: formatAmount(c.quote_amount), approved: c.manager_decision === 'approved' } : undefined,
          })
        }

        items.push({
          id: `synth-reply-${c.id}`,
          timestamp: c.replied_at,
          direction: 'inbound',
          messageType: 'contractor_reply',
          label: `${c.name} quoted`,
          sublabel: c.quote_notes || undefined,
          isEscalation: false,
          badge: c.manager_decision === 'approved'
            ? { text: `Approved ${formatAmount(c.quote_amount)}`, variant: 'success' }
            : c.quote_amount
            ? { text: formatAmount(c.quote_amount), variant: 'neutral' }
            : undefined,
          chatMessages: chatMsgs.length > 0 ? chatMsgs : undefined,
        })
      }
    }

    // Manager
    const manager = getRecipient(messages.manager)
    if (manager) {
      if (manager.review_request_sent_at && !logPhones.has(`pm_quote:${manager.phone}`)) {
        const chatMsgs: TimelineItem['chatMessages'] = []
        if (manager.last_outbound_body) chatMsgs.push({ role: 'assistant', text: manager.last_outbound_body, timestamp: manager.review_request_sent_at, allowHtml: true })

        items.push({
          id: 'synth-pm-quote',
          timestamp: manager.review_request_sent_at,
          direction: 'outbound',
          messageType: 'pm_quote',
          label: 'Quote Sent to Manager',
          body: manager.last_outbound_body || null,
          isEscalation: false,
          chatMessages: chatMsgs.length > 0 ? chatMsgs : undefined,
        })
      }
      if (manager.replied_at) {
        const chatMsgs: TimelineItem['chatMessages'] = []
        if (manager.last_outbound_body) chatMsgs.push({ role: 'assistant', text: manager.last_outbound_body, timestamp: manager.review_request_sent_at, allowHtml: true })
        if (manager.last_text) {
          chatMsgs.push({
            role: 'tenant',
            text: manager.last_text,
            timestamp: manager.replied_at,
            meta: { approved: manager.approval ?? undefined, amount: manager.approval_amount },
          })
        }

        items.push({
          id: 'synth-manager-reply',
          timestamp: manager.replied_at,
          direction: 'inbound',
          messageType: 'manager_reply',
          label: manager.approval ? 'Manager Approved' : manager.approval === false ? 'Manager Declined' : 'Manager Replied',
          isEscalation: false,
          badge: manager.approval
            ? { text: `Approved${manager.approval_amount ? ` ${manager.approval_amount}` : ''}`, variant: 'success' }
            : manager.approval === false
            ? { text: 'Declined', variant: 'danger' }
            : undefined,
          chatMessages: chatMsgs.length > 0 ? chatMsgs : undefined,
        })
      }
    }

    // Landlord
    const landlord = getRecipient(messages.landlord)
    if (landlord) {
      if (landlord.review_request_sent_at && !logPhones.has(`landlord_quote:${landlord.phone}`)) {
        const chatMsgs: TimelineItem['chatMessages'] = []
        if (landlord.last_outbound_body) chatMsgs.push({ role: 'assistant', text: landlord.last_outbound_body, timestamp: landlord.review_request_sent_at, allowHtml: true })

        items.push({
          id: 'synth-ll-quote',
          timestamp: landlord.review_request_sent_at,
          direction: 'outbound',
          messageType: 'landlord_quote',
          label: 'Quote Sent to Landlord',
          body: landlord.last_outbound_body || null,
          isEscalation: false,
          chatMessages: chatMsgs.length > 0 ? chatMsgs : undefined,
        })
      }
      if (landlord.replied_at) {
        const chatMsgs: TimelineItem['chatMessages'] = []
        if (landlord.last_outbound_body) chatMsgs.push({ role: 'assistant', text: landlord.last_outbound_body, timestamp: landlord.review_request_sent_at, allowHtml: true })
        if (landlord.last_text) {
          chatMsgs.push({
            role: 'tenant',
            text: landlord.last_text,
            timestamp: landlord.replied_at,
            meta: { approved: landlord.approval ?? undefined },
          })
        }

        items.push({
          id: 'synth-landlord-reply',
          timestamp: landlord.replied_at,
          direction: 'inbound',
          messageType: 'landlord_reply',
          label: landlord.approval ? 'Landlord Approved' : landlord.approval === false ? 'Landlord Declined' : 'Landlord Replied',
          isEscalation: false,
          badge: landlord.approval
            ? { text: 'Approved', variant: 'success' }
            : landlord.approval === false
            ? { text: 'Declined', variant: 'danger' }
            : undefined,
          chatMessages: chatMsgs.length > 0 ? chatMsgs : undefined,
        })
      }
    }
  }

  items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return items
}

// ─── Badge ───

const BADGE_STYLES = {
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-700 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

// ─── Component ───

interface TicketDispatchTabProps {
  messages: MessageData | null
  outboundLog: OutboundLogEntry[]
}

export function TicketDispatchTab({ messages, outboundLog }: TicketDispatchTabProps) {
  const [overlay, setOverlay] = useState<{ title: string; messages: NonNullable<TimelineItem['chatMessages']> } | null>(null)
  const timeline = useMemo(() => buildTimeline(messages, outboundLog), [messages, outboundLog])

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="text-center">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No dispatch activity yet</p>
        </div>
      </div>
    )
  }

  // Track phase dividers
  let lastPhase = ''

  return (
    <div>
      {timeline.map((item, index) => {
        const isLast = index === timeline.length - 1
        const phase = PHASE_MAP[item.messageType] || ''
        const showDivider = phase && phase !== lastPhase
        if (phase) lastPhase = phase

        const hasMessages = item.chatMessages && item.chatMessages.length > 0
        const isClickable = hasMessages

        return (
          <div key={item.id}>
            {/* Phase divider */}
            {showDivider && (
              <div className={cn('flex items-center gap-3', index > 0 ? 'pt-4 pb-2' : 'pb-2')}>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{phase}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {/* Timeline row */}
            <div className="flex gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'rounded-full shrink-0 mt-1',
                  item.isEscalation ? 'h-2.5 w-2.5 bg-red-500' :
                  item.direction === 'inbound' ? 'h-2.5 w-2.5 bg-foreground/30' :
                  'h-2.5 w-2.5 bg-foreground/50',
                )} />
                {!isLast && <div className="w-px flex-1 bg-border/40 mt-1" />}
              </div>

              {/* Content */}
              <div className={cn('min-w-0 flex-1', !isLast ? 'pb-4' : 'pb-1')}>
                <button
                  onClick={() => isClickable && setOverlay({ title: item.label, messages: item.chatMessages! })}
                  disabled={!isClickable}
                  className={cn(
                    'w-full text-left',
                    isClickable && 'hover:bg-muted/30 -mx-2 px-2 py-1 rounded-md transition-colors cursor-pointer',
                    !isClickable && 'cursor-default',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn('text-sm', item.direction === 'outbound' ? 'font-medium' : 'font-normal')}>
                          {item.label}
                        </p>
                        {item.badge && (
                          <span className={cn('px-1.5 py-0.5 text-[10px] rounded-full font-medium', BADGE_STYLES[item.badge.variant])}>
                            {item.badge.text}
                          </span>
                        )}
                        {item.isEscalation && (
                          <span className={cn('px-1.5 py-0.5 text-[10px] rounded-full font-medium', BADGE_STYLES.danger)}>
                            escalation
                          </span>
                        )}
                      </div>
                      {item.sublabel && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.sublabel}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(item.timestamp), 'dd MMM, HH:mm')}
                      </span>
                      {isClickable && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Message overlay — uses same ChatHistory as conversation tab */}
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

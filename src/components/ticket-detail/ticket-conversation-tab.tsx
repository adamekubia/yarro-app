'use client'

import { useState, useMemo } from 'react'
import { ChatHistory } from '@/components/chat-message'
import { Phone, User } from 'lucide-react'
import { format } from 'date-fns'
import { formatPhoneDisplay } from '@/lib/normalize'
import { cn } from '@/lib/utils'
import type { ConversationData, OutboundLogEntry } from '@/hooks/use-ticket-detail'
import { getLogEntries } from '@/hooks/use-ticket-detail'

// ─── Stage labels for dividers ───
const STAGE_MAP: Record<string, string> = {
  pm_ticket_created: 'Ticket Created',
  pm_ticket_review: 'Ticket Created',
  ll_ticket_created: 'Ticket Created',
  pm_handoff: 'Handoff',
  ooh_emergency_dispatch: 'OOH Dispatch',
  contractor_dispatch: 'Dispatch',
  pm_quote: 'Quote Review',
  landlord_quote: 'Quote Approval',
  pm_landlord_approved: 'Quote Approved',
  landlord_declined: 'Quote Declined',
  landlord_followup: 'Follow-up',
  pm_landlord_timeout: 'Landlord Timeout',
  contractor_job_schedule: 'Job Booking',
  contractor_job_confirmed: 'Booking Confirmed',
  tenant_job_booked: 'Booking Confirmed',
  pm_job_booked: 'Booking Confirmed',
  ll_job_booked: 'Booking Confirmed',
  contractor_job_reminder: 'Day-of Reminder',
  contractor_completion_reminder: 'Completion Reminder',
  pm_completion_overdue: 'Completion Overdue',
  pm_job_completed: 'Job Completed',
  pm_job_not_completed: 'Job Not Completed',
  ll_job_completed: 'Job Completed',
  tenant_job_completed: 'Job Completed',
  landlord_allocate: 'Allocated to Landlord',
  contractor_reschedule_request: 'Reschedule',
  tenant_reschedule_approved: 'Reschedule Approved',
  tenant_reschedule_declined: 'Reschedule Declined',
  pm_reschedule_approved: 'Reschedule Approved',
  tenant_portal_link: 'Portal Link Sent',
  contractor_reminder: 'Reminder',
  no_more_contractors: 'No Contractors Available',
}

type SubTab = 'tenant' | 'manager' | 'contractors' | 'landlord'

interface TicketConversationTabProps {
  conversation: ConversationData | null
  outboundLog?: OutboundLogEntry[]
}

function getStageLabel(messageType: string): string | null {
  return STAGE_MAP[messageType] || null
}

function OutboundThread({ entries }: { entries: OutboundLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No messages sent yet</p>
      </div>
    )
  }

  let lastStage: string | null = null

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const stage = getStageLabel(entry.message_type)
        const showDivider = stage && stage !== lastStage
        if (stage) lastStage = stage

        return (
          <div key={entry.id}>
            {showDivider && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{stage}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">Y</span>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Yarro</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {format(new Date(entry.sent_at), 'dd MMM, HH:mm')}
                  </span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm whitespace-pre-wrap max-w-[85%]">
                  {entry.body
                    ? entry.body.replace(/\*([^*]+)\*/g, '$1').replace(/\(flow reply:.*?\)/g, '').trim() || `[${entry.message_type}]`
                    : `[${entry.message_type}]`
                  }
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TicketConversationTab({ conversation, outboundLog = [] }: TicketConversationTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('tenant')

  const tenantMessages = useMemo(() => conversation ? getLogEntries(conversation.log) : [], [conversation])

  const managerLog = useMemo(() =>
    outboundLog.filter(e => e.recipient_role === 'manager').sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()),
    [outboundLog]
  )
  const contractorLog = useMemo(() =>
    outboundLog.filter(e => e.recipient_role === 'contractor').sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()),
    [outboundLog]
  )
  const landlordLog = useMemo(() =>
    outboundLog.filter(e => e.recipient_role === 'landlord').sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()),
    [outboundLog]
  )
  // Also include tenant outbound (post-conversation notifications)
  const tenantOutbound = useMemo(() =>
    outboundLog.filter(e => e.recipient_role === 'tenant').sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()),
    [outboundLog]
  )

  const tabs: { key: SubTab; label: string; count: number }[] = [
    { key: 'tenant', label: 'Tenant', count: tenantMessages.length + tenantOutbound.length },
    { key: 'manager', label: 'Manager', count: managerLog.length },
    { key: 'contractors', label: 'Contractors', count: contractorLog.length },
    { key: 'landlord', label: 'Landlord', count: landlordLog.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 pb-3 mb-3 border-b flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              subTab === tab.key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 rounded-xl p-4">
        {subTab === 'tenant' && (
          <div className="space-y-0">
            {/* AI conversation */}
            {tenantMessages.length > 0 && (
              <>
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">AI Conversation</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {conversation && (
                  <div className="flex items-center gap-3 mb-3">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{formatPhoneDisplay(conversation.phone) || conversation.phone}</span>
                    {conversation.caller_name && (
                      <>
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{conversation.caller_name}</span>
                      </>
                    )}
                  </div>
                )}
                <ChatHistory messages={tenantMessages} />
              </>
            )}
            {/* Post-conversation tenant notifications */}
            {tenantOutbound.length > 0 && (
              <div className="mt-4">
                <OutboundThread entries={tenantOutbound} />
              </div>
            )}
            {tenantMessages.length === 0 && tenantOutbound.length === 0 && (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">No tenant messages</p>
              </div>
            )}
          </div>
        )}

        {subTab === 'manager' && <OutboundThread entries={managerLog} />}
        {subTab === 'contractors' && <OutboundThread entries={contractorLog} />}
        {subTab === 'landlord' && <OutboundThread entries={landlordLog} />}
      </div>
    </div>
  )
}

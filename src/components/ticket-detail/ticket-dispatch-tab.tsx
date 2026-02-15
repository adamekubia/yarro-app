'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChatHistory } from '@/components/chat-message'
import {
  Wrench,
  User,
  Building2,
  Phone,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Bell,
  MessageCircle,
} from 'lucide-react'
import type { MessageData, OutboundLogEntry } from '@/hooks/use-ticket-detail'
import {
  getContractors,
  getRecipient,
  getContractorStatus,
  getContractorMessages,
  getRecipientMessages,
  formatAmount,
} from '@/hooks/use-ticket-detail'
import { cn } from '@/lib/utils'

// ─── Outbound log config ───

interface MessageTypeConfig {
  label: string
  phase: 'dispatch' | 'approval' | 'booking' | 'completion'
  isFollowUp?: boolean
  isEscalation?: boolean
}

const MESSAGE_TYPES: Record<string, MessageTypeConfig> = {
  contractor_dispatch: { label: 'Contractor Dispatched', phase: 'dispatch' },
  contractor_reminder: { label: 'Contractor Reminder', phase: 'dispatch', isFollowUp: true },
  no_contractors_left: { label: 'No Contractors Available', phase: 'dispatch' },
  pm_quote: { label: 'Quote Sent to Manager', phase: 'approval' },
  landlord_quote: { label: 'Quote Sent to Landlord', phase: 'approval' },
  landlord_followup: { label: 'Landlord Follow-up', phase: 'approval', isFollowUp: true },
  pm_landlord_timeout: { label: 'Landlord Timeout Alert', phase: 'approval', isEscalation: true },
  pm_landlord_approved: { label: 'Landlord Approved', phase: 'approval' },
  tenant_job_booked: { label: 'Job Booked — Tenant', phase: 'booking' },
  pm_job_booked: { label: 'Job Booked — Manager', phase: 'booking' },
  landlord_job_booked: { label: 'Job Booked — Landlord', phase: 'booking' },
  contractor_job_reminder: { label: 'Job Reminder', phase: 'completion' },
  contractor_completion_reminder: { label: 'Completion Reminder', phase: 'completion', isFollowUp: true },
  pm_completion_overdue: { label: 'Completion Overdue', phase: 'completion', isEscalation: true },
}

interface RoleConfig {
  icon: typeof Wrench
  color: string
  dotBg: string
  label: string
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  contractor: { icon: Wrench, color: 'text-blue-600 dark:text-blue-400', dotBg: 'bg-blue-500/10 dark:bg-blue-400/15', label: 'Contractor' },
  manager: { icon: User, color: 'text-violet-600 dark:text-violet-400', dotBg: 'bg-violet-500/10 dark:bg-violet-400/15', label: 'Manager' },
  landlord: { icon: Building2, color: 'text-amber-600 dark:text-amber-400', dotBg: 'bg-amber-500/10 dark:bg-amber-400/15', label: 'Landlord' },
  tenant: { icon: Phone, color: 'text-emerald-600 dark:text-emerald-400', dotBg: 'bg-emerald-500/10 dark:bg-emerald-400/15', label: 'Tenant' },
}

const PHASE_BADGE: Record<string, { label: string; className: string }> = {
  dispatch: { label: 'dispatch', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  approval: { label: 'approval', className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  booking: { label: 'booking', className: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  completion: { label: 'completion', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
}

function formatBody(body: string): string {
  return body
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

// ─── Component ───

interface TicketDispatchTabProps {
  messages: MessageData | null
  outboundLog: OutboundLogEntry[]
}

export function TicketDispatchTab({ messages, outboundLog }: TicketDispatchTabProps) {
  const [openContractors, setOpenContractors] = useState<number[]>([])
  const [openManager, setOpenManager] = useState(false)
  const [openLandlord, setOpenLandlord] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  const contractors = messages ? getContractors(messages.contractors) : []
  const managerRecipient = messages ? getRecipient(messages.manager) : null
  const landlordRecipient = messages ? getRecipient(messages.landlord) : null
  const hasManager = !!managerRecipient?.last_outbound_body || !!managerRecipient?.replied_at
  const hasLandlord = !!landlordRecipient?.last_outbound_body || !!landlordRecipient?.replied_at
  const hasDispatchCards = contractors.length > 0 || hasManager || hasLandlord

  const toggleContractor = (index: number) => {
    setOpenContractors(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const toggleMessage = (id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Multi-contractor warning
  const contactedCount = contractors.filter(c => c.sent_at || c.replied_at).length
  const approvedCount = contractors.filter(c => c.manager_decision === 'approved').length
  const quotedCount = contractors.filter(c => c.replied_at && c.quote_amount).length

  const getReferencedContractorName = (): string | null => {
    const approved = contractors.find(c => c.manager_decision === 'approved')
    if (approved) return approved.name
    const quoted = contractors.find(c => c.quote_amount)
    if (quoted) return quoted.name
    return null
  }

  const contractorRef = getReferencedContractorName()

  return (
    <div className="space-y-6">
      {/* ─── DISPATCH STATUS CARDS ─── */}
      {hasDispatchCards && (
        <div className="space-y-4">
          {/* Multi-contractor warning banner */}
          {contactedCount > 1 && approvedCount === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg border">
              <AlertTriangle className="h-4 w-4 text-foreground/70 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">
                  {contactedCount} contractors contacted
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {quotedCount > 0
                    ? `${quotedCount} quote${quotedCount > 1 ? 's' : ''} received. Approve only one to proceed.`
                    : 'Awaiting quotes. Only one can be approved.'}
                </p>
              </div>
            </div>
          )}

          {/* Contractors */}
          {contractors.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Contractors</p>
              <div className="space-y-2">
                {contractors.map((contractor, index) => {
                  const status = getContractorStatus(contractor)
                  const isOpen = openContractors.includes(index)

                  return (
                    <div key={contractor.id || index} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleContractor(index)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <div className="text-left">
                            <p className="text-sm font-medium">{contractor.name}</p>
                            {contractor.category && (
                              <p className="text-xs text-muted-foreground">{contractor.category}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {contractor.quote_notes && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground max-w-[120px] truncate" title={contractor.quote_notes}>
                                {contractor.quote_notes}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              status === 'approved' ? 'bg-green-500/10 dark:bg-green-400/15 text-green-700 dark:text-green-400' :
                              status === 'replied' ? 'bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-400' :
                              status === 'sent' ? 'bg-yellow-500/10 dark:bg-yellow-400/15 text-yellow-700 dark:text-yellow-400' :
                              'bg-gray-500/10 dark:bg-gray-400/15 text-gray-600 dark:text-gray-400'
                            }`}>
                              {status === 'approved' ? `Approved ${formatAmount(contractor.quote_amount) || ''}`.trim() :
                               status === 'replied' ? `${formatAmount(contractor.quote_amount) || 'Quoted'}` :
                               status === 'sent' ? 'Sent' : 'Pending'}
                            </span>
                          </div>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 max-h-[320px] overflow-y-auto border-t bg-muted/30">
                          <div className="pt-2">
                            <ChatHistory
                              messages={getContractorMessages([contractor])}
                              allowHtmlForAssistant={true}
                              compact={true}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Manager */}
          {hasManager && (() => {
            const approved = managerRecipient?.approval === true
            const declined = managerRecipient?.approval === false
            const hasReplied = !!managerRecipient?.replied_at

            return (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Manager</p>
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOpenManager(!openManager)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Manager</p>
                        {contractorRef && (
                          <p className="text-xs text-muted-foreground">Re: {contractorRef}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        approved ? 'bg-green-500/10 dark:bg-green-400/15 text-green-700 dark:text-green-400' :
                        declined ? 'bg-red-500/10 dark:bg-red-400/15 text-red-700 dark:text-red-400' :
                        hasReplied ? 'bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-400' :
                        'bg-orange-500/10 dark:bg-orange-400/15 text-orange-700 dark:text-orange-400'
                      }`}>
                        {approved ? `Approved${managerRecipient?.approval_amount ? ` ${managerRecipient.approval_amount}` : ''}` :
                         declined ? 'Declined' :
                         hasReplied ? 'Replied' : 'Pending'}
                      </span>
                      {openManager ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {openManager && (
                    <div className="px-3 pb-3 max-h-[320px] overflow-y-auto border-t bg-muted/30">
                      <div className="pt-2">
                        <ChatHistory
                          messages={getRecipientMessages(managerRecipient, 'Manager')}
                          allowHtmlForAssistant={true}
                          compact={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Landlord */}
          {hasLandlord && (() => {
            const approved = landlordRecipient?.approval === true
            const declined = landlordRecipient?.approval === false
            const hasReplied = !!landlordRecipient?.replied_at

            return (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Landlord</p>
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOpenLandlord(!openLandlord)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Landlord</p>
                        {contractorRef && (
                          <p className="text-xs text-muted-foreground">Re: {contractorRef}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        approved ? 'bg-green-500/10 dark:bg-green-400/15 text-green-700 dark:text-green-400' :
                        declined ? 'bg-red-500/10 dark:bg-red-400/15 text-red-700 dark:text-red-400' :
                        hasReplied ? 'bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-400' :
                        'bg-orange-500/10 dark:bg-orange-400/15 text-orange-700 dark:text-orange-400'
                      }`}>
                        {approved ? `Approved${landlordRecipient?.approval_amount ? ` ${landlordRecipient.approval_amount}` : ''}` :
                         declined ? 'Declined' :
                         hasReplied ? 'Replied' : 'Pending'}
                      </span>
                      {openLandlord ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {openLandlord && (
                    <div className="px-3 pb-3 max-h-[320px] overflow-y-auto border-t bg-muted/30">
                      <div className="pt-2">
                        <ChatHistory
                          messages={getRecipientMessages(landlordRecipient, 'Landlord')}
                          allowHtmlForAssistant={true}
                          compact={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ─── OUTBOUND MESSAGE LOG ─── */}
      {outboundLog.length > 0 && (
        <div>
          {hasDispatchCards && (
            <div className="border-t pt-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Message Log</p>
              </div>
            </div>
          )}

          <div className="space-y-0">
            {outboundLog.map((entry, index) => {
              const typeConfig = MESSAGE_TYPES[entry.message_type]
              const roleConfig = ROLE_CONFIG[entry.recipient_role] || ROLE_CONFIG.contractor
              const RoleIcon = roleConfig.icon
              const isOpen = expandedMessages.has(entry.id)
              const isLast = index === outboundLog.length - 1
              const isFollowUp = typeConfig?.isFollowUp
              const isEscalation = typeConfig?.isEscalation
              const phase = typeConfig?.phase || 'dispatch'
              const phaseBadge = PHASE_BADGE[phase]

              return (
                <div
                  key={entry.id}
                  className={cn('flex gap-3', (isFollowUp || isEscalation) && 'ml-5')}
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                      isEscalation
                        ? 'bg-red-500/10 dark:bg-red-400/15'
                        : roleConfig.dotBg
                    )}>
                      {isEscalation ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      ) : isFollowUp ? (
                        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <RoleIcon className={cn('h-3.5 w-3.5', roleConfig.color)} />
                      )}
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border/50" />}
                  </div>

                  {/* Content */}
                  <div className={cn('pb-3 min-w-0 flex-1', !isLast && 'pb-4')}>
                    <button
                      onClick={() => toggleMessage(entry.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">
                              {typeConfig?.label || entry.message_type.replace(/_/g, ' ')}
                            </p>
                            {(isFollowUp || isEscalation) && (
                              <span className={cn(
                                'px-1.5 py-0.5 text-[10px] rounded-full font-medium',
                                isEscalation
                                  ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                                  : 'bg-muted text-muted-foreground'
                              )}>
                                {isEscalation ? 'escalation' : 'follow-up'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={cn(
                              'px-1.5 py-0.5 text-[10px] rounded-full font-medium',
                              roleConfig.dotBg, roleConfig.color
                            )}>
                              {roleConfig.label}
                            </span>
                            {phaseBadge && (
                              <span className={cn(
                                'px-1.5 py-0.5 text-[10px] rounded-full font-medium',
                                phaseBadge.className
                              )}>
                                {phaseBadge.label}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground/60">
                              {format(new Date(entry.sent_at), 'dd MMM, HH:mm')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <span className={cn(
                            'px-1.5 py-0.5 text-[10px] rounded-full',
                            entry.status === 'delivered' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                            entry.status === 'sent' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                            entry.status === 'queued' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' :
                            entry.status === 'failed' ? 'bg-red-500/10 text-red-700 dark:text-red-400' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {entry.status || 'sent'}
                          </span>
                          {entry.body && (
                            isOpen
                              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded body */}
                    {isOpen && entry.body && (
                      <div className="mt-2 rounded-lg bg-muted/30 border px-3 py-2.5">
                        <p
                          className="text-xs text-foreground/80 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatBody(entry.body) }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasDispatchCards && outboundLog.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="text-center">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No dispatch activity yet</p>
          </div>
        </div>
      )}
    </div>
  )
}

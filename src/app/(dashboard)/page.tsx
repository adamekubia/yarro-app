'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { DateFilter } from '@/components/date-filter'
import { useDateRange } from '@/contexts/date-range-context'
import { StatusBadge } from '@/components/status-badge'
import { KanbanBoard } from '@/components/kanban-board'
import {
  Clock,
  ArrowRight,
  AlertTriangle,
  Wrench,
  X,
  LayoutGrid,
  Columns3,
  MessageSquare,
  Phone,
  User,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { TicketForm } from '@/components/ticket-form'
import { ChatHistory } from '@/components/chat-message'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DashboardStats {
  totalTickets: number
  openTickets: number
  closedTickets: number
  handoffTickets: number
  handoffConversations: number
  awaitingContractor: number
  awaitingManager: number
  awaitingLandlord: number
  landlordDeclined: number
  landlordNoResponse: number
  noContractorsLeft: number
  scheduledJobs: number
  awaitingBooking: number
  jobNotCompleted: number
}

interface HandoffConversation {
  id: string
  phone: string
  caller_name: string | null
  caller_role: string | null
  property_id: string | null
  tenant_id: string | null
  address: string | null
  last_updated: string
  stage: string | null
  log: unknown
}

interface TicketSummary {
  id: string
  issue_description: string | null
  status: string
  job_stage: string | null
  display_stage: string | null
  message_stage?: string | null
  category: string | null
  priority: string | null
  date_logged: string
  scheduled_date?: string | null
  final_amount?: number | null
  address?: string
  handoff?: boolean
  landlord_declined?: boolean
  next_action?: string | null
  next_action_reason?: string | null
}

// Action card descriptions for tooltips
const ACTION_DESCRIPTIONS: Record<string, string> = {
  // To-do categories (wired to next_action field)
  needs_attention: 'Tickets that need your direct attention — AI couldn\'t complete them and they require your decision',
  assign_contractor: 'Tickets where all contractors declined or didn\'t respond — find and assign a new contractor',
  follow_up: 'Tickets needing follow-up — landlord no response, declined quotes, or jobs not completed',
  // Scheduled section (wired to next_action_reason field)
  contractor: 'Tickets waiting for a contractor to respond with a quote or availability',
  booking: 'Booking confirmation has been sent to the tenant — waiting for them to confirm a slot',
  scheduled: 'Jobs that have been scheduled with a contractor and have a confirmed date',
  landlord: 'Tickets waiting for landlord approval on the quoted price',
}

type ViewMode = 'stats' | 'board'

export default function DashboardPage() {
  const router = useRouter()
  const { propertyManager } = usePM()
  const { dateRange, setDateRange } = useDateRange()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dashboard-view') as ViewMode) || 'stats'
    }
    return 'stats'
  })
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTickets, setRecentTickets] = useState<TicketSummary[]>([])
  const [allTickets, setAllTickets] = useState<TicketSummary[]>([])
  const [awaitingTickets, setAwaitingTickets] = useState<TicketSummary[]>([])
  const [awaitingType, setAwaitingType] = useState<string | null>(null)
  const [handoffConversations, setHandoffConversations] = useState<HandoffConversation[]>([])
  const [selectedHandoff, setSelectedHandoff] = useState<HandoffConversation | null>(null)
  const [createTicketOpen, setCreateTicketOpen] = useState(false)
  const [showHandoffConvo, setShowHandoffConvo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const supabase = createClient()

  // Persist view mode
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('dashboard-view', mode)
  }

  const fetchData = useCallback(async () => {
    if (!propertyManager) return
    setLoading(true)

    // Fetch tickets — next_action/next_action_reason is the single source of truth for state
    const [ticketsRes, convosRes] = await Promise.all([
      supabase
        .from('c1_tickets')
        .select(`
          id,
          issue_description,
          status,
          job_stage,
          category,
          priority,
          date_logged,
          scheduled_date,
          final_amount,
          handoff,
          conversation_id,
          next_action,
          next_action_reason,
          c1_properties(address)
        `)
        .eq('property_manager_id', propertyManager.id)
        .gte('date_logged', dateRange.from.toISOString())
        .lte('date_logged', dateRange.to.toISOString())
        .neq('archived', true)
        .order('date_logged', { ascending: false }),
      // Fetch handoff conversations that need ticket creation
      supabase
        .from('c1_conversations')
        .select(`
          id,
          phone,
          caller_name,
          caller_role,
          property_id,
          tenant_id,
          last_updated,
          stage,
          log,
          c1_properties(address)
        `)
        .eq('property_manager_id', propertyManager.id)
        .eq('handoff', true)
        .eq('status', 'open')
        .order('last_updated', { ascending: false }),
    ])

    const tickets = ticketsRes.data
    const conversations = convosRes.data

    // Filter conversations that don't have tickets yet
    const ticketConvoIds = new Set(tickets?.map(t => t.conversation_id).filter(Boolean) || [])
    const handoffConvosNeedingTickets = (conversations || [])
      .filter(c => !ticketConvoIds.has(c.id))
      .map(c => ({
        ...c,
        address: (c.c1_properties as unknown as { address: string } | null)?.address || null,
      }))
    setHandoffConversations(handoffConvosNeedingTickets)

    if (tickets) {
      const total = tickets.length
      const closed = tickets.filter((t) => t.status?.toLowerCase() === 'closed').length
      const open = total - closed

      // All counts derived from next_action / next_action_reason (DB trigger computed)
      const handoffTickets = tickets.filter((t) => t.next_action_reason === 'handoff_review').length
      const awaitingManager = tickets.filter((t) => t.next_action_reason === 'manager_approval').length
      const noContractorsLeft = tickets.filter((t) => t.next_action_reason === 'no_contractors').length
      const landlordDeclined = tickets.filter((t) => t.next_action_reason === 'landlord_declined').length
      const landlordNoResponse = tickets.filter((t) => t.next_action_reason === 'landlord_no_response').length
      const jobNotCompleted = tickets.filter((t) => t.next_action_reason === 'job_not_completed').length
      const awaitingContractor = tickets.filter((t) => t.next_action_reason === 'awaiting_contractor').length
      const awaitingLandlord = tickets.filter((t) => t.next_action_reason === 'awaiting_landlord').length
      const scheduledJobs = tickets.filter((t) => t.next_action_reason === 'scheduled').length
      const awaitingBooking = tickets.filter((t) => t.next_action_reason === 'awaiting_booking').length

      setStats({
        totalTickets: total,
        openTickets: open,
        closedTickets: closed,
        handoffTickets,
        handoffConversations: handoffConvosNeedingTickets.length,
        awaitingContractor,
        awaitingManager,
        awaitingLandlord,
        landlordDeclined,
        landlordNoResponse,
        noContractorsLeft,
        scheduledJobs,
        awaitingBooking,
        jobNotCompleted,
      })

      // Map next_action_reason → display label
      const reasonToDisplayStage: Record<string, string> = {
        handoff_review: 'Handoff',
        manager_approval: 'Awaiting Manager',
        no_contractors: 'No Contractors',
        landlord_declined: 'Landlord Declined',
        landlord_no_response: 'Landlord No Response',
        job_not_completed: 'Not Completed',
        awaiting_contractor: 'Awaiting Contractor',
        awaiting_landlord: 'Awaiting Landlord',
        awaiting_booking: 'Awaiting Booking',
        scheduled: 'Scheduled',
        completed: 'Completed',
        dismissed: 'Dismissed',
        new: 'Created',
      }

      const mappedTickets = tickets.map((t) => ({
        id: t.id,
        issue_description: t.issue_description,
        status: t.status,
        job_stage: t.job_stage,
        display_stage: reasonToDisplayStage[t.next_action_reason || ''] || reasonToDisplayStage[t.next_action || ''] || 'Created',
        message_stage: null,
        category: t.category,
        priority: t.priority,
        date_logged: t.date_logged,
        scheduled_date: t.scheduled_date,
        final_amount: t.final_amount,
        address: (t.c1_properties as unknown as { address: string } | null)?.address,
        handoff: t.handoff,
        landlord_declined: t.next_action_reason === 'landlord_declined',
        next_action: t.next_action || null,
        next_action_reason: t.next_action_reason || null,
      }))
      setAllTickets(mappedTickets)
      setRecentTickets(mappedTickets.slice(0, 5))
    }

    setLoading(false)
  }, [propertyManager, dateRange, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const showAwaitingTickets = (type: string) => {
    let filtered: TicketSummary[]

    // To-do categories filter directly by next_action
    if (type === 'needs_attention' || type === 'assign_contractor' || type === 'follow_up') {
      filtered = allTickets.filter((t) => t.next_action === type)
    } else {
      // Scheduled section filters by next_action_reason
      const reasonMap: Record<string, string> = {
        contractor: 'awaiting_contractor',
        landlord: 'awaiting_landlord',
        booking: 'awaiting_booking',
        scheduled: 'scheduled',
      }
      const reason = reasonMap[type]
      filtered = reason ? allTickets.filter((t) => t.next_action_reason === reason) : []
    }

    setAwaitingTickets(filtered)
    setAwaitingType(type)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  }

  // Sort oldest-first so most urgent/overdue tickets surface at the top
  const byAge = (a: TicketSummary, b: TicketSummary) =>
    new Date(a.date_logged).getTime() - new Date(b.date_logged).getTime()

  const getSheetTitle = (type: string | null) => {
    switch (type) {
      case 'needs_attention': return 'Needs Attention'
      case 'assign_contractor': return 'Assign Contractors'
      case 'follow_up': return 'Follow-up'
      case 'contractor': return 'Awaiting Contractor'
      case 'landlord': return 'Awaiting Landlord'
      case 'scheduled': return 'Scheduled Jobs'
      case 'booking': return 'Awaiting Booking'
      default: return ''
    }
  }

  // Autocomplete results for global search in top bar
  const searchResults = searchTerm.trim()
    ? allTickets
        .filter(
          (t) =>
            t.issue_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.address?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 8)
    : []

  if (loading && !stats) {
    return (
      <div className="p-4 h-full bg-gradient-to-br from-blue-50/50 via-background to-cyan-50/30 dark:from-background dark:via-background dark:to-background overflow-hidden">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[168px] bg-muted rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-[200px] bg-muted rounded-xl" />
            <div className="h-[200px] bg-muted rounded-xl" />
          </div>
          <div className="flex-1 bg-muted rounded-xl min-h-[160px]" />
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="h-full bg-gradient-to-br from-blue-50/50 via-background to-cyan-50/30 dark:from-background dark:via-background dark:to-background overflow-hidden">
        <div className="fixed inset-0 bg-gradient-to-b from-blue-500/[0.02] to-transparent pointer-events-none dark:hidden" />

        <div className="relative p-4 h-full flex flex-col gap-3">
          {/* Header — command bar: search left, controls right */}
          <div className="flex items-center justify-between flex-shrink-0 gap-4">
            {/* LEFT: global search — dominant element */}
            <div className="relative w-72">
              <div className={`flex items-center gap-2 h-9 px-3 rounded-lg border bg-background/80 backdrop-blur-sm transition-all ${searchFocused ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border'}`}>
                <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  placeholder="Search tickets…"
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {searchFocused && searchResults.length > 0 && (
                <div className="absolute top-full mt-1.5 left-0 w-80 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                  {searchResults.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets?id=${ticket.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSearchTerm(''); setSearchFocused(false) }}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-card-foreground truncate">{ticket.issue_description || 'No description'}</p>
                        <p className="text-xs text-muted-foreground truncate">{ticket.address || '—'}</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </Link>
                  ))}
                  <Link
                    href="/tickets"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSearchTerm(''); setSearchFocused(false) }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-primary hover:bg-primary/5 transition-colors"
                  >
                    View all results
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
            {/* RIGHT: controls */}
            <div className="flex items-center gap-2">
              <Link href="/tickets?create=true">
                <InteractiveHoverButton text="Create" className="w-24 text-xs h-9" />
              </Link>
              {/* View Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => handleViewChange('stats')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'stats'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Stats
                </button>
                <button
                  onClick={() => handleViewChange('board')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'board'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  Board
                </button>
              </div>
              <DateFilter value={dateRange} onChange={setDateRange} />
            </div>
          </div>

          {/* Main Content - Stats or Board view */}
          {viewMode === 'board' ? (
            <div className="flex-1 min-h-0">
              <KanbanBoard
                tickets={allTickets}
                onTicketClick={(id) => router.push(`/tickets?id=${id}`)}
                onHandoffReview={(id) => router.push(`/tickets?id=${id}&action=complete`)}
              />
            </div>
          ) : (
          /* Dashboard — Top cards + full-width recent tickets */
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Top section: two columns */}
            <div className="grid grid-cols-[7fr_3fr] gap-3 items-start">
              {/* LEFT: To-do — section header + 3 premium cards */}
              {(() => {
                const needsAttentionTickets = allTickets.filter((t) => t.next_action === 'needs_attention').sort(byAge)
                const assignContractorTickets = allTickets.filter((t) => t.next_action === 'assign_contractor').sort(byAge)
                const followUpTickets = allTickets.filter((t) => t.next_action === 'follow_up').sort(byAge)
                const totalAction = needsAttentionTickets.length + assignContractorTickets.length + followUpTickets.length

                const categories = [
                  {
                    key: 'needs_attention' as const,
                    label: 'Needs attention',
                    tickets: needsAttentionTickets,
                    icon: AlertTriangle,
                    accent: 'bg-red-500',
                    iconBg: 'bg-red-500/15',
                    iconColor: 'text-red-500',
                    countColor: 'text-red-500',
                  },
                  {
                    key: 'assign_contractor' as const,
                    label: 'Assign contractors',
                    tickets: assignContractorTickets,
                    icon: Wrench,
                    accent: 'bg-amber-500',
                    iconBg: 'bg-amber-500/15',
                    iconColor: 'text-amber-500',
                    countColor: 'text-amber-500',
                  },
                  {
                    key: 'follow_up' as const,
                    label: 'Follow-up',
                    tickets: followUpTickets,
                    icon: Clock,
                    accent: 'bg-orange-500',
                    iconBg: 'bg-orange-500/15',
                    iconColor: 'text-orange-500',
                    countColor: 'text-orange-500',
                  },
                ]

                return (
                  <div className="flex flex-col gap-3">
                    {/* Section header — title above the 3 cards */}
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-xl font-bold text-card-foreground">To-do</h2>
                      {totalAction > 0 && (
                        <span className="text-sm font-bold text-white bg-red-500 rounded-full h-7 min-w-[28px] flex items-center justify-center px-2">
                          {totalAction}
                        </span>
                      )}
                    </div>

                    {/* 3 equal-width premium cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {categories.map((cat) => (
                        <div key={cat.key} className="bg-card rounded-xl border border-border p-6 flex flex-col aspect-square">

                          {/* TOP: icon + label + large count */}
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 cursor-help ${cat.tickets.length > 0 ? cat.iconBg : 'bg-muted'}`}>
                                    <cat.icon className={`h-3.5 w-3.5 ${cat.tickets.length > 0 ? cat.iconColor : 'text-muted-foreground/50'}`} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">{ACTION_DESCRIPTIONS[cat.key]}</p></TooltipContent>
                              </Tooltip>
                              <p className={`text-sm font-medium ${cat.tickets.length > 0 ? 'text-card-foreground' : 'text-muted-foreground'}`}>
                                {cat.label}
                              </p>
                            </div>
                            <span className={`text-3xl font-bold tabular-nums ${cat.tickets.length > 0 ? cat.countColor : 'text-muted-foreground/30'}`}>
                              {cat.tickets.length}
                            </span>
                          </div>

                          {/* MIDDLE: up to 3 preview rows */}
                          <div className="flex flex-col gap-1 flex-1">
                            {cat.tickets.slice(0, 3).map((ticket) => (
                              <Link
                                key={ticket.id}
                                href={`/tickets?id=${ticket.id}`}
                                className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors"
                              >
                                <div className={`w-0.5 h-5 rounded-full flex-shrink-0 ${cat.accent}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-card-foreground truncate leading-tight">
                                    {ticket.issue_description || 'No description'}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate leading-tight">
                                    {ticket.address || '—'}
                                  </p>
                                </div>
                                {ticket.priority === 'emergency' && (
                                  <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                                    EMERGENCY
                                  </span>
                                )}
                              </Link>
                            ))}
                            {cat.tickets.length === 0 && (
                              <p className="text-xs text-muted-foreground/50 px-2 py-1">All clear.</p>
                            )}
                          </div>

                          {/* BOTTOM: See all — always visible, muted when empty */}
                          <button
                            onClick={() => cat.tickets.length > 0 ? showAwaitingTickets(cat.key) : undefined}
                            className={`mt-auto pt-3 text-xs font-medium flex items-center justify-end gap-1 transition-colors ${
                              cat.tickets.length > 0
                                ? 'text-primary hover:text-primary/80 cursor-pointer'
                                : 'text-muted-foreground/40 cursor-default'
                            }`}
                          >
                            See all <ArrowRight className="h-3 w-3" />
                          </button>

                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* RIGHT: Scheduled — chronological job list */}
              {(() => {
                const scheduledTickets = allTickets
                  .filter((t) => t.next_action_reason === 'scheduled' && t.scheduled_date)
                  .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())

                const byDate: Record<string, TicketSummary[]> = {}
                for (const t of scheduledTickets) {
                  const key = formatDate(t.scheduled_date!)
                  if (!byDate[key]) byDate[key] = []
                  byDate[key].push(t)
                }
                const groups = Object.entries(byDate)

                return (
                  <div className="bg-card rounded-xl border border-border p-6 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-card-foreground">Scheduled</h3>
                      {scheduledTickets.length > 0 && (
                        <span className="text-xs font-bold text-primary bg-primary/10 rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5">
                          {scheduledTickets.length}
                        </span>
                      )}
                    </div>

                    {groups.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 py-2">No jobs scheduled</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {groups.map(([date, tickets]) => (
                          <div key={date}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                              {date}
                            </p>
                            <div className="flex flex-col gap-0.5">
                              {tickets.map((ticket) => (
                                <Link
                                  key={ticket.id}
                                  href={`/tickets?id=${ticket.id}`}
                                  className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-card-foreground truncate">
                                      {ticket.issue_description || 'No description'}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{ticket.address || '—'}</p>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Bottom: Recent Tickets — full width, no scroll */}
            <div className="flex-shrink-0 bg-card rounded-xl border border-border flex flex-col">
              <div className="flex items-center px-4 py-2 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground flex-1">Recent Tickets</h3>
                <Link href="/tickets">
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary/80 hover:bg-primary/10">
                    View all
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <div className="divide-y divide-border/50">
                {recentTickets.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No tickets found for this period
                  </div>
                ) : (
                  recentTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets?id=${ticket.id}`}
                      className="flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-all duration-200"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {ticket.issue_description || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ticket.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {ticket.display_stage && (
                          <StatusBadge status={ticket.display_stage} />
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(ticket.date_logged)}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Awaiting Tickets Sheet */}
        <Sheet open={!!awaitingType} onOpenChange={(open) => !open && setAwaitingType(null)}>
          <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto p-6" title={getSheetTitle(awaitingType)}>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-lg">
                {getSheetTitle(awaitingType)}
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-3">
              {awaitingTickets.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No tickets in this category</p>
              ) : (
                awaitingTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-primary/20"
                  >
                    <Link
                      href={`/tickets?id=${ticket.id}`}
                      className="block"
                      onClick={() => setAwaitingType(null)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-card-foreground leading-snug">{ticket.issue_description || 'No description'}</p>
                          <p className="text-sm text-muted-foreground mt-1.5 truncate">{ticket.address}</p>
                        </div>
                        <span className="text-xs text-muted-foreground/70 whitespace-nowrap flex-shrink-0">
                          {formatDate(ticket.date_logged)}
                        </span>
                      </div>
                    </Link>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {ticket.display_stage && <StatusBadge status={ticket.display_stage} />}
                      {awaitingType === 'handoff' && ticket.handoff && (
                        <Link
                          href={`/tickets?id=${ticket.id}&action=complete`}
                          onClick={() => setAwaitingType(null)}
                        >
                          <InteractiveHoverButton text="Review" className="w-24 text-xs h-7 p-1" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Create Ticket from Handoff Dialog */}
        <Dialog open={createTicketOpen} onOpenChange={(open) => {
          if (!open) {
            setCreateTicketOpen(false)
            setSelectedHandoff(null)
            setShowHandoffConvo(false)
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <DialogTitle>Create Ticket from Handoff</DialogTitle>
                  <DialogDescription>
                    Review the conversation and create a ticket to dispatch to contractors
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {selectedHandoff && (
              <div className="flex-1 overflow-hidden flex flex-col gap-3 mt-4">
                {/* View Conversation toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start gap-2 text-xs"
                  onClick={() => setShowHandoffConvo(!showHandoffConvo)}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {showHandoffConvo ? 'Hide Conversation' : 'View Conversation'}
                </Button>

                <div className={`flex-1 overflow-hidden grid gap-4 ${showHandoffConvo ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Left: Conversation Context (collapsible) */}
                  {showHandoffConvo && (
                    <div className="flex flex-col min-h-0 border rounded-lg p-3">
                      {/* Caller info bar — matches ticket-conversation-tab design */}
                      <div className="flex items-center gap-4 pb-2 mb-2 border-b flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-xs">{selectedHandoff.phone || 'Unknown'}</span>
                        </div>
                        {selectedHandoff.caller_name && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">
                              {selectedHandoff.caller_name}
                              {selectedHandoff.caller_role && (
                                <span className="text-muted-foreground text-[10px] ml-1">({selectedHandoff.caller_role})</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Chat bubbles */}
                      <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 rounded-xl p-3">
                        <ChatHistory
                          compact
                          messages={(() => {
                            const log = selectedHandoff.log
                            if (!log || !Array.isArray(log)) return []
                            return (log as Array<{ direction?: string; text?: string; content?: string; message?: string; timestamp?: string; label?: string }>)
                              .filter(entry => !entry.label && (entry.text || entry.content || entry.message))
                              .map(entry => ({
                                role: (entry.direction === 'in' || entry.direction === 'inbound') ? 'tenant' : (entry.direction === 'out' || entry.direction === 'outbound') ? 'assistant' : 'system',
                                text: entry.text || entry.content || entry.message || '',
                                timestamp: entry.timestamp,
                              }))
                          })()}
                        />
                      </div>
                      {/* Handoff reason hint */}
                      <div className="mt-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 flex-shrink-0">
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">
                          <strong>Handoff:</strong> {selectedHandoff.stage === 'handoff' ? 'AI determined this needs human review' : `Stage: ${selectedHandoff.stage || 'unknown'}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Right: Ticket Form */}
                  <div className="flex flex-col min-h-0 border rounded-lg">
                  <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
                    <h4 className="font-medium text-sm">Ticket Details</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pre-filled from conversation — review and edit as needed
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <TicketForm
                      prefill={{
                        property_id: selectedHandoff.property_id || undefined,
                        tenant_id: selectedHandoff.tenant_id || undefined,
                        issue_description: (() => {
                          // Extract issue from conversation log
                          const log = selectedHandoff.log
                          if (!log || !Array.isArray(log)) return ''
                          const tenantMessages = (log as Array<{ direction?: string; text?: string; content?: string; message?: string }>)
                            .filter(entry => entry.direction === 'in' || entry.direction === 'inbound')
                            .map(entry => entry.text || entry.content || entry.message || '')
                            .filter(Boolean)
                          // Return last substantial tenant message as issue description
                          return tenantMessages.slice(-3).join(' ').substring(0, 500) || ''
                        })(),
                        images: (() => {
                          // Extract images from conversation log (AI responses contain imageURLs)
                          const log = selectedHandoff.log
                          if (!log || !Array.isArray(log)) return []
                          const allImages: string[] = []
                          ;(log as Array<{ imageURLs?: string; images?: string[] }>).forEach(entry => {
                            // AI stores comma-separated URLs in imageURLs field
                            if (entry.imageURLs && entry.imageURLs !== 'unprovided') {
                              const urls = entry.imageURLs.split(',').map(u => u.trim()).filter(Boolean)
                              allImages.push(...urls)
                            }
                            // Also check for images array
                            if (entry.images && Array.isArray(entry.images)) {
                              allImages.push(...entry.images)
                            }
                          })
                          // Deduplicate
                          return [...new Set(allImages)]
                        })(),
                        conversation_id: selectedHandoff.id,
                      }}
                      onSuccess={() => {
                        setCreateTicketOpen(false)
                        setSelectedHandoff(null)
                        toast.success('Ticket created from handoff')
                        fetchData()
                      }}
                      onCancel={() => {
                        setCreateTicketOpen(false)
                        setSelectedHandoff(null)
                      }}
                      isHandoff={true}
                    />
                  </div>
                </div>
              </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

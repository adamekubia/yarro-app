'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Archive, AlertTriangle, Loader2, MessageSquare, Wrench, CheckCircle2, LayoutDashboard } from 'lucide-react'
import { useTicketDetail } from '@/hooks/use-ticket-detail'
import { TicketOverviewTab } from './ticket-overview-tab'
import { TicketConversationTab } from './ticket-conversation-tab'
import { TicketDispatchTab } from './ticket-dispatch-tab'
import { TicketCompletionTab } from './ticket-completion-tab'

interface TicketDetailModalProps {
  ticketId: string | null
  open: boolean
  onClose: () => void
  onArchive?: () => void
  onReview?: () => void
}

export function TicketDetailModal({
  ticketId,
  open,
  onClose,
  onArchive,
  onReview,
}: TicketDetailModalProps) {
  const {
    context,
    basic,
    conversation,
    messages,
    completion,
    loading,
    error,
    hasConversation,
    hasDispatch,
    hasCompletion,
    previouslyApprovedContractor,
  } = useTicketDetail(open ? ticketId : null)

  const isHandoff = context?.handoff && basic?.status === 'open'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="xl" hideCloseButton={false}>
        {/* Header */}
        <DialogHeader>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <DialogTitle>Loading ticket...</DialogTitle>
            </div>
          ) : error ? (
            <DialogTitle className="text-destructive">Error loading ticket</DialogTitle>
          ) : context ? (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Status badges */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {context.job_stage && <StatusBadge status={context.job_stage} size="md" />}
                  {context.priority && <StatusBadge status={context.priority} size="md" />}
                  {context.handoff && <StatusBadge status="handoff" size="md" />}
                </div>
                {/* Address as title */}
                <DialogTitle className="truncate">
                  {context.property_address || 'Unknown Property'}
                </DialogTitle>
                {/* Issue as subtitle */}
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                  {context.issue_description || 'No description'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isHandoff && onReview && (
                  <Button variant="default" size="sm" onClick={onReview}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Review
                  </Button>
                )}
                {onArchive && !basic?.archived && (
                  <Button variant="ghost" size="sm" onClick={onArchive}>
                    <Archive className="h-3.5 w-3.5 mr-1" />
                    Archive
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <DialogTitle>Ticket</DialogTitle>
          )}
        </DialogHeader>

        {/* Body */}
        <DialogBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : context && basic ? (
            <>
              {/* Double-quote warning */}
              {previouslyApprovedContractor && basic.contractor_id && (
                <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-300">Previous contractor already approved</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        <span className="font-medium">{previouslyApprovedContractor}</span> was previously approved.
                        Cancel the previous arrangement before proceeding with a new contractor.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Tabs defaultValue="overview" className="h-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="overview" className="gap-1.5">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Overview
                  </TabsTrigger>
                  {hasConversation && (
                    <TabsTrigger value="conversation" className="gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Conversation
                    </TabsTrigger>
                  )}
                  {hasDispatch && (
                    <TabsTrigger value="dispatch" className="gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      Dispatch
                    </TabsTrigger>
                  )}
                  {hasCompletion && (
                    <TabsTrigger value="completion" className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Completion
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  <TicketOverviewTab context={context} basic={basic} />
                </TabsContent>

                {hasConversation && conversation && (
                  <TabsContent value="conversation" className="mt-4 h-[400px]">
                    <TicketConversationTab conversation={conversation} />
                  </TabsContent>
                )}

                {hasDispatch && messages && (
                  <TabsContent value="dispatch" className="mt-4">
                    <TicketDispatchTab messages={messages} />
                  </TabsContent>
                )}

                {hasCompletion && completion && (
                  <TabsContent value="completion" className="mt-4">
                    <TicketCompletionTab completion={completion} />
                  </TabsContent>
                )}
              </Tabs>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No ticket selected</p>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

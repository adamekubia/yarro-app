'use client'

import { AlertTriangle } from 'lucide-react'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'

interface HandoffTicket {
  id: string
  issue_description: string | null
  address?: string
}

interface HandoffAlertBannerProps {
  tickets: HandoffTicket[]
  onReview: (ticketId: string) => void
}

export function HandoffAlertBanner({ tickets, onReview }: HandoffAlertBannerProps) {
  if (tickets.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          {tickets.length} ticket{tickets.length > 1 ? 's' : ''} need{tickets.length === 1 ? 's' : ''} your review
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="flex items-center gap-3 bg-background rounded-lg border border-amber-500/20 px-4 py-2.5 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate max-w-[200px]">
                {ticket.issue_description || 'No description'}
              </p>
              {ticket.address && (
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {ticket.address}
                </p>
              )}
            </div>
            <InteractiveHoverButton
              text="Review"
              className="w-24 text-xs h-8"
              onClick={() => onReview(ticket.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { Badge } from '@/components/ui/badge'
import { CollapsibleSection } from '@/components/collapsible-section'
import { CheckCircle, XCircle, Wrench, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import type { CompletionData } from '@/hooks/use-ticket-detail'
import { formatCurrency, getMediaUrls } from '@/hooks/use-ticket-detail'

interface TicketCompletionTabProps {
  completion: CompletionData
}

export function TicketCompletionTab({ completion }: TicketCompletionTabProps) {
  const mediaUrls = getMediaUrls(completion.media_urls)

  return (
    <div className="space-y-5">
      {/* Status + Contractor */}
      <div className="flex items-center gap-3">
        <Badge
          variant={completion.completed ? 'default' : 'destructive'}
          className="gap-1"
        >
          {completion.completed ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {completion.completed ? 'Completed' : 'Not Done'}
        </Badge>
        {completion.contractor_name && (
          <Link
            href={completion.contractor_id ? `/contractors?id=${completion.contractor_id}` : '#'}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Wrench className="h-3.5 w-3.5" />
            {completion.contractor_name}
          </Link>
        )}
      </div>

      {/* Amounts Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Quote</p>
          <p className="font-mono text-sm font-medium">{formatCurrency(completion.quote_amount)}</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Markup</p>
          <p className="font-mono text-sm font-medium">{formatCurrency(completion.markup_amount)}</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-mono text-base font-bold text-primary">{formatCurrency(completion.total_amount)}</p>
        </div>
      </div>

      {/* Notes */}
      {(completion.notes || completion.completion_text) && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm whitespace-pre-wrap">
              {completion.notes || completion.completion_text}
            </p>
          </div>
        </div>
      )}

      {/* Reason (if not completed) */}
      {!completion.completed && completion.reason && (
        <div>
          <p className="text-[11px] font-medium text-destructive/70 uppercase tracking-wider mb-2">Reason</p>
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-sm text-destructive">{completion.reason}</p>
          </div>
        </div>
      )}

      {/* Received date */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Received</p>
          <p className="text-sm font-medium">{format(new Date(completion.received_at), 'dd MMM yyyy, HH:mm')}</p>
        </div>
      </div>

      {/* Photos */}
      {mediaUrls.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Photos ({mediaUrls.length})
          </p>
          {mediaUrls.length > 6 ? (
            <CollapsibleSection
              title="Photos"
              count={mediaUrls.length}
              defaultOpen={false}
            >
              <div className="grid grid-cols-3 gap-1.5">
                {mediaUrls.map((url, index) => (
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
                      className="w-full h-16 object-cover rounded border group-hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </CollapsibleSection>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {mediaUrls.map((url, index) => (
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
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { ChatHistory } from '@/components/chat-message'
import { Phone, User } from 'lucide-react'
import { formatPhoneDisplay } from '@/lib/normalize'
import type { ConversationData } from '@/hooks/use-ticket-detail'
import { getLogEntries } from '@/hooks/use-ticket-detail'

interface TicketConversationTabProps {
  conversation: ConversationData
}

export function TicketConversationTab({ conversation }: TicketConversationTabProps) {
  const messages = getLogEntries(conversation.log)
  const formattedPhone = formatPhoneDisplay(conversation.phone) || conversation.phone

  return (
    <div className="flex flex-col h-full">
      {/* Caller info bar */}
      <div className="flex items-center gap-4 pb-3 mb-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-sm">{formattedPhone}</span>
        </div>
        {conversation.caller_name && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">
              {conversation.caller_name}
              {conversation.caller_role && (
                <span className="text-muted-foreground text-xs ml-1">({conversation.caller_role})</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Chat bubbles */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 rounded-xl p-4">
        <ChatHistory messages={messages} />
      </div>
    </div>
  )
}

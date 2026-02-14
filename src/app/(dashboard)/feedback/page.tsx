'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { Textarea } from '@/components/ui/textarea'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { MessageCircle, Send, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug Report', desc: 'Something isn\'t working correctly' },
  { value: 'feature', label: 'Feature Request', desc: 'I\'d like Yarro to do something new' },
  { value: 'improvement', label: 'Improvement', desc: 'Something could work better' },
  { value: 'general', label: 'General', desc: 'Other feedback or comments' },
]

interface FeedbackEntry {
  id: string
  category: string
  message: string
  context: string | null
  created_at: string
}

export default function FeedbackPage() {
  const { propertyManager } = usePM()
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [context, setContext] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [recentFeedback, setRecentFeedback] = useState<FeedbackEntry[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!propertyManager) return
    supabase
      .from('c1_feedback')
      .select('*')
      .eq('property_manager_id', propertyManager.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecentFeedback(data)
      })
  }, [propertyManager, supabase])

  const handleSubmit = async () => {
    if (!message.trim() || !propertyManager) return
    setSending(true)

    const { error } = await supabase.from('c1_feedback').insert({
      property_manager_id: propertyManager.id,
      category,
      message: message.trim(),
      context: context.trim() || null,
    })

    if (error) {
      toast.error('Failed to send feedback')
    } else {
      toast.success('Thanks for your feedback!')
      setSent(true)
      setRecentFeedback(prev => [{
        id: crypto.randomUUID(),
        category,
        message: message.trim(),
        context: context.trim() || null,
        created_at: new Date().toISOString(),
      }, ...prev])
      setTimeout(() => {
        setMessage('')
        setContext('')
        setCategory('general')
        setSent(false)
      }, 2000)
    }
    setSending(false)
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground mb-2">Feedback</h1>
      <p className="text-muted-foreground mb-6">
        Help us improve Yarro. Tell us what&apos;s working, what&apos;s not, and what you&apos;d like to see.
      </p>

      <div className="space-y-6">
        {/* Feedback Form */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-sm font-medium">Send Feedback</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  What were you doing? What happened? What would you prefer?
                </p>
              </div>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div>
                        <span>{cat.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{cat.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Describe your feedback..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />

              <Textarea
                placeholder="Context (optional) — e.g., what page were you on, what ticket, etc."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />

              <InteractiveHoverButton
                text={sent ? 'Sent!' : sending ? 'Sending...' : 'Send Feedback'}
                onClick={handleSubmit}
                disabled={sending || sent || !message.trim()}
                className={cn('w-40 text-sm h-9', sent && 'bg-emerald-500')}
              />
            </div>
          </div>
        </div>

        {/* Recent Feedback */}
        {recentFeedback.length > 0 && (
          <div className="bg-card rounded-xl border p-6">
            <h2 className="text-sm font-medium mb-4">Your Recent Feedback</h2>
            <div className="space-y-3">
              {recentFeedback.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                        {FEEDBACK_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{entry.message}</p>
                    {entry.context && (
                      <p className="text-xs text-muted-foreground mt-1">{entry.context}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

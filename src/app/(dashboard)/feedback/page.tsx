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
import { MessageCircle, Bug, Lightbulb, Sparkles, HelpCircle, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug Report', desc: 'Something isn\'t working correctly', icon: Bug, color: 'text-red-500', bg: 'bg-red-500/10', badgeBg: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  { value: 'feature', label: 'Feature Request', desc: 'I\'d like Yarro to do something new', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-500/10', badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { value: 'improvement', label: 'Improvement', desc: 'Something could work better', icon: Sparkles, color: 'text-blue-500', bg: 'bg-blue-500/10', badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  { value: 'general', label: 'General', desc: 'Other feedback or comments', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-500/10', badgeBg: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
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

  const activeCat = FEEDBACK_CATEGORIES.find(c => c.value === category)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-primary/5 via-background to-blue-500/5 dark:from-primary/10 dark:to-blue-500/10 border-b flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent" />
        <div className="relative px-8 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Feedback</h1>
              <p className="text-muted-foreground mt-0.5">
                Help us shape Yarro. Every piece of feedback makes the product better.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content — two columns, no page scroll */}
      <div className="flex-1 min-h-0 flex gap-6 p-6">
        {/* Left: Form */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {/* Category dropdown */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-3.5 w-3.5', cat.color)} />
                        <span>{cat.label}</span>
                        <span className="text-xs text-muted-foreground">{cat.desc}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="flex-1 flex flex-col space-y-1.5 min-h-0">
            <label className="text-sm font-medium">
              {activeCat?.label || 'Your Feedback'}
            </label>
            <Textarea
              placeholder={
                category === 'bug' ? 'What were you doing? What happened? What did you expect?' :
                category === 'feature' ? 'Describe what you\'d like Yarro to do and why it matters to you...' :
                category === 'improvement' ? 'What could work better? What would you prefer to happen?' :
                'Share your thoughts — what were you doing, what happened, what would you prefer?'
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 resize-none text-sm min-h-0"
            />
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Context <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Which page were you on? Which ticket? Any other details..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <InteractiveHoverButton
              text={sent ? 'Sent!' : sending ? 'Sending...' : 'Send Feedback'}
              onClick={handleSubmit}
              disabled={sending || sent || !message.trim()}
              className={cn('w-44 text-sm h-10', sent && 'bg-emerald-500')}
            />
            {!message.trim() && (
              <p className="text-xs text-muted-foreground">Write something above to send</p>
            )}
          </div>
        </div>

        {/* Right: History */}
        <div className="w-[360px] flex-shrink-0 bg-card rounded-2xl border flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b flex-shrink-0">
            <h2 className="text-sm font-semibold text-foreground">Feedback History</h2>
            <p className="text-xs text-muted-foreground">{recentFeedback.length} submissions</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {recentFeedback.length === 0 ? (
              <div className="text-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No feedback yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your submissions will appear here</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-5 bottom-5 w-px bg-border" />

                <div className="space-y-3">
                  {recentFeedback.map((entry) => {
                    const cat = FEEDBACK_CATEGORIES.find(c => c.value === entry.category)
                    const Icon = cat?.icon || HelpCircle
                    return (
                      <div key={entry.id} className="relative flex gap-3">
                        <div className={cn(
                          'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card flex-shrink-0',
                          cat?.bg || 'bg-muted'
                        )}>
                          <Icon className={cn('h-3.5 w-3.5', cat?.color || 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0 rounded-lg border p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', cat?.badgeBg || 'bg-muted')}>
                              {cat?.label || entry.category}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed line-clamp-3">{entry.message}</p>
                          {entry.context && (
                            <p className="text-[11px] text-muted-foreground border-t pt-1.5">{entry.context}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

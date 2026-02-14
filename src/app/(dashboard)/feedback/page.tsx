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
import { MessageCircle, Bug, Lightbulb, Sparkles, HelpCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug Report', desc: 'Something isn\'t working', icon: Bug, color: 'text-red-500', bg: 'bg-red-500/10', badgeBg: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  { value: 'feature', label: 'Feature Request', desc: 'Something new', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-500/10', badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { value: 'improvement', label: 'Improvement', desc: 'Something better', icon: Sparkles, color: 'text-blue-500', bg: 'bg-blue-500/10', badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  { value: 'general', label: 'General', desc: 'Other', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-500/10', badgeBg: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
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
  const [doing, setDoing] = useState('')
  const [happened, setHappened] = useState('')
  const [prefer, setPrefer] = useState('')
  const [ideas, setIdeas] = useState('')
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
      .limit(20)
      .then(({ data }) => {
        if (data) setRecentFeedback(data)
      })
  }, [propertyManager, supabase])

  const hasContent = doing.trim() || happened.trim() || prefer.trim() || ideas.trim()

  const handleSubmit = async () => {
    if (!hasContent || !propertyManager) return
    setSending(true)

    // Build structured message
    const parts: string[] = []
    if (doing.trim()) parts.push(`What I was doing: ${doing.trim()}`)
    if (happened.trim()) parts.push(`What happened: ${happened.trim()}`)
    if (prefer.trim()) parts.push(`What I'd prefer: ${prefer.trim()}`)
    if (ideas.trim()) parts.push(`Ideas: ${ideas.trim()}`)
    const message = parts.join('\n\n')

    // Store structured data in context as JSON
    const context = JSON.stringify({ doing: doing.trim(), happened: happened.trim(), prefer: prefer.trim(), ideas: ideas.trim() })

    const { error } = await supabase.from('c1_feedback').insert({
      property_manager_id: propertyManager.id,
      category,
      message,
      context,
    })

    if (error) {
      toast.error('Failed to send feedback')
    } else {
      toast.success('Thanks for your feedback!')
      setSent(true)
      setRecentFeedback(prev => [{
        id: crypto.randomUUID(),
        category,
        message,
        context,
        created_at: new Date().toISOString(),
      }, ...prev])
      setTimeout(() => {
        setDoing('')
        setHappened('')
        setPrefer('')
        setIdeas('')
        setCategory('general')
        setSent(false)
      }, 2000)
    }
    setSending(false)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Feedback</h1>
            <p className="text-xs text-muted-foreground">Help us improve Yarro — tell us what&apos;s working and what isn&apos;t</p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Form */}
        <div className="flex-1 p-6 overflow-y-auto border-r">
          <div className="space-y-4 max-w-2xl">
            {/* Category dropdown */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
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

            {/* Structured free text fields */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">What were you doing?</label>
              <Textarea
                placeholder="e.g., Creating a ticket, reviewing a quote, checking the dashboard..."
                value={doing}
                onChange={(e) => setDoing(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">What happened?</label>
              <Textarea
                placeholder="e.g., The page didn't load, the quote was missing info, I couldn't find..."
                value={happened}
                onChange={(e) => setHappened(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                What would you prefer to happen? <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="e.g., I'd expect to see the contractor notes in the message, the timeout should be..."
                value={prefer}
                onChange={(e) => setPrefer(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Any ideas? <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="e.g., What if there was a button that..., It would be great to have..."
                value={ideas}
                onChange={(e) => setIdeas(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="pt-1">
              <InteractiveHoverButton
                text={sent ? 'Sent!' : sending ? 'Sending...' : 'Send Feedback'}
                onClick={handleSubmit}
                disabled={sending || sent || !hasContent}
                className={cn('w-44 text-sm h-10', sent && 'bg-emerald-500')}
              />
            </div>
          </div>
        </div>

        {/* Right: History */}
        <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b flex-shrink-0">
            <h2 className="text-sm font-semibold text-foreground">History</h2>
            <p className="text-xs text-muted-foreground">{recentFeedback.length} submissions</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {recentFeedback.length === 0 ? (
              <div className="text-center py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-3">
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No feedback yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your submissions will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentFeedback.map((entry) => {
                  const cat = FEEDBACK_CATEGORIES.find(c => c.value === entry.category)
                  const Icon = cat?.icon || HelpCircle
                  // Try to parse structured context
                  let structured: { doing?: string; happened?: string; prefer?: string; ideas?: string } | null = null
                  try {
                    if (entry.context) structured = JSON.parse(entry.context)
                  } catch { /* not structured */ }

                  return (
                    <div key={entry.id} className="rounded-xl border p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full', cat?.badgeBg || 'bg-muted')}>
                          <Icon className="h-3 w-3" />
                          {cat?.label || entry.category}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {structured ? (
                        <div className="space-y-1.5 text-sm">
                          {structured.doing && (
                            <div>
                              <span className="text-[11px] font-medium text-muted-foreground">Doing:</span>
                              <p className="text-foreground leading-snug">{structured.doing}</p>
                            </div>
                          )}
                          {structured.happened && (
                            <div>
                              <span className="text-[11px] font-medium text-muted-foreground">What happened:</span>
                              <p className="text-foreground leading-snug">{structured.happened}</p>
                            </div>
                          )}
                          {structured.prefer && (
                            <div>
                              <span className="text-[11px] font-medium text-muted-foreground">Preferred:</span>
                              <p className="text-foreground leading-snug">{structured.prefer}</p>
                            </div>
                          )}
                          {structured.ideas && (
                            <div>
                              <span className="text-[11px] font-medium text-muted-foreground">Ideas:</span>
                              <p className="text-foreground leading-snug">{structured.ideas}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-foreground leading-relaxed">{entry.message}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

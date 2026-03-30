'use client'

import Link from 'next/link'
import { Rocket, ChevronRight, Check, ArrowRight } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

export interface OnboardingChecklistItem {
  key: string
  label: string
  description: string
  complete: boolean
  count: number
  link_href: string
}

interface OnboardingCategoryCardProps {
  items: OnboardingChecklistItem[]
  expanded: boolean
  onToggle: () => void
}

export function OnboardingCategoryCard({ items, expanded, onToggle }: OnboardingCategoryCardProps) {
  const doneCount = items.filter(i => i.complete).length
  const allDone = doneCount === items.length

  if (allDone) return null

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground">Getting Started</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground font-medium">
              {doneCount}/{items.length}
            </span>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y divide-border/40">
          {items.map(item => (
            <Link
              key={item.key}
              href={item.link_href}
              className={`flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors ${
                item.complete ? 'opacity-50' : ''
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.complete
                  ? 'bg-success/10'
                  : 'border border-border'
              }`}>
                {item.complete && <Check className="w-3 h-3 text-success" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.complete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              {!item.complete && (
                <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

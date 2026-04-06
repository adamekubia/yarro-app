'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CategoryBadge } from './category-badge'
import { getCtaText, getTodoHref, deriveUrgency, deriveCategory } from './todo-panel'
import type { TodoItem } from './todo-panel'

interface JobCardProps {
  item: TodoItem
  onHandoffClick: (item: TodoItem) => void
  onTicketClick: (item: TodoItem) => void
}

export function JobCard({ item, onHandoffClick, onTicketClick }: JobCardProps) {
  const href = getTodoHref(item)
  const ctaText = getCtaText(item)
  const urgency = deriveUrgency(item)
  const category = deriveCategory(item)
  const src = item.source_type || 'ticket'

  const handleClick = () => {
    if (src === 'handoff') {
      onHandoffClick(item)
      return
    }
    onTicketClick(item)
  }

  const isEmergency = urgency === 'emergency'

  const cardClass = cn(
    'flex items-center p-5 rounded-xl border',
    'transition-all duration-150 cursor-pointer group',
    'hover:-translate-y-0.5 hover:shadow-sm',
    isEmergency
      ? 'bg-danger/5 border-danger/20 hover:border-danger/30'
      : 'bg-white border-[#F3F4F6]',
  )

  const content = (
    <>
      {/* Left section: priority meter + badge + divider */}
      <div className="flex items-center pr-5 mr-5 border-r-2 border-[#F3F4F6] self-stretch">
        <CategoryBadge category={category} urgency={urgency} />
      </div>
      {/* Right section: text content */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[#111827] truncate">{item.issue_summary}</p>
        <p className="text-sm text-[#6B7280] truncate mt-0.5">{item.property_label}</p>
      </div>
      <Button
        variant="default"
        size="sm"
        className={cn(
          'flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity',
        )}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleClick()
        }}
      >
        {ctaText}
      </Button>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {content}
      </Link>
    )
  }

  return (
    <button onClick={handleClick} className={cn(cardClass, 'w-full text-left')}>
      {content}
    </button>
  )
}

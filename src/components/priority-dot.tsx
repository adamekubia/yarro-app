import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PRIORITY_DESCRIPTIONS } from '@/lib/constants'

const dotColors: Record<string, string> = {
  low:         'bg-emerald-500',
  medium:      'bg-yellow-500',
  high:        'bg-amber-500',
  urgent:      'bg-orange-500',
  emergency:   'bg-red-600',
  // Legacy
  cosmetic:    'bg-emerald-500',
  damaging:    'bg-yellow-500',
  destructive: 'bg-orange-500',
}

export function PriorityDot({ priority, className }: { priority: string; className?: string }) {
  const color = dotColors[priority.toLowerCase()] || 'bg-gray-400'
  const label = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase()
  const desc = PRIORITY_DESCRIPTIONS[priority] || PRIORITY_DESCRIPTIONS[label]

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-block h-2 w-2 rounded-full', color, className)} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">{label}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

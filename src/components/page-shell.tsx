'use client'

import { cn } from '@/lib/utils'
import { typography } from '@/lib/typography'

interface PageShellProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  headerExtra?: React.ReactNode
  topBar?: React.ReactNode
  children: React.ReactNode
  noPadding?: boolean
  headerBorder?: boolean
  scrollable?: boolean
  className?: string
}

export function PageShell({
  title,
  subtitle,
  actions,
  headerExtra,
  topBar,
  children,
  noPadding = false,
  headerBorder = false,
  scrollable = false,
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'flex flex-col h-dvh lg:h-full overflow-hidden',
        className
      )}
    >
      {topBar ? (
        <div className="flex-shrink-0 flex flex-col px-8">
          <div className="flex items-center h-16">
            <div className="min-w-0">
              <h1 className={typography.pageTitle}>{title}</h1>
              {subtitle && <p className={typography.pageSubtitle}>{subtitle}</p>}
            </div>
          </div>
          <div className={cn(
            'flex items-center justify-between h-12 gap-3',
            headerBorder ? 'border-b border-foreground/10' : ''
          )}>
            {topBar}
            {actions && (
              <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
            )}
          </div>
        </div>
      ) : (
        <div className={cn(
          'flex-shrink-0 flex items-center justify-between gap-4 px-8 h-16',
          headerBorder ? 'border-b border-foreground/10' : ''
        )}>
          <div className="min-w-0">
            <h1 className={typography.pageTitle}>{title}</h1>
            {subtitle && <p className={typography.pageSubtitle}>{subtitle}</p>}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
          )}
        </div>
      )}

      <div className={cn(
        'flex flex-col flex-1 min-h-0 overflow-hidden',
        !noPadding && 'pb-8'
      )}>
        {headerExtra && (
          <div className="flex-shrink-0 px-8">{headerExtra}</div>
        )}
        <div className={cn('flex-1 min-h-0', !noPadding && 'px-8', scrollable ? 'overflow-y-auto' : 'flex flex-col overflow-hidden')}>
          {children}
        </div>
      </div>
    </div>
  )
}

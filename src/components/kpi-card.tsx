'use client'

import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

type KPICardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'warning' | 'danger' | 'success'
  onClick?: () => void
  className?: string
}

const variantStyles = {
  default: 'border-border',
  warning: 'border-l-4 border-l-warning border-t-border border-r-border border-b-border',
  danger: 'border-l-4 border-l-danger border-t-border border-r-border border-b-border',
  success: 'border-l-4 border-l-success border-t-border border-r-border border-b-border',
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  onClick,
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-xl border p-5 transition-all',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/20',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          {trend.isPositive ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-danger" />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              trend.isPositive ? 'text-success' : 'text-danger'
            )}
          >
            {trend.value}%
          </span>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      )}
    </div>
  )
}

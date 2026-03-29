import { cn } from '@/lib/utils'
import { typography } from '@/lib/typography'

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  accentColor?: 'danger' | 'warning' | 'success' | 'primary' | 'muted'
}

const accentClasses: Record<string, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
  muted: 'text-muted-foreground',
}

export function StatCard({ label, value, subtitle, accentColor }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-1">
      <span className={cn(typography.sectionTitle)}>{label}</span>
      <span className={cn(typography.statValue)}>{value}</span>
      {subtitle && (
        <span className={cn(
          typography.metaText,
          accentColor ? accentClasses[accentColor] : undefined
        )}>
          {subtitle}
        </span>
      )}
    </div>
  )
}

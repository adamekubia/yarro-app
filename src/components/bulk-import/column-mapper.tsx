'use client'

import { useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ColumnMatch, MatchConfidence } from '@/lib/bulk-import/pipeline'
import { ENTITY_CONFIGS, type EntityType } from '@/lib/bulk-import/config'

interface ColumnMapperProps {
  matches: ColumnMatch[]
  entityType: EntityType
  sampleRows: string[][] // First 3 data rows for preview
  onChange: (matches: ColumnMatch[]) => void
}

const CONFIDENCE_STYLES: Record<MatchConfidence, { bg: string; icon: React.ReactNode; label: string }> = {
  exact: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: <Check className="h-3 w-3 text-emerald-500" />,
    label: 'Matched',
  },
  alias: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: <Check className="h-3 w-3 text-emerald-500" />,
    label: 'Matched',
  },
  unmatched: {
    bg: 'bg-destructive/10 border-destructive/30',
    icon: <X className="h-3 w-3 text-destructive" />,
    label: 'Unmatched',
  },
}

export function ColumnMapper({ matches, entityType, sampleRows, onChange }: ColumnMapperProps) {
  const config = ENTITY_CONFIGS[entityType]
  const mappedTargets = new Set(
    matches.filter((m) => m.targetColumn && !m.needsReview).map((m) => m.targetColumn)
  )

  const handleChange = useCallback(
    (sourceIndex: number, targetColumn: string | null) => {
      const updated = matches.map((m) => {
        if (m.sourceIndex === sourceIndex) {
          return {
            ...m,
            targetColumn: targetColumn === '__skip__' ? null : targetColumn,
            confidence: targetColumn && targetColumn !== '__skip__' ? ('exact' as const) : ('unmatched' as const),
            needsReview: false,
          }
        }
        return m
      })
      onChange(updated)
    },
    [matches, onChange]
  )

  const missingRequired = config.columns.filter(
    (c) => c.required && !matches.some((m) => m.targetColumn === c.key && !m.needsReview)
  )

  return (
    <div className="space-y-4">
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Missing required: {missingRequired.map((c) => c.label).join(', ')}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden divide-y divide-border">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
          <span>Your Column</span>
          <span className="w-8" />
          <span>Maps To</span>
        </div>

        {/* Rows */}
        {matches.map((match) => {
          const style = match.needsReview
            ? { bg: 'bg-amber-500/10 border-amber-500/30', icon: <AlertTriangle className="h-3 w-3 text-amber-500" />, label: 'Review' }
            : CONFIDENCE_STYLES[match.confidence]

          return (
            <div
              key={match.sourceIndex}
              className={cn('grid grid-cols-[1fr_auto_1fr] gap-3 px-4 py-3 items-center', style.bg)}
            >
              {/* Source column */}
              <div>
                <p className="text-sm font-medium">{match.sourceHeader}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {sampleRows
                    .slice(0, 3)
                    .map((r) => r[match.sourceIndex] || '')
                    .filter(Boolean)
                    .join(' · ') || 'No data'}
                </p>
              </div>

              {/* Status icon */}
              <div className="flex items-center justify-center w-8">
                {style.icon}
              </div>

              {/* Target column dropdown */}
              <Select
                value={match.targetColumn || '__skip__'}
                onValueChange={(val) => handleChange(match.sourceIndex, val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip__">
                    <span className="text-muted-foreground">Skip this column</span>
                  </SelectItem>
                  {config.columns.map((col) => {
                    const isUsed = mappedTargets.has(col.key) && match.targetColumn !== col.key
                    return (
                      <SelectItem key={col.key} value={col.key} disabled={isUsed}>
                        {col.label}
                        {col.required && <span className="text-destructive ml-1">*</span>}
                        {isUsed && <span className="text-muted-foreground ml-1">(used)</span>}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, Info, Pencil } from 'lucide-react'
import { ENTITY_CONFIGS, type EntityType, type MergeRule } from '@/lib/bulk-import/config'
import type { ColumnMatch, MergeInfo } from '@/lib/bulk-import/pipeline'

// Groups for section layout + dropdown grouping
const SECTION_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Property', keys: ['address', 'postcode', 'property_type', 'city'] },
  { label: 'Landlord', keys: ['landlord_name', 'landlord_phone', 'landlord_email'] },
  { label: 'Room', keys: ['room_number', 'room_name', 'monthly_rent', 'rent_due_day'] },
  { label: 'Tenancy', keys: ['tenancy_start_date', 'tenancy_end_date'] },
  { label: 'Contact', keys: ['full_name', 'phone', 'email'] },
]

function getGroupForTarget(targetKey: string | null): string {
  if (!targetKey) return 'Skipped'
  for (const group of SECTION_GROUPS) {
    if (group.keys.includes(targetKey)) return group.label
  }
  return 'Skipped'
}

interface ColumnMapperProps {
  sourceHeaders: string[]
  matches: ColumnMatch[]
  merges: MergeInfo[]
  entityType: EntityType
  onMappingComplete: (matches: ColumnMatch[], merges: MergeInfo[]) => void
}

export function ColumnMapper({
  sourceHeaders,
  matches,
  merges: initialMerges,
  entityType,
  onMappingComplete,
}: ColumnMapperProps) {
  const config = ENTITY_CONFIGS[entityType]

  const [localMatches, setLocalMatches] = useState<ColumnMatch[]>(() => [...matches])

  // Which targets are currently used (including merge targets)
  const usedTargets = useMemo(() => {
    const used = new Set<string>()
    localMatches.forEach((m) => {
      if (m.targetColumn && m.confidence !== 'unmatched') used.add(m.targetColumn)
    })
    return used
  }, [localMatches])

  // Collect all keys consumed by active merges — these should be hidden from dropdowns
  const mergeConsumedKeys = useMemo(() => {
    const consumed = new Set<string>()
    localMatches.forEach((m) => {
      if (m.confidence === 'merge' && m.targetColumn) {
        consumed.add(m.targetColumn)
      }
    })
    return consumed
  }, [localMatches])

  // Detect active merges from current localMatches
  const activeMerges = useMemo(() => {
    const active: { rule: MergeRule; label: string }[] = []
    for (const rule of config.mergeRules) {
      const allSourcesFound = rule.sourceSets.every((aliasSet) =>
        localMatches.some((m) => {
          if (!m.targetColumn || m.confidence === 'unmatched') return false
          const nt = m.targetColumn.toLowerCase().replace(/[_\s-]/g, '')
          return aliasSet.some((a) => a.toLowerCase().replace(/[_\s-]/g, '') === nt)
        })
      )
      if (allSourcesFound) active.push({ rule, label: rule.label })
    }
    return active
  }, [localMatches, config.mergeRules])

  // Check if required fields are mapped
  const addressMapped = usedTargets.has('address') || usedTargets.has('postcode')
  const canContinue = addressMapped

  const skippedCount = localMatches.filter((m) => !m.targetColumn || m.confidence === 'unmatched').length

  // Group CSV columns by section
  const groupedRows = useMemo(() => {
    const groups = new Map<string, number[]>()
    for (const section of SECTION_GROUPS) groups.set(section.label, [])
    groups.set('Skipped', [])

    localMatches.forEach((match, idx) => {
      const group = match.confidence === 'merge'
        ? getGroupForTarget(match.targetColumn)
        : getGroupForTarget(match.targetColumn && match.confidence !== 'unmatched' ? match.targetColumn : null)
      const arr = groups.get(group) || []
      arr.push(idx)
      groups.set(group, arr)
    })

    return [...groups.entries()].filter(([, indices]) => indices.length > 0)
  }, [localMatches])

  const handleChange = (sourceIndex: number, targetKey: string | null) => {
    setLocalMatches((prev) => prev.map((m, idx) => {
      if (idx === sourceIndex) {
        return {
          ...m,
          targetColumn: targetKey,
          confidence: targetKey ? 'exact' as const : 'unmatched' as const,
          needsReview: false,
        }
      }
      return m
    }))
  }

  // Unmerge: reset merged columns back to unmatched dropdowns
  const handleUnmerge = (mergeTargetColumn: string) => {
    setLocalMatches((prev) => prev.map((m) => {
      if (m.confidence === 'merge' && m.targetColumn === mergeTargetColumn) {
        return { ...m, confidence: 'unmatched' as const, targetColumn: null, needsReview: false }
      }
      return m
    }))
  }

  // Compute valid merges from current state for parent
  const handleContinue = () => {
    // Only pass merges that are still valid (all sources still have merge confidence)
    const validMerges = initialMerges.filter((merge) =>
      merge.sourceIndices.every((idx) => localMatches[idx]?.confidence === 'merge')
    )
    onMappingComplete(localMatches, validMerges)
  }

  // Filter dropdown options: hide merge-consumed keys
  const isKeyAvailable = (key: string, currentTarget: string | null): boolean => {
    if (mergeConsumedKeys.has(key) && key !== currentTarget) return false
    return true
  }

  return (
    <div className="space-y-8 px-2">
      {/* Grouped mapping rows */}
      {groupedRows.map(([groupLabel, indices]) => (
        <div key={groupLabel} className="space-y-2">
          <h4 className="text-base font-semibold text-foreground px-1 pt-2">{groupLabel}</h4>

          {indices.map((idx) => {
            const header = sourceHeaders[idx]
            const match = localMatches[idx]
            const currentTarget = match?.targetColumn && match.confidence !== 'unmatched' ? match.targetColumn : null
            const isMerge = match?.confidence === 'merge'

            return (
              <div
                key={idx}
                className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center bg-muted/30 border border-border rounded-xl px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground truncate">{header}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                {isMerge ? (() => {
                  const mergeRule = config.mergeRules.find((r) =>
                    r.sourceSets.some((aliasSet) =>
                      aliasSet.some((a) => a.toLowerCase().replace(/[_\s-]/g, '') === header.toLowerCase().replace(/[_\s-]/g, ''))
                    )
                  )
                  const targetCol = mergeRule ? config.columns.find((c) => c.key === mergeRule.targetColumn) : null
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Merged into <span className="font-medium text-foreground">{targetCol?.label || 'unknown'}</span>
                      </span>
                      <button
                        onClick={() => handleUnmerge(match.targetColumn!)}
                        className="ml-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Unmerge and remap manually"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })() : (
                  <Select
                    value={currentTarget || '__skip__'}
                    onValueChange={(val) => handleChange(idx, val === '__skip__' ? null : val)}
                  >
                    <SelectTrigger className="h-9 text-sm rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">
                        <span className="text-muted-foreground">Skip (don&apos;t import)</span>
                      </SelectItem>
                      {SECTION_GROUPS.map((group) => (
                        <SelectGroup key={group.label}>
                          <SelectLabel className="flex items-center gap-2 px-2 py-1.5">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{group.label}</span>
                            <div className="flex-1 h-px bg-border" />
                          </SelectLabel>
                          {group.keys.map((key) => {
                            const col = config.columns.find((c) => c.key === key)
                            if (!col) return null
                            if (!isKeyAvailable(key, currentTarget)) return null
                            const inUse = usedTargets.has(key) && currentTarget !== key
                            return (
                              <SelectItem key={key} value={key} disabled={inUse}>
                                {col.label}
                                {col.required && <span className="text-destructive ml-1">*</span>}
                                {inUse && <span className="text-muted-foreground ml-1 text-[10px]">(in use)</span>}
                              </SelectItem>
                            )
                          })}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Merge indicators */}
      {activeMerges.length > 0 && (
        <div className="space-y-2">
          {activeMerges.map((merge, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm bg-muted/50 border border-border rounded-xl px-4 py-3">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{merge.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary + Continue */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">
          {sourceHeaders.length - skippedCount} mapped, {skippedCount} skipped
        </span>
        <Button
          size="sm"
          onClick={handleContinue}
          disabled={!canContinue}
          className="gap-1.5"
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

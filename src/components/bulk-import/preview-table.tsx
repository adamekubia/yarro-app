'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { CheckCircle2, AlertTriangle, XCircle, Info, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENTITY_CONFIGS, type EntityType, type ColumnDef } from '@/lib/bulk-import/config'
import { PREVIEW_ROWS, type ValidatedRow, type ColumnMatch, type MergeInfo } from '@/lib/bulk-import/pipeline'

// Column groups for unified entity type
const COLUMN_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Property', keys: ['address', 'property_type', 'city'] },
  { label: 'Landlord', keys: ['landlord_name', 'landlord_phone', 'landlord_email'] },
  { label: 'Room', keys: ['room_number', 'room_name', 'monthly_rent', 'rent_due_day', 'tenancy_start_date', 'tenancy_end_date'] },
  { label: 'Tenant', keys: ['full_name', 'phone', 'email'] },
]

interface PreviewTableProps {
  rows: ValidatedRow[]
  entityType: EntityType
  matches: ColumnMatch[]
  merges: MergeInfo[]
  sourceHeaders: string[]
  skippedHeaders: string[]
  onEdit: (rowIndex: number, field: string, value: string) => void
  onColumnChange: (targetColumn: string, sourceIndex: number | null) => void
}

export function PreviewTable({
  rows,
  entityType,
  matches,
  merges,
  sourceHeaders,
  skippedHeaders,
  onEdit,
  onColumnChange,
}: PreviewTableProps) {
  const config = ENTITY_CONFIGS[entityType]
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)

  // For unified: track which groups are expanded
  const isUnified = entityType === 'unified'

  // Determine which target columns have a source mapped
  const mappedTargets = new Map<string, number>() // targetKey → sourceIndex
  matches.forEach((m, idx) => {
    if (m.targetColumn && !m.needsReview) {
      mappedTargets.set(m.targetColumn, idx)
    }
  })
  merges.forEach((m) => {
    m.sourceIndices.forEach((idx) => mappedTargets.set(m.rule.targetColumn, idx))
  })

  // For unified: determine which groups have any mapped columns
  const groupHasMapping = (keys: string[]) => keys.some((k) => mappedTargets.has(k))

  // Default expanded: groups with mappings are expanded; others collapsed
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const expanded = new Set<string>()
    if (isUnified) {
      COLUMN_GROUPS.forEach((g) => {
        if (groupHasMapping(g.keys)) expanded.add(g.label)
      })
      // Always expand Property (required)
      expanded.add('Property')
    }
    return expanded
  })

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // Determine visible columns
  let visibleColumns: ColumnDef[]
  if (isUnified) {
    visibleColumns = []
    for (const group of COLUMN_GROUPS) {
      if (expandedGroups.has(group.label)) {
        visibleColumns.push(...config.columns.filter((c) => group.keys.includes(c.key)))
      }
    }
  } else {
    // Non-unified: show required + columns with data (original behavior)
    visibleColumns = config.columns.filter(
      (col) => col.required || col.requiredHint || rows.some((r) => r.data[col.key])
    )
  }

  const visibleRows = rows.slice(0, PREVIEW_ROWS)
  const validCount = rows.filter((r) => Object.keys(r.errors).length === 0).length
  const warningCount = rows.filter(
    (r) => Object.keys(r.errors).length === 0 && Object.keys(r.warnings).length > 0
  ).length
  const errorCount = rows.filter((r) => Object.keys(r.errors).length > 0).length

  // Missing required columns
  const missingRequired = config.columns.filter(
    (c) => c.required && !mappedTargets.has(c.key)
  )

  // Which source indices are already mapped to a target
  const usedSourceIndices = new Set<number>()
  matches.forEach((m, idx) => {
    if (m.targetColumn && m.confidence !== 'unmatched') usedSourceIndices.add(idx)
  })

  const handleBlur = useCallback(
    (rowIndex: number, field: string, value: string) => {
      onEdit(rowIndex, field, value)
      setEditingCell(null)
    },
    [onEdit]
  )

  // Find which source index is mapped to a given target column
  const getSourceForTarget = (targetKey: string): number | null => {
    const idx = matches.findIndex((m) => m.targetColumn === targetKey && m.confidence !== 'merge')
    return idx >= 0 ? idx : null
  }

  return (
    <div className="space-y-3">
      {/* Info banners */}
      {merges.length > 0 && (
        <div className="space-y-1">
          {merges.map((merge, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/30 rounded-lg px-3 py-2">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              {merge.rule.label}
            </div>
          ))}
        </div>
      )}

      {skippedHeaders.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {skippedHeaders.length} CSV column{skippedHeaders.length !== 1 ? 's' : ''} not mapped: {skippedHeaders.join(', ')}
        </div>
      )}

      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Missing required: {missingRequired.map((c) => c.label).join(', ')}
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> {validCount} valid
        </span>
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3 w-3" /> {warningCount} warnings
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3 w-3" /> {errorCount} errors
          </span>
        )}
        {rows.length > PREVIEW_ROWS && (
          <span className="text-muted-foreground ml-auto">
            Showing {PREVIEW_ROWS} of {rows.length}
          </span>
        )}
      </div>

      {/* Collapsed group buttons (unified only) */}
      {isUnified && (
        <div className="flex items-center gap-2 flex-wrap">
          {COLUMN_GROUPS.filter((g) => !expandedGroups.has(g.label)).map((group) => {
            const hasMappings = groupHasMapping(group.keys)
            return (
              <button
                key={group.label}
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                  hasMappings
                    ? 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <Plus className="h-3 w-3" />
                {group.label}
                {!hasMappings && <span className="text-muted-foreground">(not mapped)</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10 sticky left-0 bg-muted/50 z-10">#</th>
              {isUnified && visibleColumns.length > 0 && (() => {
                // Render group headers + column headers
                const cells: React.ReactNode[] = []
                let currentGroup = ''

                for (const col of visibleColumns) {
                  const group = COLUMN_GROUPS.find((g) => g.keys.includes(col.key))
                  if (group && group.label !== currentGroup) {
                    currentGroup = group.label
                    // Group separator
                    cells.push(
                      <th
                        key={`sep-${group.label}`}
                        className="px-0 py-0 w-px"
                      >
                        <div className="w-px h-8 bg-border" />
                      </th>
                    )
                  }

                  const sourceIdx = getSourceForTarget(col.key)
                  const isMapped = sourceIdx !== null || merges.some((m) => m.rule.targetColumn === col.key)

                  cells.push(
                    <th key={col.key} className={cn('px-1 py-1 text-left min-w-[120px]', !isMapped && 'opacity-60')}>
                      <ColumnHeaderDropdown
                        col={col}
                        isMapped={isMapped}
                        sourceHeaders={sourceHeaders}
                        matches={matches}
                        currentSourceIndex={sourceIdx}
                        onSelect={(srcIdx) => onColumnChange(col.key, srcIdx)}
                      />
                    </th>
                  )
                }

                return cells
              })()}
              {!isUnified && visibleColumns.map((col) => {
                const sourceIdx = getSourceForTarget(col.key)
                const isMapped = sourceIdx !== null || merges.some((m) => m.rule.targetColumn === col.key)

                return (
                  <th key={col.key} className={cn('px-1 py-1 text-left min-w-[120px]', !isMapped && 'opacity-60')}>
                    <ColumnHeaderDropdown
                      col={col}
                      isMapped={isMapped}
                      sourceHeaders={sourceHeaders}
                      matches={matches}
                      currentSourceIndex={sourceIdx}
                      onSelect={(srcIdx) => onColumnChange(col.key, srcIdx)}
                    />
                  </th>
                )
              })}
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12" />
            </tr>
            {/* Group label row for unified */}
            {isUnified && (
              <tr className="border-b bg-muted/30">
                <td className="sticky left-0 bg-muted/30 z-10" />
                {(() => {
                  const cells: React.ReactNode[] = []
                  let currentGroup = ''
                  let groupSpan = 0
                  const groupQueue: { label: string; span: number }[] = []

                  for (let i = 0; i < visibleColumns.length; i++) {
                    const col = visibleColumns[i]
                    const group = COLUMN_GROUPS.find((g) => g.keys.includes(col.key))
                    const groupLabel = group?.label || ''

                    if (groupLabel !== currentGroup) {
                      if (currentGroup) groupQueue.push({ label: currentGroup, span: groupSpan })
                      currentGroup = groupLabel
                      groupSpan = 1
                    } else {
                      groupSpan++
                    }
                  }
                  if (currentGroup) groupQueue.push({ label: currentGroup, span: groupSpan })

                  for (const g of groupQueue) {
                    // Separator
                    cells.push(<td key={`gsep-${g.label}`} className="w-px px-0"><div className="w-px h-full" /></td>)
                    cells.push(
                      <td
                        key={`glbl-${g.label}`}
                        colSpan={g.span}
                        className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => toggleGroup(g.label)}
                      >
                        <span className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3 rotate-90 transition-transform" />
                          {g.label}
                        </span>
                      </td>
                    )
                  }
                  return cells
                })()}
                <td />
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row, rowIdx) => {
              const hasErrors = Object.keys(row.errors).length > 0
              const hasWarnings = Object.keys(row.warnings).length > 0
              return (
                <tr key={rowIdx} className={cn(hasErrors && 'bg-destructive/5')}>
                  <td className="px-3 py-1.5 text-muted-foreground sticky left-0 bg-card z-10">{rowIdx + 1}</td>
                  {isUnified && visibleColumns.length > 0 && (() => {
                    const cells: React.ReactNode[] = []
                    let currentGroup = ''

                    for (const col of visibleColumns) {
                      const group = COLUMN_GROUPS.find((g) => g.keys.includes(col.key))
                      if (group && group.label !== currentGroup) {
                        currentGroup = group.label
                        cells.push(<td key={`sep-${rowIdx}-${group.label}`} className="w-px px-0"><div className="w-px h-full bg-border" /></td>)
                      }

                      cells.push(
                        <DataCell
                          key={col.key}
                          col={col}
                          row={row}
                          rowIdx={rowIdx}
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          handleBlur={handleBlur}
                        />
                      )
                    }
                    return cells
                  })()}
                  {!isUnified && visibleColumns.map((col) => (
                    <DataCell
                      key={col.key}
                      col={col}
                      row={row}
                      rowIdx={rowIdx}
                      editingCell={editingCell}
                      setEditingCell={setEditingCell}
                      handleBlur={handleBlur}
                    />
                  ))}
                  <td className="px-3 py-1.5">
                    {hasErrors ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : hasWarnings ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Column Header Dropdown ────────────────────────────────

function ColumnHeaderDropdown({
  col,
  isMapped,
  sourceHeaders,
  matches,
  currentSourceIndex,
  onSelect,
}: {
  col: ColumnDef
  isMapped: boolean
  sourceHeaders: string[]
  matches: ColumnMatch[]
  currentSourceIndex: number | null
  onSelect: (sourceIndex: number | null) => void
}) {
  // Build value: source index as string, or '__none__'
  const value = currentSourceIndex !== null ? String(currentSourceIndex) : '__none__'

  return (
    <Select
      value={value}
      onValueChange={(val) => {
        if (val === '__none__') onSelect(null)
        else onSelect(parseInt(val, 10))
      }}
    >
      <SelectTrigger className={cn(
        'h-auto border-0 bg-transparent shadow-none px-2 py-1 text-xs font-medium hover:bg-muted/80',
        !isMapped && 'text-muted-foreground'
      )}>
        <span className="flex items-center gap-1 truncate">
          {col.label}
          {col.required && <span className="text-destructive">*</span>}
          {!isMapped && <span className="text-[10px] text-amber-500 ml-1">unmapped</span>}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">Not mapped</span>
        </SelectItem>
        {sourceHeaders.map((header, idx) => {
          const match = matches[idx]
          const isUsedElsewhere = match?.targetColumn && match.targetColumn !== col.key && match.confidence !== 'unmatched'
          const usedByLabel = isUsedElsewhere
            ? ENTITY_CONFIGS[match?.targetColumn ? 'unified' : 'unified'].columns.find(
                (c) => c.key === match?.targetColumn
              )?.label
            : null

          return (
            <SelectItem key={idx} value={String(idx)} disabled={!!isUsedElsewhere}>
              {header}
              {isUsedElsewhere && (
                <span className="text-muted-foreground ml-1 text-[10px]">
                  (→ {usedByLabel})
                </span>
              )}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// ─── Data Cell ─────────────────────────────────────────────

function DataCell({
  col,
  row,
  rowIdx,
  editingCell,
  setEditingCell,
  handleBlur,
}: {
  col: ColumnDef
  row: ValidatedRow
  rowIdx: number
  editingCell: { row: number; col: string } | null
  setEditingCell: (cell: { row: number; col: string } | null) => void
  handleBlur: (rowIndex: number, field: string, value: string) => void
}) {
  const value = row.data[col.key] || ''
  const error = row.errors[col.key]
  const warning = row.warnings[col.key]
  const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key

  return (
    <td
      className={cn(
        'px-3 py-1.5',
        error && 'ring-1 ring-inset ring-destructive/50',
        !error && warning && 'ring-1 ring-inset ring-amber-500/50'
      )}
      title={error || warning || undefined}
      onClick={() => setEditingCell({ row: rowIdx, col: col.key })}
    >
      {isEditing ? (
        <Input
          autoFocus
          defaultValue={value}
          className="h-6 text-xs px-1"
          onBlur={(e) => handleBlur(rowIdx, col.key, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleBlur(rowIdx, col.key, (e.target as HTMLInputElement).value)
            }
            if (e.key === 'Escape') setEditingCell(null)
          }}
        />
      ) : (
        <span className={cn('cursor-text', !value && 'text-muted-foreground italic')}>
          {value || '—'}
        </span>
      )}
    </td>
  )
}

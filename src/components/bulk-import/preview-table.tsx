'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENTITY_CONFIGS, type EntityType } from '@/lib/bulk-import/config'
import { PREVIEW_ROWS, type ValidatedRow } from '@/lib/bulk-import/pipeline'

interface PreviewTableProps {
  rows: ValidatedRow[]
  entityType: EntityType
  onEdit: (rowIndex: number, field: string, value: string) => void
}

export function PreviewTable({ rows, entityType, onEdit }: PreviewTableProps) {
  const config = ENTITY_CONFIGS[entityType]
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)

  const visibleRows = rows.slice(0, PREVIEW_ROWS)
  const validCount = rows.filter((r) => Object.keys(r.errors).length === 0).length
  const warningCount = rows.filter(
    (r) => Object.keys(r.errors).length === 0 && Object.keys(r.warnings).length > 0
  ).length
  const errorCount = rows.filter((r) => Object.keys(r.errors).length > 0).length

  // Only show columns that have data or are required
  const activeColumns = config.columns.filter(
    (col) => col.required || rows.some((r) => r.data[col.key])
  )

  const handleBlur = useCallback(
    (rowIndex: number, field: string, value: string) => {
      onEdit(rowIndex, field, value)
      setEditingCell(null)
    },
    [onEdit]
  )

  return (
    <div className="space-y-3">
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

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">#</th>
              {activeColumns.map((col) => (
                <th key={col.key} className="px-3 py-2 text-left font-medium text-muted-foreground min-w-[120px]">
                  {col.label}
                  {col.required && <span className="text-destructive ml-0.5">*</span>}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-16">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row, rowIdx) => {
              const hasErrors = Object.keys(row.errors).length > 0
              const hasWarnings = Object.keys(row.warnings).length > 0
              return (
                <tr key={rowIdx} className={cn(hasErrors && 'bg-destructive/5')}>
                  <td className="px-3 py-1.5 text-muted-foreground">{rowIdx + 1}</td>
                  {activeColumns.map((col) => {
                    const value = row.data[col.key] || ''
                    const error = row.errors[col.key]
                    const warning = row.warnings[col.key]
                    const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key

                    return (
                      <td
                        key={col.key}
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
                  })}
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

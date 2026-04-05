'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, Info, AlertTriangle, XCircle, CheckCircle2, SkipForward } from 'lucide-react'
import type { ValidatedRow, MergeInfo } from '@/lib/bulk-import/pipeline'
import type { EntityType } from '@/lib/bulk-import/config'

interface ConfirmImportProps {
  validatedRows: ValidatedRow[]
  entityType: EntityType
  merges: MergeInfo[]
  skippedHeaders: string[]
  onConfirm: () => void
  onBack: () => void
}

export function ConfirmImport({
  validatedRows,
  entityType,
  merges,
  skippedHeaders,
  onConfirm,
  onBack,
}: ConfirmImportProps) {
  const validCount = validatedRows.filter((r) => Object.keys(r.errors).length === 0).length
  const errorCount = validatedRows.filter((r) => Object.keys(r.errors).length > 0).length
  const warningCount = validatedRows.filter(
    (r) => Object.keys(r.errors).length === 0 && Object.keys(r.warnings).length > 0
  ).length

  // Count entities for unified
  const isUnified = entityType === 'unified'
  const uniqueAddresses = isUnified
    ? new Set(validatedRows.filter((r) => r.data.address).map((r) => r.data.address.toLowerCase().trim())).size
    : 0
  const rowsWithRooms = isUnified
    ? validatedRows.filter((r) => r.data.room_number).length
    : 0
  const rowsWithTenants = isUnified
    ? validatedRows.filter((r) => r.data.full_name || r.data.phone).length
    : 0

  // Collect unique errors for display
  const errorDetails = validatedRows
    .filter((r) => Object.keys(r.errors).length > 0)
    .slice(0, 10)
    .map((r, idx) => ({
      row: idx + 1,
      errors: Object.values(r.errors),
    }))

  return (
    <div className="space-y-5 px-2">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Review your import</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Check the summary below, then confirm to import.
        </p>
      </div>

      {/* Entity counts */}
      {isUnified ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{uniqueAddresses}</p>
            <p className="text-xs text-muted-foreground">Properties</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{rowsWithRooms}</p>
            <p className="text-xs text-muted-foreground">Rooms</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{rowsWithTenants}</p>
            <p className="text-xs text-muted-foreground">Tenants</p>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{validCount}</p>
          <p className="text-xs text-muted-foreground">Rows to import</p>
        </div>
      )}

      {/* Valid / error / warning summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> {validCount} valid
        </span>
        {warningCount > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-4 w-4" /> {warningCount} warnings
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1.5 text-destructive">
            <XCircle className="h-4 w-4" /> {errorCount} errors
          </span>
        )}
      </div>

      {/* Merge notes */}
      {merges.length > 0 && (
        <div className="space-y-2">
          {merges.map((merge, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm bg-muted/50 border border-border rounded-xl px-4 py-3">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{merge.rule.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Skipped columns */}
      {skippedHeaders.length > 0 && (
        <div className="flex items-start gap-2.5 text-sm bg-muted/30 border border-border rounded-xl px-4 py-3">
          <SkipForward className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-muted-foreground">Skipped columns (not needed for import): </span>
            <span className="text-foreground">{skippedHeaders.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Error details */}
      {errorCount > 0 && (
        <div className="border border-destructive/20 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-destructive/5 border-b border-destructive/20">
            <p className="text-sm font-medium text-foreground">{errorCount} rows with errors (will be skipped)</p>
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-border">
            {errorDetails.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-xs text-foreground">
                  <span className="text-muted-foreground">Row {item.row}:</span> {item.errors.join(', ')}
                </span>
              </div>
            ))}
            {errorCount > 10 && (
              <div className="px-4 py-2 text-xs text-muted-foreground">
                ...and {errorCount - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to mapping
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={validCount === 0}
          className="gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          Import {validCount} rows
        </Button>
      </div>
    </div>
  )
}

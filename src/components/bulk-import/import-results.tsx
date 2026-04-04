'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw } from 'lucide-react'
import type { ImportSummary } from '@/lib/bulk-import/pipeline'

interface ImportResultsProps {
  summary: ImportSummary
  entityLabel: string
  onImportMore: () => void
  onDone: () => void
}

export function ImportResults({ summary, entityLabel, onImportMore, onDone }: ImportResultsProps) {
  const issues = summary.results.filter((r) => r.status !== 'created')

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/10 mx-auto mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold">{summary.created}</p>
          <p className="text-xs text-muted-foreground">Created</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-500/10 mx-auto mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold">{summary.skipped}</p>
          <p className="text-xs text-muted-foreground">Skipped (duplicates)</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-destructive/10 mx-auto mb-2">
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold">{summary.errors}</p>
          <p className="text-xs text-muted-foreground">Errors</p>
        </div>
      </div>

      {/* Issue details */}
      {issues.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b">
            <p className="text-xs font-medium text-muted-foreground">Issues</p>
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
            {issues.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                {r.status === 'error' ? (
                  <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                )}
                <span className="text-xs">
                  <span className="text-muted-foreground">Row {r.row}:</span> {r.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onImportMore} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Import more
        </Button>
        <Button size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

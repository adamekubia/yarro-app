'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, Building2, DoorOpen, Users } from 'lucide-react'
import type { ImportSummary } from '@/lib/bulk-import/pipeline'
import type { EntityType } from '@/lib/bulk-import/config'

interface ImportResultsProps {
  summary: ImportSummary
  entityType: EntityType
  entityLabel: string
  onImportMore: () => void
  onDone: () => void
}

export function ImportResults({ summary, entityType, entityLabel, onImportMore, onDone }: ImportResultsProps) {
  const issues = summary.results.filter((r) => r.status !== 'created')
  const isUnified = entityType === 'unified'

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {isUnified ? (
        <div className="space-y-3">
          {/* Per-entity breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border p-4 text-center">
              <Building2 className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-2xl font-bold">{summary.properties_created ?? 0}</p>
              <p className="text-xs text-muted-foreground">Properties created</p>
              {(summary.properties_existing ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.properties_existing} existing
                </p>
              )}
            </div>
            <div className="bg-card rounded-xl border p-4 text-center">
              <DoorOpen className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-2xl font-bold">{summary.rooms_created ?? 0}</p>
              <p className="text-xs text-muted-foreground">Rooms created</p>
            </div>
            <div className="bg-card rounded-xl border p-4 text-center">
              <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-2xl font-bold">{summary.tenants_created ?? 0}</p>
              <p className="text-xs text-muted-foreground">Tenants created</p>
            </div>
          </div>

          {/* Needs room assignment banner */}
          {(summary.tenants_need_room ?? 0) > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {summary.tenants_need_room} {summary.tenants_need_room === 1 ? 'tenant needs' : 'tenants need'} room assignment
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Go to{' '}
                  <Link href="/properties" className="underline hover:text-foreground">
                    Properties
                  </Link>{' '}
                  to assign tenants to rooms and enable rent tracking.
                </p>
              </div>
            </div>
          )}

          {/* Skipped / errors row */}
          {(summary.skipped > 0 || summary.errors > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl border p-3 text-center">
                <p className="text-lg font-bold">{summary.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped (duplicates)</p>
              </div>
              <div className="bg-card rounded-xl border p-3 text-center">
                <p className="text-lg font-bold">{summary.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          )}
        </div>
      ) : (
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
      )}

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

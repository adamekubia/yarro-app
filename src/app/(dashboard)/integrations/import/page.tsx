'use client'

import { useState } from 'react'
import { PageShell } from '@/components/page-shell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Layers, Wrench } from 'lucide-react'
import { BulkImportFlow } from '@/components/bulk-import/bulk-import-flow'
import type { EntityType } from '@/lib/bulk-import/config'

const IMPORT_OPTIONS: { type: EntityType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'unified', label: 'Properties & Tenants', icon: <Layers className="h-5 w-5" />, description: 'Properties, rooms, landlords & tenants from one spreadsheet' },
  { type: 'contractors', label: 'Contractors', icon: <Wrench className="h-5 w-5" />, description: 'Names, trades, contact details' },
]

export default function ImportPage() {
  const [entityType, setEntityType] = useState<EntityType | null>(null)

  return (
    <PageShell title="Import Data">
      <div className="max-w-3xl mx-auto space-y-6">
        {!entityType ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What are you importing?</p>
            <div className="grid grid-cols-2 gap-4">
              {IMPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setEntityType(opt.type)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-6 rounded-xl border border-border bg-card',
                    'hover:border-primary/50 hover:bg-accent transition-colors text-center'
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {opt.icon}
                  </div>
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEntityType(null)}>
                Change type
              </Button>
              <span className="text-sm text-muted-foreground">
                Importing: <span className="font-medium text-foreground">
                  {IMPORT_OPTIONS.find((o) => o.type === entityType)?.label}
                </span>
              </span>
            </div>
            <BulkImportFlow
              entityType={entityType}
              onCancel={() => setEntityType(null)}
            />
          </div>
        )}
      </div>
    </PageShell>
  )
}

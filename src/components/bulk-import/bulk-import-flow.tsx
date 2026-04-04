'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Loader2, Upload } from 'lucide-react'
import { ENTITY_CONFIGS, type EntityType } from '@/lib/bulk-import/config'
import {
  detectHasHeaders,
  matchColumns,
  applyMapping,
  normalizeRows,
  validateRows,
  type ColumnMatch,
  type ValidatedRow,
  type ImportSummary,
} from '@/lib/bulk-import/pipeline'
import { PasteInput } from './paste-input'
import { ColumnMapper } from './column-mapper'
import { PreviewTable } from './preview-table'
import { ImportResults } from './import-results'

type Step = 'paste' | 'map' | 'preview' | 'importing' | 'results'

interface BulkImportFlowProps {
  entityType: EntityType
  onComplete?: (summary: ImportSummary) => void
  onCancel?: () => void
}

export function BulkImportFlow({ entityType, onComplete, onCancel }: BulkImportFlowProps) {
  const supabase = createClient()
  const { propertyManager } = usePM()
  const config = ENTITY_CONFIGS[entityType]

  // State
  const [step, setStep] = useState<Step>('paste')
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [hasHeaders, setHasHeaders] = useState(true)
  const [headerConfidence, setHeaderConfidence] = useState(100)
  const [matches, setMatches] = useState<ColumnMatch[]>([])
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [normalizedData, setNormalizedData] = useState<Record<string, string>[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  // Derived
  const headers = hasHeaders ? rawRows[0]?.map((h) => h.trim()) || [] : rawRows[0]?.map((_, i) => `Column ${i + 1}`) || []
  const dataRows = hasHeaders ? rawRows.slice(1) : rawRows
  const validCount = validatedRows.filter((r) => Object.keys(r.errors).length === 0).length
  const requiredMapped = config.columns
    .filter((c) => c.required)
    .every((c) => matches.some((m) => m.targetColumn === c.key && !m.needsReview))

  // ─── Handlers ──────────────────────────────────────────

  const handleParsed = useCallback(
    (rows: string[][]) => {
      setRawRows(rows)
      const detection = detectHasHeaders(rows, entityType)
      setHasHeaders(detection.hasHeaders)
      setHeaderConfidence(detection.confidence)

      // Auto-advance to mapping
      const hdrs = detection.hasHeaders ? rows[0].map((h) => h.trim()) : rows[0].map((_, i) => `Column ${i + 1}`)
      const columnMatches = matchColumns(hdrs, entityType)
      setMatches(columnMatches)
      setStep('map')
    },
    [entityType]
  )

  const handleHeaderToggle = useCallback(
    (checked: boolean) => {
      setHasHeaders(checked)
      const hdrs = checked ? rawRows[0].map((h) => h.trim()) : rawRows[0].map((_, i) => `Column ${i + 1}`)
      const columnMatches = matchColumns(hdrs, entityType)
      setMatches(columnMatches)
    },
    [rawRows, entityType]
  )

  const handleContinueToPreview = useCallback(() => {
    const mapped = applyMapping(dataRows, matches)
    const normalized = normalizeRows(mapped, entityType)
    const validated = validateRows(normalized, entityType)
    setNormalizedData(normalized)
    setValidatedRows(validated)
    setStep('preview')
  }, [dataRows, matches, entityType])

  const handleEdit = useCallback(
    (rowIndex: number, field: string, value: string) => {
      const updated = [...normalizedData]
      updated[rowIndex] = { ...updated[rowIndex], [field]: value }
      setNormalizedData(updated)
      setValidatedRows(validateRows(updated, entityType))
    },
    [normalizedData, entityType]
  )

  const handleImport = useCallback(async () => {
    if (!propertyManager) return
    setStep('importing')

    // Only send valid rows
    const rowsToImport = validatedRows
      .filter((r) => Object.keys(r.errors).length === 0)
      .map((r) => r.data)

    if (rowsToImport.length === 0) {
      toast.error('No valid rows to import')
      setStep('preview')
      return
    }

    try {
      const { data, error } = await supabase.rpc(config.rpcName, {
        p_pm_id: propertyManager.id,
        p_data: rowsToImport,
      })

      if (error) {
        toast.error(error.message || 'Import failed')
        setStep('preview')
        return
      }

      const result = data as unknown as ImportSummary
      setSummary(result)
      setStep('results')

      if (result.created > 0) {
        toast.success(`${result.created} ${config.label.toLowerCase()} imported`)
      }

      onComplete?.(result)
    } catch {
      toast.error('Import failed — please try again')
      setStep('preview')
    }
  }, [propertyManager, validatedRows, config, supabase, onComplete])

  const reset = useCallback(() => {
    setStep('paste')
    setRawRows([])
    setMatches([])
    setValidatedRows([])
    setNormalizedData([])
    setSummary(null)
  }, [])

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {(['paste', 'map', 'preview', 'results'] as const).map((s, i) => (
          <span key={s} className={step === s ? 'text-foreground font-medium' : ''}>
            {i > 0 && <span className="mx-2">→</span>}
            {s === 'paste' ? 'Paste' : s === 'map' ? 'Map Columns' : s === 'preview' ? 'Preview' : 'Results'}
          </span>
        ))}
      </div>

      {/* Step 1: Paste */}
      {step === 'paste' && (
        <PasteInput
          onParsed={handleParsed}
          onError={(err) => toast.error(err)}
        />
      )}

      {/* Step 2: Map Columns */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="has-headers"
              checked={hasHeaders}
              onCheckedChange={(checked) => handleHeaderToggle(checked === true)}
            />
            <label htmlFor="has-headers" className="text-sm">
              First row is headers
              {headerConfidence < 70 && (
                <span className="text-amber-600 ml-2 text-xs">(not sure — please verify)</span>
              )}
            </label>
          </div>

          <ColumnMapper
            matches={matches}
            entityType={entityType}
            sampleRows={dataRows.slice(0, 3)}
            onChange={setMatches}
          />

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep('paste')} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleContinueToPreview}
              disabled={!requiredMapped}
              className="gap-1.5"
            >
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <PreviewTable
            rows={validatedRows}
            entityType={entityType}
            onEdit={handleEdit}
          />

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep('map')} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={validCount === 0}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Import {validCount} {config.label.toLowerCase()}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Importing {validCount} {config.label.toLowerCase()}...
          </p>
        </div>
      )}

      {/* Step 5: Results */}
      {step === 'results' && summary && (
        <ImportResults
          summary={summary}
          entityLabel={config.label}
          onImportMore={reset}
          onDone={() => onCancel?.()}
        />
      )}
    </div>
  )
}

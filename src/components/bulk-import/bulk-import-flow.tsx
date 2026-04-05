'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import { ENTITY_CONFIGS, type EntityType } from '@/lib/bulk-import/config'
import {
  detectHasHeaders,
  matchColumns,
  applyMapping,
  normalizeRows,
  validateRows,
  type ColumnMatch,
  type MergeInfo,
  type ValidatedRow,
  type ImportSummary,
} from '@/lib/bulk-import/pipeline'
import { enrichAddressesWithCities } from '@/lib/postcode'
import { PasteInput } from './paste-input'
import { PreviewTable } from './preview-table'
import { ImportResults } from './import-results'

type Step = 'paste' | 'preview' | 'importing' | 'results'

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
  const [merges, setMerges] = useState<MergeInfo[]>([])
  const [skippedHeaders, setSkippedHeaders] = useState<string[]>([])
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [normalizedData, setNormalizedData] = useState<Record<string, string>[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [enrichingCities, setEnrichingCities] = useState(false)

  // Derived
  const headers = hasHeaders ? rawRows[0]?.map((h) => h.trim()) || [] : rawRows[0]?.map((_, i) => `Column ${i + 1}`) || []
  const dataRows = hasHeaders ? rawRows.slice(1) : rawRows
  const validCount = validatedRows.filter((r) => Object.keys(r.errors).length === 0).length

  // ── Recompute mapping from current state ──
  const recompute = useCallback(
    (currentMatches: ColumnMatch[], currentMerges: MergeInfo[], currentDataRows: string[][]) => {
      const mapped = applyMapping(currentDataRows, currentMatches, currentMerges)
      const normalized = normalizeRows(mapped, entityType)
      const validated = validateRows(normalized, entityType)
      setNormalizedData(normalized)
      setValidatedRows(validated)
      return normalized
    },
    [entityType]
  )

  // ── Background city enrichment ──
  const enrichCities = useCallback(async (data: Record<string, string>[]) => {
    if (entityType !== 'unified') return

    const addressesNeedingCity = data
      .filter((r) => r.address && !r.city)
      .map((r) => r.address)

    if (addressesNeedingCity.length === 0) return

    setEnrichingCities(true)
    try {
      const cityMap = await enrichAddressesWithCities([...new Set(addressesNeedingCity)])
      const updated = data.map((r) => {
        if (r.address && !r.city) {
          const city = cityMap.get(r.address)
          if (city) return { ...r, city }
        }
        return r
      })
      setNormalizedData(updated)
      setValidatedRows(validateRows(updated, entityType))
    } catch {
      // City enrichment is best-effort — don't block on failure
    } finally {
      setEnrichingCities(false)
    }
  }, [entityType])

  // ─── Handlers ──────────────────────────────────────────

  const handleParsed = useCallback(
    (rows: string[][]) => {
      setRawRows(rows)
      const detection = detectHasHeaders(rows, entityType)
      setHasHeaders(detection.hasHeaders)
      setHeaderConfidence(detection.confidence)

      const hdrs = detection.hasHeaders ? rows[0].map((h) => h.trim()) : rows[0].map((_, i) => `Column ${i + 1}`)
      const dRows = detection.hasHeaders ? rows.slice(1) : rows
      const result = matchColumns(hdrs, entityType)
      setMatches(result.matches)
      setMerges(result.merges)
      setSkippedHeaders(result.skippedHeaders)

      // Immediately compute mapped data and show preview
      const mapped = applyMapping(dRows, result.matches, result.merges)
      const normalized = normalizeRows(mapped, entityType)
      const validated = validateRows(normalized, entityType)
      setNormalizedData(normalized)
      setValidatedRows(validated)
      setStep('preview')

      // Background: enrich cities from postcodes
      enrichCities(normalized)
    },
    [entityType, enrichCities]
  )

  const handleHeaderToggle = useCallback(
    (checked: boolean) => {
      setHasHeaders(checked)
      const hdrs = checked ? rawRows[0].map((h) => h.trim()) : rawRows[0].map((_, i) => `Column ${i + 1}`)
      const dRows = checked ? rawRows.slice(1) : rawRows
      const result = matchColumns(hdrs, entityType)
      setMatches(result.matches)
      setMerges(result.merges)
      setSkippedHeaders(result.skippedHeaders)
      recompute(result.matches, result.merges, dRows)
    },
    [rawRows, entityType, recompute]
  )

  const handleColumnChange = useCallback(
    (targetColumn: string, sourceIndex: number | null) => {
      const updated = matches.map((m, idx) => {
        if (m.confidence === 'merge') return m // Don't touch merges

        // Unmap any source currently pointing to this target
        if (m.targetColumn === targetColumn && idx !== sourceIndex) {
          return { ...m, targetColumn: null, confidence: 'unmatched' as const, needsReview: false }
        }
        // Assign the new source to this target
        if (sourceIndex !== null && idx === sourceIndex) {
          return { ...m, targetColumn: targetColumn, confidence: 'exact' as const, needsReview: false }
        }
        return m
      })
      setMatches(updated)

      const newSkipped = updated
        .filter((m) => m.confidence === 'unmatched' && !m.mergedFrom)
        .map((m) => m.sourceHeader)
      setSkippedHeaders(newSkipped)

      recompute(updated, merges, dataRows)
    },
    [matches, merges, dataRows, recompute]
  )

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
        if (entityType === 'unified') {
          const parts = []
          if (result.properties_created) parts.push(`${result.properties_created} properties`)
          if (result.rooms_created) parts.push(`${result.rooms_created} rooms`)
          if (result.tenants_created) parts.push(`${result.tenants_created} tenants`)
          toast.success(parts.length > 0 ? `Imported: ${parts.join(', ')}` : `${result.created} records imported`)
        } else {
          toast.success(`${result.created} ${config.label.toLowerCase()} imported`)
        }
      }

      onComplete?.(result)
    } catch {
      toast.error('Import failed — please try again')
      setStep('preview')
    }
  }, [propertyManager, validatedRows, config, supabase, onComplete, entityType])

  const reset = useCallback(() => {
    setStep('paste')
    setRawRows([])
    setMatches([])
    setMerges([])
    setSkippedHeaders([])
    setValidatedRows([])
    setNormalizedData([])
    setSummary(null)
    setEnrichingCities(false)
  }, [])

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-5 px-2">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {(['paste', 'preview', 'results'] as const).map((s, i) => (
          <span key={s} className={step === s || (step === 'importing' && s === 'preview') ? 'text-foreground font-medium' : ''}>
            {i > 0 && <span className="mx-2">→</span>}
            {s === 'paste' ? 'Paste' : s === 'preview' ? 'Preview' : 'Results'}
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

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Action bar — top */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => { reset(); setStep('paste') }} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Start over
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={validCount === 0}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Import {validCount} {entityType === 'unified' ? 'rows' : config.label.toLowerCase()}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="has-headers"
              checked={hasHeaders}
              onCheckedChange={(checked) => handleHeaderToggle(checked === true)}
            />
            <label htmlFor="has-headers" className="text-sm font-medium text-foreground">
              First row is headers
              {headerConfidence < 70 && (
                <span className="text-muted-foreground ml-2 text-xs font-normal">(not sure — please verify)</span>
              )}
            </label>
            {enrichingCities && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                <Loader2 className="h-3 w-3 animate-spin" />
                Looking up cities...
              </span>
            )}
          </div>

          <PreviewTable
            rows={validatedRows}
            entityType={entityType}
            matches={matches}
            merges={merges}
            sourceHeaders={headers}
            skippedHeaders={skippedHeaders}
            onEdit={handleEdit}
            onColumnChange={handleColumnChange}
          />
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Importing {validCount} {entityType === 'unified' ? 'rows' : config.label.toLowerCase()}...
          </p>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'results' && summary && (
        <ImportResults
          summary={summary}
          entityType={entityType}
          entityLabel={config.label}
          onImportMore={reset}
          onDone={() => onCancel?.()}
        />
      )}
    </div>
  )
}

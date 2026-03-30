'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { PageShell } from '@/components/page-shell'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  ArrowRight,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Building2,
  Users,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type ImportType = 'properties' | 'tenants'
type Step = 'select' | 'upload' | 'preview' | 'importing' | 'results'

interface ImportResult {
  row: number
  status: 'created' | 'skipped' | 'error'
  error?: string
  id?: string
}

interface ImportSummary {
  batch_id: string
  results: ImportResult[]
  total: number
  created: number
  skipped: number
  errors: number
}

// ─────────────────────────────────────────────────────────
// CSV templates
// ─────────────────────────────────────────────────────────

const PROPERTY_HEADERS = ['address', 'property_type', 'city', 'landlord_name', 'landlord_phone', 'landlord_email']
const PROPERTY_EXAMPLE = ['12 Oak Street, Manchester, M1 2AB', 'HMO', 'Manchester', 'John Smith', '07700900123', 'john@example.com']

const TENANT_HEADERS = ['full_name', 'phone', 'email', 'property_address', 'role_tag']
const TENANT_EXAMPLE = ['Jane Doe', '07700900456', 'jane@example.com', '12 Oak Street, Manchester, M1 2AB', 'tenant']

function downloadTemplate(type: ImportType) {
  const headers = type === 'properties' ? PROPERTY_HEADERS : TENANT_HEADERS
  const example = type === 'properties' ? PROPERTY_EXAMPLE : TENANT_EXAMPLE
  const csv = [headers.join(','), example.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yarro-${type}-template.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────

interface ValidationError {
  row: number
  field: string
  message: string
}

function validateRows(type: ImportType, rows: Record<string, string>[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +2 for header row + 1-indexed

    if (type === 'properties') {
      if (!row.address?.trim()) {
        errors.push({ row: rowNum, field: 'address', message: 'Address is required' })
      }
    } else {
      if (!row.full_name?.trim() && !row.phone?.trim()) {
        errors.push({ row: rowNum, field: 'full_name', message: 'Name or phone is required' })
      }
    }
  }

  return errors
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter()
  const { propertyManager } = usePM()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('select')
  const [importType, setImportType] = useState<ImportType>('properties')
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [fileName, setFileName] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  // ─── File handling ──────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    setFileName(file.name)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (result) => {
        const rows = result.data as Record<string, string>[]
        if (rows.length === 0) {
          toast.error('CSV file is empty')
          return
        }

        const hdrs = result.meta.fields || []
        setHeaders(hdrs)
        setParsedRows(rows)

        const errors = validateRows(importType, rows)
        setValidationErrors(errors)
        setStep('preview')
      },
      error: () => {
        toast.error('Failed to parse CSV file')
      },
    })
  }, [importType])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      handleFileSelect(file)
    } else {
      toast.error('Please upload a CSV file')
    }
  }, [handleFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  // ─── Import ─────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!propertyManager || parsedRows.length === 0) return

    setStep('importing')

    try {
      const rpcName = importType === 'properties' ? 'bulk_import_properties' : 'bulk_import_tenants'
      const { data, error } = await supabase.rpc(rpcName, {
        p_pm_id: propertyManager.id,
        p_data: parsedRows,
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
        toast.success(`${result.created} ${importType} imported successfully`)
      }
    } catch {
      toast.error('Import failed — please try again')
      setStep('preview')
    }
  }, [propertyManager, parsedRows, importType, supabase])

  // ─── Reset ──────────────────────────────────────────────

  const reset = () => {
    setStep('select')
    setParsedRows([])
    setHeaders([])
    setValidationErrors([])
    setFileName('')
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <PageShell
      title="Import from Spreadsheet"
      subtitle="Upload a CSV to import your properties or tenants"
      scrollable
      actions={
        <Button variant="outline" size="sm" onClick={() => router.push('/integrations')} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      }
    >
      <div className="max-w-3xl">

        {/* ─── Step 1: Select import type ───────────────── */}
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What would you like to import?</p>
            <div className="grid grid-cols-2 gap-4">
              {([
                { type: 'properties' as ImportType, icon: Building2, label: 'Properties', desc: 'Addresses, landlords, property types' },
                { type: 'tenants' as ImportType, icon: Users, label: 'Tenants', desc: 'Names, contact details, property assignment' },
              ]).map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => { setImportType(type); setStep('upload') }}
                  className={cn(
                    'flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all text-center',
                    'hover:border-primary hover:bg-primary/5 cursor-pointer',
                    'border-border bg-card'
                  )}
                >
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 2: Upload CSV ──────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with your {importType}
              </p>
              <Button variant="ghost" size="sm" onClick={() => downloadTemplate(importType)} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download template
              </Button>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-4 p-12 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expects columns: {importType === 'properties' ? PROPERTY_HEADERS.join(', ') : TENANT_HEADERS.join(', ')}
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Preview + validate ──────────────── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  {fileName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} found
                  {validationErrors.length > 0 && (
                    <span className="text-destructive ml-2">
                      ({validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Validation issues
                </p>
                <ul className="mt-2 space-y-1">
                  {validationErrors.slice(0, 10).map((err, i) => (
                    <li key={i} className="text-xs text-destructive/80">
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {validationErrors.length > 10 && (
                    <li className="text-xs text-destructive/60">
                      ...and {validationErrors.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                      {headers.map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.slice(0, 50).map((row, i) => {
                      const hasError = validationErrors.some((e) => e.row === i + 2)
                      return (
                        <tr key={i} className={cn(hasError && 'bg-destructive/5')}>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-xs whitespace-nowrap max-w-[200px] truncate">
                              {row[h] || <span className="text-muted-foreground/40">—</span>}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                  Showing first 50 of {parsedRows.length} rows
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Choose different file
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={parsedRows.length === 0}
                className="gap-1.5"
              >
                Import {parsedRows.length} {importType}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Importing ───────────────────────── */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Importing {parsedRows.length} {importType}...
            </p>
          </div>
        )}

        {/* ─── Step 5: Results ─────────────────────────── */}
        {step === 'results' && summary && (
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

            {/* Error details */}
            {summary.results.filter((r) => r.status === 'error' || r.status === 'skipped').length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 border-b">
                  <p className="text-xs font-medium text-muted-foreground">Issues</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
                  {summary.results
                    .filter((r) => r.status !== 'created')
                    .map((r, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2">
                        {r.status === 'error' ? (
                          <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        )}
                        <span className="text-xs">
                          <span className="text-muted-foreground">Row {r.row}:</span>{' '}
                          {r.error}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                Import more
              </Button>
              <Button
                size="sm"
                onClick={() => router.push(importType === 'properties' ? '/properties' : '/tenants')}
                className="gap-1.5"
              >
                View {importType}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

      </div>
    </PageShell>
  )
}

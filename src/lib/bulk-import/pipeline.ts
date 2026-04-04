// Bulk import pipeline: parsing, header detection, column matching,
// normalization, and validation.
//
// This is a UI convenience layer — it helps users map their spreadsheet
// columns to our schema. The RPCs are authoritative for dedup, validation,
// and insert. Frontend normalization improves preview accuracy only.

import Papa from 'papaparse'
import { normalizeRecord } from '@/lib/normalize'
import { ENTITY_CONFIGS, type EntityType, type ColumnDef } from './config'

// ─── Types ─────────────────────────────────────────────────

export type MatchConfidence = 'exact' | 'alias' | 'unmatched'

export interface ColumnMatch {
  sourceIndex: number
  sourceHeader: string
  targetColumn: string | null
  confidence: MatchConfidence
  needsReview: boolean
}

export interface ParseResult {
  rows: string[][]
  hasHeaders: boolean
  headerConfidence: number
  headers: string[]
  dataRows: string[][]
  error?: string
}

export interface ValidatedRow {
  data: Record<string, string>
  errors: Record<string, string>
  warnings: Record<string, string>
}

export interface ImportSummary {
  batch_id: string
  results: { row: number; status: 'created' | 'skipped' | 'error'; error?: string; id?: string }[]
  total: number
  created: number
  skipped: number
  errors: number
}

// ─── Constants ─────────────────────────────────────────────

const MAX_ROWS = 500
const PREVIEW_ROWS = 50
const HEADER_SAMPLE_SIZE = 20

// ─── Step 1: Parsing ───────────────────────────────────────
// PapaParse for both paste and file input. Auto-detects delimiters.

export function parseText(rawText: string): { rows: string[][]; error?: string } {
  const trimmed = rawText.trim()
  if (!trimmed) return { rows: [], error: 'No data provided' }

  const result = Papa.parse<string[]>(trimmed, {
    header: false,
    delimiter: '',
    skipEmptyLines: true,
  })

  const rows = result.data.filter((row) => row.some((cell) => cell.trim() !== ''))

  if (rows.length === 0) return { rows: [], error: 'No data rows found' }
  if (rows.length > MAX_ROWS + 1) {
    return { rows: [], error: `Maximum ${MAX_ROWS} rows per import. Found ${rows.length - 1} data rows.` }
  }

  return { rows }
}

export function parseFile(file: File): Promise<{ rows: string[][]; error?: string }> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      header: false,
      delimiter: '',
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.filter((row) => row.some((cell) => cell.trim() !== ''))
        if (rows.length === 0) {
          resolve({ rows: [], error: 'No data rows found in file' })
          return
        }
        if (rows.length > MAX_ROWS + 1) {
          resolve({ rows: [], error: `Maximum ${MAX_ROWS} rows per import. Found ${rows.length - 1} data rows.` })
          return
        }
        resolve({ rows })
      },
      error: (err) => {
        resolve({ rows: [], error: `Failed to parse file: ${err.message}` })
      },
    })
  })
}

// ─── Step 2: Header Detection ──────────────────────────────
// Heuristic: check if first row looks like headers vs data.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s\+\-\(\)]{7,}$/
const POSTCODE_RE = /[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i

function looksLikeData(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (EMAIL_RE.test(v)) return true
  if (PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 10) return true
  if (POSTCODE_RE.test(v)) return true
  return false
}

export function detectHasHeaders(
  rows: string[][],
  entityType: EntityType
): { hasHeaders: boolean; confidence: number } {
  if (rows.length === 0) return { hasHeaders: false, confidence: 0 }

  const firstRow = rows[0]
  const config = ENTITY_CONFIGS[entityType]
  const allNames = config.columns.flatMap((c) => [
    c.key,
    c.label.toLowerCase(),
    ...c.aliases,
  ])

  // Check if first row values match known column names/aliases
  const normalized = firstRow.map((v) => v.trim().toLowerCase().replace(/[_\s-]/g, ''))
  const headerMatches = normalized.filter((v) =>
    allNames.some((name) => name.toLowerCase().replace(/[_\s-]/g, '') === v)
  ).length

  // Check if first row looks like data (emails, phones, postcodes)
  const dataLikeCount = firstRow.filter(looksLikeData).length

  // Score
  if (headerMatches >= 2) return { hasHeaders: true, confidence: 95 }
  if (headerMatches >= 1 && dataLikeCount === 0) return { hasHeaders: true, confidence: 80 }
  if (dataLikeCount >= 2) return { hasHeaders: false, confidence: 90 }
  if (dataLikeCount >= 1) return { hasHeaders: false, confidence: 70 }

  // Ambiguous — first row is all short text with no numbers
  const allShortText = firstRow.every((v) => v.trim().length < 30 && !/\d/.test(v))
  if (allShortText) return { hasHeaders: true, confidence: 60 }

  return { hasHeaders: false, confidence: 50 }
}

// ─── Step 3: Column Matching (2-tier) ──────────────────────
// Tier 1: Exact match after normalization
// Tier 2: Alias dictionary (entity-scoped)

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s-]/g, '')
}

export function matchColumns(
  headers: string[],
  entityType: EntityType
): ColumnMatch[] {
  const config = ENTITY_CONFIGS[entityType]
  const matches: ColumnMatch[] = []
  const usedTargets = new Set<string>()

  for (let i = 0; i < headers.length; i++) {
    const sourceHeader = headers[i].trim()
    const normalized = normalizeHeader(sourceHeader)
    let match: ColumnMatch = {
      sourceIndex: i,
      sourceHeader,
      targetColumn: null,
      confidence: 'unmatched',
      needsReview: false,
    }

    // Tier 1: Exact match after normalization
    const exactMatch = config.columns.find(
      (c) => normalizeHeader(c.key) === normalized || normalizeHeader(c.label) === normalized
    )
    if (exactMatch) {
      match = { ...match, targetColumn: exactMatch.key, confidence: 'exact' }
    }

    // Tier 2: Alias dictionary
    if (!match.targetColumn) {
      const aliasMatch = config.columns.find((c) =>
        c.aliases.some((alias) => normalizeHeader(alias) === normalized)
      )
      if (aliasMatch) {
        match = { ...match, targetColumn: aliasMatch.key, confidence: 'alias' }
      }
    }

    matches.push(match)
  }

  // Enforce: only one source per target. Duplicates → both need review.
  const targetCounts = new Map<string, number[]>()
  matches.forEach((m, idx) => {
    if (m.targetColumn) {
      const existing = targetCounts.get(m.targetColumn) || []
      existing.push(idx)
      targetCounts.set(m.targetColumn, existing)
    }
  })

  for (const [, indices] of targetCounts) {
    if (indices.length > 1) {
      for (const idx of indices) {
        matches[idx].needsReview = true
      }
    }
  }

  return matches
}

// ─── Step 4: Apply Mapping ─────────────────────────────────
// Transform raw string[][] rows into Record<string, string>[] using column matches.

export function applyMapping(
  dataRows: string[][],
  matches: ColumnMatch[]
): Record<string, string>[] {
  return dataRows.map((row) => {
    const record: Record<string, string> = {}
    for (const match of matches) {
      if (match.targetColumn && !match.needsReview) {
        const value = row[match.sourceIndex]?.trim() ?? ''
        if (value) {
          record[match.targetColumn] = value
        }
      }
    }
    return record
  })
}

// ─── Step 5: Normalization ─────────────────────────────────
// Uses normalizeRecord() for phone/name/email/address.
// Additional: trim property_address and role_tag.

export function normalizeRows(
  rows: Record<string, string>[],
  entityType: EntityType
): Record<string, string>[] {
  // Map entityType to normalizeRecord's expected types
  const normalizeType = entityType === 'contractors' ? 'contractors'
    : entityType === 'tenants' ? 'tenants'
    : 'properties'

  return rows.map((row) => {
    const normalized = normalizeRecord(normalizeType, { ...row }) as Record<string, string>

    // normalizeRecord doesn't handle these fields — trim manually
    if (normalized.property_address) {
      normalized.property_address = normalized.property_address.trim()
    }
    if (normalized.role_tag) {
      normalized.role_tag = normalized.role_tag.trim()
    }

    // Remove empty string values — RPC expects null, not ''
    for (const key of Object.keys(normalized)) {
      if (normalized[key] === '' || normalized[key] === undefined) {
        delete normalized[key]
      }
    }

    return normalized
  })
}

// ─── Step 6: Validation ────────────────────────────────────
// Validates each row against entity-specific rules.
// Returns errors (block import) and warnings (show but don't block).

export function validateRows(
  rows: Record<string, string>[],
  entityType: EntityType
): ValidatedRow[] {
  const config = ENTITY_CONFIGS[entityType]

  return rows.map((data) => {
    const errors: Record<string, string> = {}
    const warnings: Record<string, string> = {}

    // Check required fields
    for (const col of config.columns) {
      if (col.required && (!data[col.key] || data[col.key].trim() === '')) {
        errors[col.key] = `${col.label} is required`
      }
    }

    // Entity-specific validation
    if (entityType === 'properties') {
      // Address postcode warning
      if (data.address && !/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i.test(data.address)) {
        warnings.address = 'No UK postcode detected in address'
      }
    }

    if (entityType === 'tenants') {
      // At least name or phone (RPC allows either)
      if (!data.full_name && !data.phone) {
        errors.full_name = 'Name or phone is required'
      }
      // Email format
      if (data.email && !EMAIL_RE.test(data.email)) {
        warnings.email = 'Email may not be valid'
      }
    }

    if (entityType === 'contractors') {
      // Email format
      if (data.contractor_email && !EMAIL_RE.test(data.contractor_email)) {
        warnings.contractor_email = 'Email may not be valid'
      }
    }

    return { data, errors, warnings }
  })
}

// ─── Full Pipeline ─────────────────────────────────────────
// Orchestrates: parse → detect headers → match → map → normalize → validate

export function runPipeline(
  rows: string[][],
  entityType: EntityType,
  hasHeaders: boolean
): {
  matches: ColumnMatch[]
  headers: string[]
  dataRows: string[][]
  mappedRows: Record<string, string>[]
  normalizedRows: Record<string, string>[]
  validatedRows: ValidatedRow[]
} {
  const headers = hasHeaders ? rows[0].map((h) => h.trim()) : rows[0].map((_, i) => `Column ${i + 1}`)
  const dataRows = hasHeaders ? rows.slice(1) : rows

  const matches = matchColumns(headers, entityType)
  const mappedRows = applyMapping(dataRows, matches)
  const normalizedRows = normalizeRows(mappedRows, entityType)
  const validatedRows = validateRows(normalizedRows, entityType)

  return { matches, headers, dataRows, mappedRows, normalizedRows, validatedRows }
}

export { MAX_ROWS, PREVIEW_ROWS }

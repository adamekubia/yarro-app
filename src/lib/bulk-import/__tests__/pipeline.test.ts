import { describe, it, expect } from 'vitest'
import {
  parseText,
  detectHasHeaders,
  matchColumns,
  applyMapping,
  normalizeRows,
  validateRows,
} from '../pipeline'

// ─── parseText ─────────────────────────────────────────────

describe('parseText', () => {
  it('parses tab-separated data', () => {
    const input = 'Name\tPhone\tEmail\nJohn\t07123456789\tjohn@test.com'
    const { rows, error } = parseText(input)
    expect(error).toBeUndefined()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['Name', 'Phone', 'Email'])
    expect(rows[1]).toEqual(['John', '07123456789', 'john@test.com'])
  })

  it('parses comma-separated data', () => {
    const input = 'Name,Phone,Email\nJohn,07123456789,john@test.com'
    const { rows, error } = parseText(input)
    expect(error).toBeUndefined()
    expect(rows).toHaveLength(2)
  })

  it('returns error for empty input', () => {
    const { rows, error } = parseText('')
    expect(rows).toHaveLength(0)
    expect(error).toBe('No data provided')
  })

  it('returns error for too many rows', () => {
    const lines = ['header']
    for (let i = 0; i < 502; i++) lines.push(`row${i}`)
    const { error } = parseText(lines.join('\n'))
    expect(error).toContain('Maximum 500 rows')
  })

  it('handles quoted fields with commas', () => {
    const input = '"123 High St, London",HMO,Manchester'
    const { rows } = parseText(input)
    expect(rows[0][0]).toBe('123 High St, London')
  })
})

// ─── detectHasHeaders ──────────────────────────────────────

describe('detectHasHeaders', () => {
  it('detects known column names as headers', () => {
    const rows = [
      ['Address', 'City', 'Landlord Name'],
      ['123 High St', 'Manchester', 'John Smith'],
    ]
    const result = detectHasHeaders(rows, 'properties')
    expect(result.hasHeaders).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(80)
  })

  it('detects data row (emails/phones) as not headers', () => {
    const rows = [
      ['John Smith', '07123456789', 'john@test.com'],
      ['Jane Doe', '07987654321', 'jane@test.com'],
    ]
    const result = detectHasHeaders(rows, 'tenants')
    expect(result.hasHeaders).toBe(false)
    expect(result.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects aliases as headers', () => {
    const rows = [
      ['Name', 'Tel', 'Mail'],
      ['John', '07123456789', 'john@test.com'],
    ]
    const result = detectHasHeaders(rows, 'tenants')
    expect(result.hasHeaders).toBe(true)
  })
})

// ─── matchColumns ──────────────────────────────────────────

describe('matchColumns', () => {
  describe('Tier 1: exact match after normalization', () => {
    it('matches exact column names', () => {
      const matches = matchColumns(['address', 'city', 'landlord_name'], 'properties')
      expect(matches[0].targetColumn).toBe('address')
      expect(matches[0].confidence).toBe('exact')
      expect(matches[1].targetColumn).toBe('city')
      expect(matches[2].targetColumn).toBe('landlord_name')
    })

    it('matches with different casing and separators', () => {
      const matches = matchColumns(['Landlord Name', 'landlord-name', 'LANDLORD_NAME'], 'properties')
      // All should match landlord_name — but only one can since duplicate target
      expect(matches[0].targetColumn).toBe('landlord_name')
      expect(matches[1].targetColumn).toBe('landlord_name')
      expect(matches[2].targetColumn).toBe('landlord_name')
      // All three should need review (duplicate target collision)
      expect(matches[0].needsReview).toBe(true)
      expect(matches[1].needsReview).toBe(true)
      expect(matches[2].needsReview).toBe(true)
    })

    it('matches by label', () => {
      const matches = matchColumns(['Full Name', 'Property Address'], 'tenants')
      expect(matches[0].targetColumn).toBe('full_name')
      expect(matches[1].targetColumn).toBe('property_address')
    })
  })

  describe('Tier 2: alias matching', () => {
    it('resolves "name" to full_name for tenants', () => {
      const matches = matchColumns(['name', 'tel', 'mail'], 'tenants')
      expect(matches[0].targetColumn).toBe('full_name')
      expect(matches[0].confidence).toBe('alias')
      expect(matches[1].targetColumn).toBe('phone')
      expect(matches[2].targetColumn).toBe('email')
    })

    it('resolves "name" to contractor_name for contractors', () => {
      const matches = matchColumns(['name', 'phone', 'email'], 'contractors')
      expect(matches[0].targetColumn).toBe('contractor_name')
      expect(matches[0].confidence).toBe('alias')
      expect(matches[1].targetColumn).toBe('contractor_phone')
      expect(matches[2].targetColumn).toBe('contractor_email')
    })

    it('resolves trade-related aliases to categories', () => {
      const matches = matchColumns(['trade', 'skills'], 'contractors')
      // Both should match categories → duplicate collision
      expect(matches[0].targetColumn).toBe('categories')
      expect(matches[1].targetColumn).toBe('categories')
      expect(matches[0].needsReview).toBe(true)
    })
  })

  describe('alias scoping', () => {
    it('"name" does not match anything for properties', () => {
      const matches = matchColumns(['name'], 'properties')
      expect(matches[0].targetColumn).toBeNull()
      expect(matches[0].confidence).toBe('unmatched')
    })
  })

  describe('unmatched columns', () => {
    it('marks unknown headers as unmatched', () => {
      const matches = matchColumns(['foo', 'bar', 'address'], 'properties')
      expect(matches[0].targetColumn).toBeNull()
      expect(matches[0].confidence).toBe('unmatched')
      expect(matches[1].targetColumn).toBeNull()
      expect(matches[2].targetColumn).toBe('address')
    })
  })

  describe('duplicate target collision', () => {
    it('marks both columns as needing review when they match the same target', () => {
      // 'tel' and 'mobile' both alias to 'phone' for tenants
      const matches = matchColumns(['tel', 'mobile'], 'tenants')
      expect(matches[0].targetColumn).toBe('phone')
      expect(matches[1].targetColumn).toBe('phone')
      expect(matches[0].needsReview).toBe(true)
      expect(matches[1].needsReview).toBe(true)
    })
  })
})

// ─── applyMapping ──────────────────────────────────────────

describe('applyMapping', () => {
  it('maps data rows using column matches', () => {
    const matches = matchColumns(['Address', 'City'], 'properties')
    const dataRows = [['123 High St, M1 1AA', 'Manchester']]
    const result = applyMapping(dataRows, matches)
    expect(result[0]).toEqual({ address: '123 High St, M1 1AA', city: 'Manchester' })
  })

  it('skips needsReview columns', () => {
    const matches = matchColumns(['tel', 'mobile'], 'tenants')
    const dataRows = [['07123456789', '07987654321']]
    const result = applyMapping(dataRows, matches)
    // Both need review → neither gets mapped
    expect(result[0]).toEqual({})
  })

  it('skips unmatched columns', () => {
    const matches = matchColumns(['foo', 'address'], 'properties')
    const dataRows = [['bar', '123 High St']]
    const result = applyMapping(dataRows, matches)
    expect(result[0]).toEqual({ address: '123 High St' })
  })
})

// ─── normalizeRows ─────────────────────────────────────────

describe('normalizeRows', () => {
  it('normalizes phone numbers', () => {
    const rows = [{ phone: '07123456789', full_name: 'john doe' }]
    const result = normalizeRows(rows, 'tenants')
    expect(result[0].phone).toBe('447123456789')
  })

  it('normalizes names to title case', () => {
    const rows = [{ contractor_name: 'john smith', contractor_phone: '07123456789' }]
    const result = normalizeRows(rows, 'contractors')
    expect(result[0].contractor_name).toBe('John Smith')
  })

  it('normalizes emails to lowercase', () => {
    const rows = [{ email: 'JOHN@TEST.COM', full_name: 'John' }]
    const result = normalizeRows(rows, 'tenants')
    expect(result[0].email).toBe('john@test.com')
  })

  it('removes empty string values', () => {
    const rows = [{ address: '123 High St', city: '', landlord_name: '' }]
    const result = normalizeRows(rows, 'properties')
    expect(result[0].address).toBe('123 High St')
    expect(result[0].city).toBeUndefined()
    expect(result[0].landlord_name).toBeUndefined()
  })
})

// ─── validateRows ──────────────────────────────────────────

describe('validateRows', () => {
  it('flags missing required fields', () => {
    const rows = [{ city: 'Manchester' }] // missing address
    const result = validateRows(rows, 'properties')
    expect(result[0].errors.address).toBe('Address is required')
  })

  it('warns on missing postcode in address', () => {
    const rows = [{ address: '123 High Street Manchester' }]
    const result = validateRows(rows, 'properties')
    expect(result[0].warnings.address).toContain('No UK postcode')
  })

  it('passes valid address with postcode', () => {
    const rows = [{ address: '123 High Street, Manchester M1 1AA' }]
    const result = validateRows(rows, 'properties')
    expect(result[0].errors.address).toBeUndefined()
    expect(result[0].warnings.address).toBeUndefined()
  })

  it('allows tenant with name but no phone', () => {
    const rows = [{ full_name: 'John Smith' }]
    const result = validateRows(rows, 'tenants')
    // Should not have the "Name or phone is required" error
    // (but phone is still "required" per config — the RPC is more lenient)
    expect(result[0].errors.full_name).toBeUndefined()
  })

  it('flags contractor missing name', () => {
    const rows = [{ contractor_phone: '07123456789' }]
    const result = validateRows(rows, 'contractors')
    expect(result[0].errors.contractor_name).toBe('Contractor Name is required')
  })

  it('warns on invalid email format', () => {
    const rows = [{ contractor_name: 'John', contractor_phone: '07123456789', contractor_email: 'notanemail' }]
    const result = validateRows(rows, 'contractors')
    expect(result[0].warnings.contractor_email).toContain('may not be valid')
  })
})

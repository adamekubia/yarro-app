'use client'

import { EditableTable, ColumnDef } from './editable-table'
import { CsvUpload } from './csv-upload'
import { CONTRACTOR_CATEGORIES } from '@/lib/constants'
import { X } from 'lucide-react'

export interface ContractorEntry {
  contractor_name: string
  category: string
  contractor_phone: string
  contractor_email: string
  property_ids: string[]
}

interface PropertyOption {
  id: string
  address: string
}

interface StepContractorsProps {
  contractors: ContractorEntry[]
  properties: PropertyOption[]
  onChange: (contractors: ContractorEntry[]) => void
}

const CSV_COLUMNS = ['contractor_name', 'category', 'contractor_phone', 'contractor_email']

const CATEGORY_OPTIONS = CONTRACTOR_CATEGORIES.map((c) => ({
  value: c,
  label: c,
}))

export function StepContractors({ contractors, properties, onChange }: StepContractorsProps) {
  const columns: ColumnDef[] = [
    { key: 'contractor_name', label: 'Name', required: true, placeholder: 'QuickFix Plumbing Ltd' },
    { key: 'category', label: 'Category', required: true, type: 'select', options: CATEGORY_OPTIONS },
    { key: 'contractor_phone', label: 'Phone', required: true, placeholder: '07700 900500' },
    { key: 'contractor_email', label: 'Email', placeholder: 'info@quickfix-demo.co.uk' },
  ]

  const rows = contractors.map((c) => ({
    contractor_name: c.contractor_name,
    category: c.category,
    contractor_phone: c.contractor_phone,
    contractor_email: c.contractor_email,
  }))

  const handleRowsChange = (newRows: Record<string, string>[]) => {
    const updated: ContractorEntry[] = newRows.map((row, i) => ({
      contractor_name: row.contractor_name || '',
      category: row.category || '',
      contractor_phone: row.contractor_phone || '',
      contractor_email: row.contractor_email || '',
      property_ids: contractors[i]?.property_ids || [],
    }))
    onChange(updated)
  }

  const handleCsvParsed = (csvRows: Record<string, string>[]) => {
    const newContractors: ContractorEntry[] = csvRows.map((row) => {
      // Match category against known list (case-insensitive)
      let category = ''
      if (row.category) {
        const match = CATEGORY_OPTIONS.find(
          (c) => c.value.toLowerCase() === row.category.toLowerCase().trim()
        )
        if (match) category = match.value
      }

      return {
        contractor_name: row.contractor_name || '',
        category,
        contractor_phone: row.contractor_phone || '',
        contractor_email: row.contractor_email || '',
        property_ids: [],
      }
    })
    onChange([...contractors.filter((c) => c.contractor_name), ...newContractors])
  }

  const toggleProperty = (contractorIdx: number, propertyId: string) => {
    const updated = [...contractors]
    const current = updated[contractorIdx].property_ids
    if (current.includes(propertyId)) {
      updated[contractorIdx] = {
        ...updated[contractorIdx],
        property_ids: current.filter((id) => id !== propertyId),
      }
    } else {
      updated[contractorIdx] = {
        ...updated[contractorIdx],
        property_ids: [...current, propertyId],
      }
    }
    onChange(updated)
  }

  const namedContractors = contractors.filter((c) => c.contractor_name)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Contractors</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add your contractors with their category and contact info.
        </p>
      </div>

      <EditableTable columns={columns} rows={rows} onChange={handleRowsChange} highlightEmptySelections />

      <CsvUpload
        expectedColumns={CSV_COLUMNS}
        onParsed={handleCsvParsed}
        templateFilename="contractors_template.csv"
      />
      <p className="text-xs text-muted-foreground">
        <strong>Tip:</strong> Use exact category names in your CSV (e.g. &quot;Plumber&quot;, &quot;Electrician&quot;). Non-matching categories will need manual selection.
      </p>

      {/* Property Assignment */}
      {namedContractors.length > 0 && properties.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <div>
            <h3 className="text-sm font-medium">Assign Properties</h3>
            <p className="text-xs text-muted-foreground">Select which properties each contractor serves.</p>
          </div>
          {namedContractors.map((contractor, origIdx) => {
            const realIdx = contractors.indexOf(contractor)
            return (
              <div key={realIdx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">{contractor.contractor_name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {properties.map((p) => {
                    const selected = contractor.property_ids.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProperty(realIdx, p.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                          selected
                            ? 'bg-primary/10 text-primary border border-primary/30'
                            : 'bg-background border border-border text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {selected && <X className="h-3 w-3" />}
                        <span className="truncate max-w-[120px]">{p.address}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

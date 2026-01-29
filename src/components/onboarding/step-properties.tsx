'use client'

import { EditableTable, ColumnDef } from './editable-table'
import { CsvUpload } from './csv-upload'
import type { LandlordPersona } from './step-landlords'

export interface PropertyEntry {
  tempId: string
  address: string
  landlordTempId: string
  access_instructions: string
  emergency_access_contact: string
  auto_approve_limit: string
  // After insert:
  insertedId?: string
}

interface StepPropertiesProps {
  properties: PropertyEntry[]
  landlords: LandlordPersona[]
  onChange: (properties: PropertyEntry[]) => void
}

const CSV_COLUMNS = ['address', 'landlord_name', 'landlord_email', 'landlord_phone', 'access_instructions', 'emergency_access_contact', 'auto_approve_limit']

export function StepProperties({ properties, landlords, onChange }: StepPropertiesProps) {
  const landlordOptions = landlords
    .filter((l) => l.name)
    .map((l) => ({ value: l.tempId, label: l.name }))

  const columns: ColumnDef[] = [
    { key: 'address', label: 'Address', required: true, placeholder: '28 Salisbury Road, M25 0HU', width: '30%' },
    ...(landlordOptions.length > 0
      ? [{ key: 'landlordTempId', label: 'Landlord', type: 'select' as const, options: landlordOptions }]
      : []),
    { key: 'auto_approve_limit', label: 'Auto-Approve (£)', required: true, type: 'number' as const, placeholder: '0' },
    { key: 'access_instructions', label: 'Access', placeholder: 'Key in lockbox' },
    { key: 'emergency_access_contact', label: 'Emergency Contact', placeholder: 'Neighbour: 07...' },
  ]

  const rows = properties.map((p) => ({
    address: p.address,
    landlordTempId: p.landlordTempId,
    auto_approve_limit: p.auto_approve_limit,
    access_instructions: p.access_instructions,
    emergency_access_contact: p.emergency_access_contact,
  }))

  const handleRowsChange = (newRows: Record<string, string>[]) => {
    const updated: PropertyEntry[] = newRows.map((row, i) => ({
      tempId: properties[i]?.tempId || crypto.randomUUID(),
      address: row.address || '',
      landlordTempId: row.landlordTempId || '',
      auto_approve_limit: row.auto_approve_limit || '',
      access_instructions: row.access_instructions || '',
      emergency_access_contact: row.emergency_access_contact || '',
      insertedId: properties[i]?.insertedId,
    }))
    onChange(updated)
  }

  const handleCsvParsed = (csvRows: Record<string, string>[]) => {
    const newProperties: PropertyEntry[] = csvRows.map((row) => {
      // Try to match landlord by name
      let landlordTempId = ''
      if (row.landlord_name) {
        const match = landlords.find(
          (l) => l.name.toLowerCase() === row.landlord_name.toLowerCase()
        )
        if (match) landlordTempId = match.tempId
      }

      return {
        tempId: crypto.randomUUID(),
        address: row.address || '',
        landlordTempId,
        auto_approve_limit: row.auto_approve_limit || '',
        access_instructions: row.access_instructions || '',
        emergency_access_contact: row.emergency_access_contact || '',
      }
    })
    onChange([...properties.filter((p) => p.address), ...newProperties])
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Properties</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add your properties. {landlordOptions.length > 0 && 'Select a landlord from Step 1 to auto-fill their details.'}
        </p>
      </div>

      <EditableTable columns={columns} rows={rows} onChange={handleRowsChange} />

      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Address:</span> Include full UK postcode (e.g., 28 Salisbury Road, M25 0HU)
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Auto-Approve:</span> Max amount contractors can spend without landlord approval. Enter 0 if no auto-approve.
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Address and Auto-Approve are required. Access and Emergency Contact are optional.
        </p>
      </div>

      <CsvUpload
        expectedColumns={CSV_COLUMNS}
        onParsed={handleCsvParsed}
        templateFilename="properties_template.csv"
      />
    </div>
  )
}

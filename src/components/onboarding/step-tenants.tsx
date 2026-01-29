'use client'

import { EditableTable, ColumnDef } from './editable-table'
import { CsvUpload } from './csv-upload'
import { TENANT_ROLES } from '@/lib/constants'

export interface TenantEntry {
  full_name: string
  phone: string
  email: string
  role_tag: string
  propertyId: string
}

interface PropertyOption {
  id: string
  address: string
}

interface StepTenantsProps {
  tenants: TenantEntry[]
  properties: PropertyOption[]
  onChange: (tenants: TenantEntry[]) => void
}

const CSV_COLUMNS = ['full_name', 'phone', 'email', 'role_tag', 'property_address']

export function StepTenants({ tenants, properties, onChange }: StepTenantsProps) {
  const propertyOptions = properties.map((p) => ({ value: p.id, label: p.address }))
  const roleOptions = TENANT_ROLES.map((r) => ({
    value: r,
    label: r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }))

  const columns: ColumnDef[] = [
    { key: 'full_name', label: 'Name', required: true, placeholder: 'Emma Thompson' },
    { key: 'phone', label: 'Phone', required: true, placeholder: '07700 900400' },
    { key: 'email', label: 'Email', placeholder: 'emma.t@example.com' },
    { key: 'role_tag', label: 'Role', type: 'select', options: roleOptions },
    { key: 'propertyId', label: 'Property', required: true, type: 'select', options: propertyOptions },
  ]

  const rows = tenants.map((t) => ({
    full_name: t.full_name,
    phone: t.phone,
    email: t.email,
    role_tag: t.role_tag,
    propertyId: t.propertyId,
  }))

  const handleRowsChange = (newRows: Record<string, string>[]) => {
    const updated: TenantEntry[] = newRows.map((row) => ({
      full_name: row.full_name || '',
      phone: row.phone || '',
      email: row.email || '',
      role_tag: row.role_tag || 'tenant',
      propertyId: row.propertyId || '',
    }))
    onChange(updated)
  }

  const handleCsvParsed = (csvRows: Record<string, string>[]) => {
    const newTenants: TenantEntry[] = csvRows.map((row) => {
      // Try to match property by address
      let propertyId = ''
      if (row.property_address) {
        const match = properties.find(
          (p) => p.address.toLowerCase().includes(row.property_address.toLowerCase()) ||
                 row.property_address.toLowerCase().includes(p.address.toLowerCase())
        )
        if (match) propertyId = match.id
      }

      return {
        full_name: row.full_name || '',
        phone: row.phone || '',
        email: row.email || '',
        role_tag: row.role_tag || 'tenant',
        propertyId,
      }
    })
    onChange([...tenants.filter((t) => t.full_name), ...newTenants])
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Tenants</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add your tenants and link each to a property.
        </p>
      </div>

      <EditableTable columns={columns} rows={rows} onChange={handleRowsChange} />

      <CsvUpload
        expectedColumns={CSV_COLUMNS}
        onParsed={handleCsvParsed}
        templateFilename="tenants_template.csv"
      />
    </div>
  )
}

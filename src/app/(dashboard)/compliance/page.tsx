'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { PageShell } from '@/components/page-shell'
import { DataTable, Column } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { CERTIFICATE_LABELS, type CertificateType } from '@/lib/constants'
import { ShieldCheck, Plus } from 'lucide-react'
import { CommandSearchInput } from '@/components/command-search-input'
import { Button } from '@/components/ui/button'
import {
  CertificateFormDialog,
  type CertificateFormData,
} from '@/components/certificate-form-dialog'
import { toast } from 'sonner'
import Link from 'next/link'

interface ComplianceRow {
  id: string
  property_id: string
  certificate_type: CertificateType
  expiry_date: string | null
  issued_date: string | null
  issued_by: string | null
  certificate_number: string | null
  status: string
  property_address: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function CompliancePage() {
  const { propertyManager } = usePM()
  const supabase = createClient()
  const [certificates, setCertificates] = useState<ComplianceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ expired: 0, expiring: 0, valid: 0, total: 0 })
  const [search, setSearch] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const filteredCertificates = useMemo(() => {
    if (!search) return certificates
    const lower = search.toLowerCase()
    return certificates.filter(c =>
      (CERTIFICATE_LABELS[c.certificate_type] || c.certificate_type).toLowerCase().includes(lower) ||
      c.property_address?.toLowerCase().includes(lower) ||
      c.issued_by?.toLowerCase().includes(lower) ||
      c.status?.toLowerCase().includes(lower)
    )
  }, [certificates, search])

  const fetchData = useCallback(async () => {
    if (!propertyManager) return

    const [certsRes, summaryRes] = await Promise.all([
      supabase
        .from('c1_compliance_certificates')
        .select('id, property_id, certificate_type, expiry_date, issued_date, issued_by, certificate_number, document_url, status, c1_properties(address)')
        .eq('property_manager_id', propertyManager.id)
        .order('expiry_date', { ascending: true, nullsFirst: true }),
      supabase.rpc('compliance_get_summary', { p_pm_id: propertyManager.id }),
    ])

    if (certsRes.data) {
      const rows: ComplianceRow[] = certsRes.data.map((cert) => {
        let displayStatus = 'missing'
        if (cert.expiry_date) {
          const expiry = new Date(cert.expiry_date)
          const now = new Date()
          const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (expiry < now) displayStatus = 'expired'
          else if (daysUntil <= 30) displayStatus = 'expiring'
          else if (cert.status === 'verified') displayStatus = 'valid'
          else displayStatus = 'review'
        } else if (cert.document_url || cert.issued_by || cert.certificate_number) {
          displayStatus = 'review'
        }
        return {
          id: cert.id,
          property_id: cert.property_id,
          certificate_type: cert.certificate_type,
          expiry_date: cert.expiry_date,
          issued_date: cert.issued_date,
          issued_by: cert.issued_by,
          certificate_number: cert.certificate_number,
          status: displayStatus,
          property_address: (cert.c1_properties as unknown as { address: string })?.address || 'Unknown',
        }
      })
      setCertificates(rows)
    }

    const summaryData = summaryRes?.data as Record<string, number> | null
    setSummary({
      expired: summaryData?.expired ?? 0,
      expiring: summaryData?.expiring ?? 0,
      valid: summaryData?.valid ?? 0,
      total: summaryData?.total ?? 0,
    })

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyManager])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddCertificate = async (formData: CertificateFormData) => {
    if (!propertyManager || !formData.property_id) throw new Error('Missing property')
    const { error } = await supabase.rpc('compliance_upsert_certificate', {
      p_property_id: formData.property_id,
      p_pm_id: propertyManager.id,
      p_certificate_type: formData.certificate_type,
      p_issued_date: formData.issued_date,
      p_expiry_date: formData.expiry_date,
      p_certificate_number: formData.certificate_number,
      p_issued_by: formData.issued_by,
      p_notes: formData.notes,
      p_reminder_days_before: formData.reminder_days_before,
      p_contractor_id: formData.contractor_id,
    })
    if (error) throw new Error('Failed to add certificate')
    toast.success('Certificate added')
    await fetchData()
  }

  const columns: Column<ComplianceRow>[] = [
    {
      key: 'certificate_type',
      header: 'Certificate',
      sortable: true,
      render: (row) => (
        <span className="font-medium">{CERTIFICATE_LABELS[row.certificate_type] || row.certificate_type}</span>
      ),
      getValue: (row) => CERTIFICATE_LABELS[row.certificate_type] || row.certificate_type,
    },
    {
      key: 'property_address',
      header: 'Property',
      sortable: true,
      render: (row) => (
        <Link
          href={`/properties/${row.property_id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.property_address}
        </Link>
      ),
      getValue: (row) => row.property_address,
    },
    {
      key: 'expiry_date',
      header: 'Expires',
      sortable: true,
      render: (row) => (
        <span className="text-muted-foreground">{formatDate(row.expiry_date)}</span>
      ),
      getValue: (row) => row.expiry_date,
    },
    {
      key: 'issued_by',
      header: 'Issued By',
      render: (row) => (
        <span className="text-muted-foreground">{row.issued_by || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
      getValue: (row) => row.status,
    },
  ]

  return (
    <PageShell
      title="Compliance"
      count={filteredCertificates.length}
      actions={
        <div className="flex items-center gap-2">
          <CommandSearchInput
            placeholder="Search certificates..."
            value={search}
            onChange={setSearch}
            className="w-64"
          />
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      }
    >
      <DataTable
        data={filteredCertificates}
        columns={columns}
        getRowId={(row) => row.id}
        onRowClick={(row) => {
          window.location.href = `/compliance/${row.id}`
        }}
        loading={loading}
        emptyMessage={
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 opacity-40" />
            <p className="text-sm">No compliance certificates found</p>
            <p className="text-xs">Add certificates from the property detail page</p>
          </div>
        }
        fillHeight
      />

      {propertyManager && (
        <CertificateFormDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSubmit={handleAddCertificate}
          existingTypes={[]}
          pmId={propertyManager.id}
        />
      )}
    </PageShell>
  )
}

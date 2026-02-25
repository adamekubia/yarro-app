'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { usePM } from '@/contexts/pm-context'
import { useEditMode } from '@/hooks/use-edit-mode'
import { normalizeRecord, validateLandlord, hasErrors, formatPhoneDisplay, type ValidationErrors } from '@/lib/normalize'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { TicketDetailModal } from '@/components/ticket-detail/ticket-detail-modal'
import Link from 'next/link'
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Trash2,
  Loader2,
} from 'lucide-react'

// --- Types ---

interface Landlord {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  created_at: string
}

interface LandlordEditable {
  id: string
  full_name: string
  phone: string | null
  email: string | null
}

interface PropertyRow {
  id: string
  address: string
}

interface TicketRow {
  id: string
  issue_title: string | null
  issue_description: string | null
  category: string | null
  priority: string | null
  status: string
  next_action_reason: string | null
  date_logged: string
  property_id: string
}

// --- Helpers ---

const toEditable = (l: Landlord): LandlordEditable => ({
  id: l.id,
  full_name: l.full_name || '',
  phone: l.phone,
  email: l.email,
})

const displayStageMap: Record<string, string> = {
  handoff_review: 'Handoff',
  manager_approval: 'Awaiting Manager',
  no_contractors: 'No Contractors',
  landlord_declined: 'Landlord Declined',
  landlord_no_response: 'Landlord No Response',
  job_not_completed: 'Not Completed',
  awaiting_contractor: 'Awaiting Contractor',
  awaiting_landlord: 'Awaiting Landlord',
  awaiting_booking: 'Awaiting Booking',
  scheduled: 'Scheduled',
  completed: 'Completed',
  dismissed: 'Dismissed',
}

const getDisplayStage = (reason: string | null, status: string) => {
  if (status === 'closed') return 'Completed'
  if (reason && displayStageMap[reason]) return displayStageMap[reason]
  return 'Created'
}

// --- Component ---

export default function LandlordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const landlordId = params.id as string
  const { propertyManager } = usePM()
  const supabase = createClient()

  const [landlord, setLandlord] = useState<Landlord | null>(null)
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [tenantCounts, setTenantCounts] = useState<Record<string, number>>({})
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [propertyAddressMap, setPropertyAddressMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  // --- Data fetching ---

  const fetchLandlord = useCallback(async () => {
    if (!landlordId) return

    const { data, error } = await supabase
      .from('c1_landlords')
      .select('*')
      .eq('id', landlordId)
      .single()

    if (error || !data) {
      toast.error('Landlord not found')
      router.push('/landlords')
      return
    }
    setLandlord(data as Landlord)
  }, [landlordId, supabase, router])

  const fetchRelated = useCallback(async () => {
    if (!landlordId) return

    // Fetch properties for this landlord
    const { data: propertiesData } = await supabase
      .from('c1_properties')
      .select('id, address')
      .eq('landlord_id', landlordId)
      .order('address')

    const props = (propertiesData || []) as PropertyRow[]
    setProperties(props)

    // Build address map for ticket display
    const addrMap: Record<string, string> = {}
    props.forEach((p) => {
      addrMap[p.id] = p.address
    })
    setPropertyAddressMap(addrMap)

    const propertyIds = props.map((p) => p.id)

    if (propertyIds.length === 0) {
      setTenantCounts({})
      setTickets([])
      return
    }

    // Fetch tenant counts and tickets in parallel
    const [tenantsRes, ticketsRes] = await Promise.all([
      supabase
        .from('c1_tenants')
        .select('property_id')
        .in('property_id', propertyIds),
      supabase
        .from('c1_tickets')
        .select('id, issue_title, issue_description, category, priority, status, next_action_reason, date_logged, property_id')
        .in('property_id', propertyIds)
        .order('date_logged', { ascending: false })
        .limit(50),
    ])

    // Count tenants per property
    if (tenantsRes.data) {
      const counts: Record<string, number> = {}
      tenantsRes.data.forEach((t: { property_id: string }) => {
        counts[t.property_id] = (counts[t.property_id] || 0) + 1
      })
      setTenantCounts(counts)
    }

    if (ticketsRes.data) setTickets(ticketsRes.data as TicketRow[])
  }, [landlordId, supabase])

  useEffect(() => {
    if (!propertyManager || !landlordId) return
    setLoading(true)
    Promise.all([fetchLandlord(), fetchRelated()]).finally(() => setLoading(false))
  }, [propertyManager, landlordId])

  // --- Edit mode ---

  const handleSave = useCallback(async (data: LandlordEditable, auditEntry: { at: string; by: string; changes: Record<string, { from: unknown; to: unknown }> }) => {
    const errors = validateLandlord(data)
    if (hasErrors(errors)) {
      setValidationErrors(errors)
      throw new Error('Please fix the validation errors')
    }
    setValidationErrors({})

    const { data: current } = await supabase
      .from('c1_landlords')
      .select('_audit_log')
      .eq('id', data.id)
      .single()

    const existingLog = (current?._audit_log as unknown[] || [])
    const newLog = [...existingLog, auditEntry]

    const normalized = normalizeRecord('landlords', {
      full_name: data.full_name,
      phone: data.phone,
      email: data.email,
    })

    const { error } = await supabase
      .from('c1_landlords')
      .update({
        ...normalized,
        _audit_log: newLog,
      })
      .eq('id', data.id)

    if (error) throw error

    // Also update denormalized landlord fields on all linked properties
    const { error: propError } = await supabase
      .from('c1_properties')
      .update({
        landlord_name: normalized.full_name,
        landlord_phone: normalized.phone,
        landlord_email: normalized.email,
      })
      .eq('landlord_id', data.id)

    if (propError) {
      console.error('Failed to sync landlord data to properties:', propError)
    }

    toast.success('Landlord updated')
    await fetchLandlord()
  }, [supabase, fetchLandlord])

  const {
    isEditing,
    editedData,
    isSaving,
    error: editError,
    startEditing,
    cancelEditing,
    updateField,
    saveChanges,
    resetData,
  } = useEditMode<LandlordEditable>({
    initialData: landlord ? toEditable(landlord) : null,
    onSave: handleSave,
    pmId: propertyManager?.id || '',
  })

  useEffect(() => {
    if (landlord) resetData(toEditable(landlord))
  }, [landlord, resetData])

  // --- Delete ---

  const handleDelete = async () => {
    if (!landlord) return

    // Block if any properties are linked
    const { count: propertyCount } = await supabase
      .from('c1_properties')
      .select('id', { count: 'exact', head: true })
      .eq('landlord_id', landlord.id)

    if (propertyCount && propertyCount > 0) {
      throw new Error(`Cannot delete landlord with ${propertyCount} linked propert${propertyCount !== 1 ? 'ies' : 'y'}. Reassign or remove properties first.`)
    }

    const { error } = await supabase
      .from('c1_landlords')
      .delete()
      .eq('id', landlord.id)

    if (error) throw error
    toast.success('Landlord deleted')
    router.push('/landlords')
  }

  // --- Ticket counts ---

  const openTickets = tickets.filter((t) => t.status !== 'closed')
  const closedTickets = tickets.filter((t) => t.status === 'closed')

  // --- Loading / Not found ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!landlord) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Landlord not found</p>
      </div>
    )
  }

  // --- Render ---

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-10 pt-8 pb-6 border-b">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <button
              onClick={() => router.push('/landlords')}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Landlords
            </button>
            <h1 className="text-3xl font-bold tracking-tight">{landlord.full_name}</h1>
            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
              {landlord.phone && (
                <>
                  <span>{formatPhoneDisplay(landlord.phone)}</span>
                  {landlord.email && <span className="text-muted-foreground/40">·</span>}
                </>
              )}
              {landlord.email && <span>{landlord.email}</span>}
              {properties.length > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-6 flex-shrink-0">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={cancelEditing} disabled={isSaving}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {editError && (
          <div className="mt-3 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            {editError}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Details + Properties */}
        <div className="overflow-y-auto flex-shrink-0 max-h-[45%]">

          {/* Contact Details */}
          <div className="px-10 py-6 border-b">
            {isEditing && editedData ? (
              <div className="space-y-5">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Full Name</label>
                  <Input
                    value={editedData.full_name}
                    onChange={(e) => updateField('full_name', e.target.value)}
                    placeholder="John Smith"
                    className={validationErrors.full_name ? 'border-destructive' : ''}
                  />
                  {validationErrors.full_name && (
                    <p className="text-xs text-destructive mt-1">{validationErrors.full_name}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Phone</label>
                    <Input
                      value={editedData.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value || null)}
                      placeholder="07123 456789"
                      className={validationErrors.phone ? 'border-destructive' : ''}
                    />
                    {validationErrors.phone && (
                      <p className="text-xs text-destructive mt-1">{validationErrors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                    <Input
                      value={editedData.email || ''}
                      onChange={(e) => updateField('email', e.target.value || null)}
                      placeholder="john@example.com"
                      className={validationErrors.email ? 'border-destructive' : ''}
                    />
                    {validationErrors.email && (
                      <p className="text-xs text-destructive mt-1">{validationErrors.email}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-10 gap-y-5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="text-sm">{landlord.phone ? formatPhoneDisplay(landlord.phone) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm">{landlord.email || '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Properties */}
          <div className="px-10 py-5 border-b">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Properties
              {properties.length > 0 && <span className="ml-2 normal-case font-normal text-muted-foreground/60">{properties.length}</span>}
            </h2>
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties linked</p>
            ) : (
              <div>
                {properties.map((p) => (
                  <Link
                    key={p.id}
                    href={`/properties/${p.id}`}
                    className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/20 -mx-2 px-2 rounded transition-colors"
                  >
                    <span className="text-sm font-medium">{p.address}</span>
                    <span className="text-xs text-muted-foreground">
                      {tenantCounts[p.id] || 0} tenant{(tenantCounts[p.id] || 0) !== 1 ? 's' : ''}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tickets — fills remaining space */}
        <div className="flex-1 min-h-0 flex flex-col border-t">
          <div className="flex-shrink-0 px-10 pt-5 pb-3 flex items-baseline gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tickets</h2>
            {(openTickets.length > 0 || closedTickets.length > 0) && (
              <span className="text-xs text-muted-foreground/60">
                {openTickets.length > 0 && <>{openTickets.length} open</>}
                {openTickets.length > 0 && closedTickets.length > 0 && <span className="mx-1">·</span>}
                {closedTickets.length > 0 && <>{closedTickets.length} closed</>}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-10 pb-6">
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets for this landlord&apos;s properties</p>
            ) : (
              <div>
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className="w-full flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-muted/20 -mx-2 px-2 rounded text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.issue_title || t.issue_description || 'Maintenance request'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(t.date_logged).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {propertyAddressMap[t.property_id] && <> · {propertyAddressMap[t.property_id]}</>}
                        {t.category && <> · {t.category}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {t.priority && <StatusBadge status={t.priority} />}
                      <StatusBadge status={getDisplayStage(t.next_action_reason, t.status)} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
      />

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Landlord"
        description="Are you sure you want to delete this landlord? This action cannot be undone."
        itemName={landlord.full_name}
        onConfirm={handleDelete}
      />
    </div>
  )
}

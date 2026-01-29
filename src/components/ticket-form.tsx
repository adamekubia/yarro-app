'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DetailSection, DetailGrid, DetailDivider } from '@/components/detail-drawer'
import { CONTRACTOR_CATEGORIES, TICKET_PRIORITIES } from '@/lib/constants'
import { Loader2 } from 'lucide-react'

interface Property {
  id: string
  address: string
}

interface Tenant {
  id: string
  full_name: string
  property_id: string
}

interface Contractor {
  id: string
  contractor_name: string
  category: string
  property_ids: string[] | null
}

interface TicketFormData {
  property_id: string
  tenant_id: string
  issue_description: string
  category: string
  priority: string
  contractor_ids: string[]       // Array, required, ORDERED
  availability: string           // Optional
  access: string                 // Optional
}

interface TicketFormProps {
  initialData?: Partial<TicketFormData> & { contractor_id?: string | null }  // Support legacy single contractor
  onSubmit: (data: TicketFormData) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

const CATEGORY_OPTIONS = CONTRACTOR_CATEGORIES.map((c) => ({
  value: c,
  label: c,
}))

const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}))

export function TicketForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Create Ticket',
}: TicketFormProps) {
  const { propertyManager } = usePM()
  const supabase = createClient()

  // Convert legacy contractor_id to contractor_ids array if present
  const initialContractorIds = initialData?.contractor_ids ||
    (initialData?.contractor_id ? [initialData.contractor_id] : [])

  const [formData, setFormData] = useState<TicketFormData>({
    property_id: initialData?.property_id || '',
    tenant_id: initialData?.tenant_id || '',
    issue_description: initialData?.issue_description || '',
    category: initialData?.category || '',
    priority: initialData?.priority || 'MEDIUM',
    contractor_ids: initialContractorIds,
    availability: initialData?.availability || '',
    access: initialData?.access || '',
  })

  const [properties, setProperties] = useState<Property[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([])
  const [filteredContractors, setFilteredContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch properties, tenants, and contractors
  useEffect(() => {
    if (!propertyManager) return

    const fetchData = async () => {
      setLoading(true)

      // Fetch properties
      const { data: propsData } = await supabase
        .from('c1_properties')
        .select('id, address')
        .eq('property_manager_id', propertyManager.id)
        .order('address')

      if (propsData) setProperties(propsData)

      // Fetch tenants
      const { data: tenantsData } = await supabase
        .from('c1_tenants')
        .select('id, full_name, property_id')
        .eq('property_manager_id', propertyManager.id)
        .order('full_name')

      if (tenantsData) setTenants(tenantsData)

      // Fetch contractors
      const { data: contractorsData } = await supabase
        .from('c1_contractors')
        .select('id, contractor_name, category, property_ids')
        .eq('property_manager_id', propertyManager.id)
        .eq('active', true)
        .order('category')
        .order('contractor_name')

      if (contractorsData) setContractors(contractorsData)

      setLoading(false)
    }

    fetchData()
  }, [propertyManager, supabase])

  // Filter tenants by selected property
  useEffect(() => {
    if (formData.property_id) {
      setFilteredTenants(tenants.filter((t) => t.property_id === formData.property_id))
    } else {
      setFilteredTenants([])
    }
    // Reset tenant if property changes
    if (formData.tenant_id) {
      const validTenant = tenants.find(
        (t) => t.id === formData.tenant_id && t.property_id === formData.property_id
      )
      if (!validTenant) {
        setFormData((prev) => ({ ...prev, tenant_id: '' }))
      }
    }
  }, [formData.property_id, tenants, formData.tenant_id])

  // Filter contractors by category and property
  // Contractors with null property_ids can work on ANY property
  useEffect(() => {
    if (formData.category && formData.property_id) {
      setFilteredContractors(
        contractors.filter(
          (c) =>
            c.category === formData.category &&
            (c.property_ids === null || c.property_ids?.includes(formData.property_id))
        )
      )
    } else if (formData.category) {
      setFilteredContractors(contractors.filter((c) => c.category === formData.category))
    } else {
      setFilteredContractors([])
    }
    // Reset contractors if category changes and any selected contractor doesn't match
    if (formData.contractor_ids.length > 0) {
      const validIds = formData.contractor_ids.filter((id) =>
        contractors.some((c) => c.id === id && c.category === formData.category)
      )
      if (validIds.length !== formData.contractor_ids.length) {
        setFormData((prev) => ({ ...prev, contractor_ids: validIds }))
      }
    }
  }, [formData.category, formData.property_id, contractors, formData.contractor_ids])

  const updateField = useCallback((field: keyof TicketFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }, [])

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.property_id) {
      setError('Please select a property')
      return
    }
    if (!formData.tenant_id) {
      setError('Please select a tenant')
      return
    }
    if (!formData.issue_description.trim()) {
      setError('Please describe the issue')
      return
    }
    if (!formData.category) {
      setError('Please select a category')
      return
    }
    if (formData.contractor_ids.length === 0) {
      setError('Please select at least one contractor')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      <DetailSection title="Location">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Property <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.property_id}
              onValueChange={(v) => updateField('property_id', v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select property..." />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Tenant <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.tenant_id}
              onValueChange={(v) => updateField('tenant_id', v)}
              disabled={!formData.property_id}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={formData.property_id ? 'Select tenant...' : 'Select property first'} />
              </SelectTrigger>
              <SelectContent>
                {filteredTenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.property_id && filteredTenants.length === 0 && (
              <p className="text-xs text-muted-foreground">No tenants at this property</p>
            )}
          </div>
        </div>
      </DetailSection>

      <DetailDivider />

      <DetailSection title="Issue Details">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Description <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={formData.issue_description}
              onChange={(e) => updateField('issue_description', e.target.value)}
              placeholder="Describe the maintenance issue..."
              rows={4}
              className="text-sm"
            />
          </div>

          <DetailGrid columns={2}>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Category <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.category}
                onValueChange={(v) => updateField('category', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Priority <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.priority}
                onValueChange={(v) => updateField('priority', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DetailGrid>
        </div>
      </DetailSection>

      <DetailDivider />

      <DetailSection title="Contractor Assignment">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Contractors <span className="text-destructive">*</span>
            </label>
            {!formData.category ? (
              <p className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                Select a category first to see available contractors
              </p>
            ) : filteredContractors.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 bg-amber-50 rounded border border-amber-200">
                No {formData.category} contractors available for this property.
                Add contractors in the Contractors page first.
              </p>
            ) : (
              <>
                {/* Available contractors to select */}
                <div className="border rounded-lg divide-y">
                  {filteredContractors.map((c) => {
                    const isSelected = formData.contractor_ids.includes(c.id)
                    const orderIndex = formData.contractor_ids.indexOf(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            // Remove from list
                            setFormData((prev) => ({
                              ...prev,
                              contractor_ids: prev.contractor_ids.filter((id) => id !== c.id),
                            }))
                          } else {
                            // Add to end of list
                            setFormData((prev) => ({
                              ...prev,
                              contractor_ids: [...prev.contractor_ids, c.id],
                            }))
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2.5 text-left hover:bg-muted/50 transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                              {orderIndex + 1}
                            </span>
                          )}
                          <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                            {c.contractor_name}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-xs text-muted-foreground">Click to remove</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Selected order display */}
                {formData.contractor_ids.length > 0 && (
                  <div className="p-2.5 bg-muted/50 rounded-lg space-y-1">
                    <p className="text-xs font-medium">Contact Order:</p>
                    <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                      {formData.contractor_ids.map((id, i) => {
                        const contractor = contractors.find((c) => c.id === id)
                        return (
                          <li key={id}>
                            {contractor?.contractor_name}
                            {i === 0 && <span className="text-primary ml-1">(contacted first)</span>}
                          </li>
                        )
                      })}
                    </ol>
                    {formData.contractor_ids.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-muted">
                        Next contractor contacted after 6 hours if no response
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DetailSection>

      <DetailDivider />

      <DetailSection title="Additional Details (Optional)">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Tenant Availability
            </label>
            <Input
              value={formData.availability}
              onChange={(e) => updateField('availability', e.target.value)}
              placeholder="e.g., Weekdays after 5pm, Saturdays all day"
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              When can the tenant be present for the work?
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Access Instructions
            </label>
            <Input
              value={formData.access}
              onChange={(e) => updateField('access', e.target.value)}
              placeholder="e.g., Key under mat, call tenant on arrival"
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              How should the contractor access the property?
            </p>
          </div>
        </div>
      </DetailSection>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </div>
  )
}

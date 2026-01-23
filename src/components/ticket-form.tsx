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
  contractor_id: string | null
}

interface TicketFormProps {
  initialData?: Partial<TicketFormData>
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

  const [formData, setFormData] = useState<TicketFormData>({
    property_id: initialData?.property_id || '',
    tenant_id: initialData?.tenant_id || '',
    issue_description: initialData?.issue_description || '',
    category: initialData?.category || '',
    priority: initialData?.priority || 'MEDIUM',
    contractor_id: initialData?.contractor_id || null,
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
  useEffect(() => {
    if (formData.category && formData.property_id) {
      setFilteredContractors(
        contractors.filter(
          (c) =>
            c.category === formData.category &&
            c.property_ids?.includes(formData.property_id)
        )
      )
    } else if (formData.category) {
      setFilteredContractors(contractors.filter((c) => c.category === formData.category))
    } else {
      setFilteredContractors([])
    }
    // Reset contractor if category changes and current contractor doesn't match
    if (formData.contractor_id) {
      const validContractor = contractors.find(
        (c) =>
          c.id === formData.contractor_id &&
          c.category === formData.category
      )
      if (!validContractor) {
        setFormData((prev) => ({ ...prev, contractor_id: null }))
      }
    }
  }, [formData.category, formData.property_id, contractors, formData.contractor_id])

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

      <DetailSection title="Assignment (Optional)">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Contractor</label>
          <Select
            value={formData.contractor_id || ''}
            onValueChange={(v) => updateField('contractor_id', v || null)}
            disabled={!formData.category}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={formData.category ? 'Select contractor (optional)...' : 'Select category first'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">-- None --</SelectItem>
              {filteredContractors.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.contractor_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.category && filteredContractors.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No {formData.category} contractors available for this property
            </p>
          )}
          {formData.contractor_id && (
            <p className="text-xs text-muted-foreground">
              Contractor will be notified automatically
            </p>
          )}
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

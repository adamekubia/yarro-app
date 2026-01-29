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
import { CONTRACTOR_CATEGORIES, TICKET_PRIORITIES } from '@/lib/constants'
import { Loader2, CheckCircle2 } from 'lucide-react'

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

      const [propsRes, tenantsRes, contractorsRes] = await Promise.all([
        supabase
          .from('c1_properties')
          .select('id, address')
          .eq('property_manager_id', propertyManager.id)
          .order('address'),
        supabase
          .from('c1_tenants')
          .select('id, full_name, property_id')
          .eq('property_manager_id', propertyManager.id)
          .order('full_name'),
        supabase
          .from('c1_contractors')
          .select('id, contractor_name, category, property_ids')
          .eq('property_manager_id', propertyManager.id)
          .eq('active', true)
          .order('category')
          .order('contractor_name'),
      ])

      if (propsRes.data) setProperties(propsRes.data)
      if (tenantsRes.data) setTenants(tenantsRes.data)
      if (contractorsRes.data) setContractors(contractorsRes.data)

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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Two column grid for main fields */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Property <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.property_id}
              onValueChange={(v) => updateField('property_id', v)}
            >
              <SelectTrigger>
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
            <label className="text-sm font-medium">
              Tenant <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.tenant_id}
              onValueChange={(v) => updateField('tenant_id', v)}
              disabled={!formData.property_id}
            >
              <SelectTrigger>
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
              <p className="text-xs text-amber-600">No tenants at this property</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Category <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.category}
                onValueChange={(v) => updateField('category', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category..." />
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
              <label className="text-sm font-medium">
                Priority <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.priority}
                onValueChange={(v) => updateField('priority', v)}
              >
                <SelectTrigger>
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
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Issue Description <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={formData.issue_description}
              onChange={(e) => updateField('issue_description', e.target.value)}
              placeholder="Describe the maintenance issue..."
              rows={4}
            />
          </div>
        </div>

        {/* Right column - Contractors */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Contractors <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Click to select. First contractor contacted immediately, others after 6h if no response.
            </p>
          </div>

          {!formData.category ? (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Select a category first
              </p>
            </div>
          ) : filteredContractors.length === 0 ? (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
              <p className="text-sm text-amber-700">
                No {formData.category} contractors for this property
              </p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {filteredContractors.map((c) => {
                const isSelected = formData.contractor_ids.includes(c.id)
                const orderIndex = formData.contractor_ids.indexOf(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setFormData((prev) => ({
                          ...prev,
                          contractor_ids: prev.contractor_ids.filter((id) => id !== c.id),
                        }))
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          contractor_ids: [...prev.contractor_ids, c.id],
                        }))
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isSelected ? (
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {orderIndex + 1}
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                        {c.contractor_name}
                      </span>
                    </div>
                    {isSelected && orderIndex === 0 && (
                      <span className="text-xs text-primary font-medium">First</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Selected summary */}
          {formData.contractor_ids.length > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-800">
                    {formData.contractor_ids.length} contractor{formData.contractor_ids.length > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {contractors.find((c) => c.id === formData.contractor_ids[0])?.contractor_name} will be contacted first
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Additional details */}
          <div className="pt-2 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Additional Details (Optional)
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant Availability</label>
              <Input
                value={formData.availability}
                onChange={(e) => updateField('availability', e.target.value)}
                placeholder="e.g., Weekdays after 5pm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Access Instructions</label>
              <Input
                value={formData.access}
                onChange={(e) => updateField('access', e.target.value)}
                placeholder="e.g., Key under mat"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-4 border-t">
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

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_LABELS,
  CERT_TYPE_CONTRACTOR_CATEGORIES,
  type CertificateType,
} from '@/lib/constants'
import { partitionContractors, contractorMatchesCertType } from '@/lib/contractor-utils'

interface Contractor {
  id: string
  contractor_name: string
  categories: string[] | null
}

interface Property {
  id: string
  address: string
}

interface CertificateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CertificateFormData) => Promise<void>
  /** Certificate types already on this property (for duplicate detection) */
  existingTypes: CertificateType[]
  /** PM ID for fetching contractors */
  pmId: string
  /** Pre-fill form for editing an existing certificate */
  initialData?: Partial<CertificateFormData>
  /** When provided, property is fixed (editing from property page). When omitted, show property picker. */
  propertyId?: string
}

export interface CertificateFormData {
  certificate_type: CertificateType
  issued_date: string | null
  expiry_date: string
  certificate_number: string | null
  issued_by: string | null
  notes: string | null
  reminder_days_before: number
  contractor_id: string | null
  property_id?: string
}

export function CertificateFormDialog({
  open,
  onOpenChange,
  onSubmit,
  existingTypes,
  pmId,
  initialData,
  propertyId,
}: CertificateFormDialogProps) {
  const isEditing = !!initialData?.certificate_type
  const needsPropertyPicker = !propertyId && !isEditing
  const supabase = createClient()
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [certificateType, setCertificateType] = useState<CertificateType | ''>('')
  const [issuedDate, setIssuedDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [certificateNumber, setCertificateNumber] = useState('')
  const [issuedBy, setIssuedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [reminderDays, setReminderDays] = useState('60')
  const [contractorId, setContractorId] = useState('')
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [matchingContractors, setMatchingContractors] = useState<Contractor[]>([])
  const [otherContractors, setOtherContractors] = useState<Contractor[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReplace, setShowReplace] = useState(false)
  const [showMismatchWarning, setShowMismatchWarning] = useState(false)
  const [pendingContractorId, setPendingContractorId] = useState('')

  // Fetch properties when property picker is needed
  useEffect(() => {
    if (!needsPropertyPicker || !open || !pmId) return
    async function fetchProperties() {
      const { data } = await supabase
        .from('c1_properties')
        .select('id, address')
        .eq('property_manager_id', pmId)
        .order('address')
      if (data) setProperties(data)
    }
    fetchProperties()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, needsPropertyPicker, pmId])

  // Fetch contractors when cert type changes
  useEffect(() => {
    if (!certificateType || !pmId) {
      setContractors([])
      setMatchingContractors([])
      setOtherContractors([])
      setContractorId('')
      return
    }

    const relevantCategories = CERT_TYPE_CONTRACTOR_CATEGORIES[certificateType as CertificateType]
    if (!relevantCategories) {
      setContractors([])
      setMatchingContractors([])
      setOtherContractors([])
      setContractorId('')
      return
    }

    async function fetchContractors() {
      const { data } = await supabase
        .from('c1_contractors')
        .select('id, contractor_name, categories')
        .eq('property_manager_id', pmId)
        .eq('active', true)
        .order('contractor_name')

      if (!data) return

      const [matching, other] = partitionContractors(data, certificateType as CertificateType)
      setMatchingContractors(matching)
      setOtherContractors(other)
      setContractors([...matching, ...other])
    }

    fetchContractors()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable
  }, [certificateType, pmId])

  // Pre-fill form when initialData changes (edit mode)
  useEffect(() => {
    if (open && initialData) {
      setCertificateType(initialData.certificate_type || '')
      setIssuedDate(initialData.issued_date || '')
      setExpiryDate(initialData.expiry_date || '')
      setCertificateNumber(initialData.certificate_number || '')
      setIssuedBy(initialData.issued_by || '')
      setNotes(initialData.notes || '')
      setReminderDays(String(initialData.reminder_days_before ?? 60))
      setContractorId(initialData.contractor_id || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const resetForm = () => {
    setCertificateType('')
    setIssuedDate('')
    setExpiryDate('')
    setCertificateNumber('')
    setIssuedBy('')
    setNotes('')
    setReminderDays('60')
    setContractorId('')
    setContractors([])
    setSelectedPropertyId('')
    setError(null)
    setShowReplace(false)
    setShowMismatchWarning(false)
    setPendingContractorId('')
    setMatchingContractors([])
    setOtherContractors([])
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const validate = (): string | null => {
    if (needsPropertyPicker && !selectedPropertyId) return 'Property is required'
    if (!certificateType) return 'Certificate type is required'
    if (!expiryDate) return 'Expiry date is required'
    if (issuedDate && expiryDate && new Date(expiryDate) <= new Date(issuedDate)) {
      return 'Expiry date must be after issued date'
    }
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    // Check for duplicate — show confirmation before replacing (skip in edit mode)
    if (!isEditing && existingTypes.includes(certificateType as CertificateType) && !showReplace) {
      setShowReplace(true)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        certificate_type: certificateType as CertificateType,
        issued_date: issuedDate || null,
        expiry_date: expiryDate,
        certificate_number: certificateNumber || null,
        issued_by: issuedBy || null,
        notes: notes || null,
        reminder_days_before: Number(reminderDays),
        contractor_id: contractorId || null,
        property_id: propertyId || selectedPropertyId || undefined,
      })
      handleOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save certificate')
    } finally {
      setSaving(false)
    }
  }

  const duplicateLabel = certificateType
    ? CERTIFICATE_LABELS[certificateType as CertificateType]
    : ''

  const showContractorDropdown = certificateType
    ? CERT_TYPE_CONTRACTOR_CATEGORIES[certificateType as CertificateType] !== null
    : false

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Certificate' : 'Add Certificate'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          {showReplace && (
            <div className="bg-warning/10 border border-warning/30 px-3 py-2 rounded-md">
              <p className="text-sm font-medium">Replace existing certificate?</p>
              <p className="text-xs text-muted-foreground mt-1">
                This property already has a {duplicateLabel} certificate. Adding this one will replace it.
              </p>
            </div>
          )}

          {needsPropertyPicker && (
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Property *</p>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger className={!selectedPropertyId && error ? 'border-destructive' : ''}>
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
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Certificate Type *</p>
            <Select
              value={certificateType}
              onValueChange={(v) => {
                setCertificateType(v as CertificateType)
                setShowReplace(false)
                setContractorId('')
                setShowMismatchWarning(false)
                setPendingContractorId('')
              }}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select certificate type..." />
              </SelectTrigger>
              <SelectContent>
                {CERTIFICATE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CERTIFICATE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Issued Date</p>
              <Input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Expiry Date *</p>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={!expiryDate && error ? 'border-destructive' : ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Certificate Number</p>
              <Input
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="e.g. GS-2026-001"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Issued By</p>
              <Input
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="e.g. British Gas"
              />
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="text-sm"
            />
          </div>

          {/* ─── Automation Section ─── */}
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Automation
            </p>

            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Remind me before expiry</p>
              <Select value={reminderDays} onValueChange={setReminderDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showContractorDropdown && (
              <div>
                <p className="text-sm text-muted-foreground mb-1.5">
                  Auto-dispatch contractor for renewal
                </p>
                <Select
                  value={contractorId || 'none'}
                  onValueChange={(v) => {
                    const selectedId = v === 'none' ? '' : v
                    if (!selectedId) {
                      setContractorId('')
                      setShowMismatchWarning(false)
                      setPendingContractorId('')
                      return
                    }
                    const selected = contractors.find(c => c.id === selectedId)
                    if (selected && !contractorMatchesCertType(selected, certificateType as CertificateType)) {
                      setPendingContractorId(selectedId)
                      setShowMismatchWarning(true)
                    } else {
                      setContractorId(selectedId)
                      setShowMismatchWarning(false)
                      setPendingContractorId('')
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (notify me only)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (notify me only)</SelectItem>
                    {matchingContractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.contractor_name}</SelectItem>
                    ))}
                    {matchingContractors.length > 0 && otherContractors.length > 0 && (
                      <>
                        <SelectSeparator />
                        <p className="px-2 py-1 text-xs text-muted-foreground">Other contractors</p>
                      </>
                    )}
                    {otherContractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.contractor_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {showMismatchWarning && (
                  <div className="mt-2 bg-warning/10 border border-warning/30 px-3 py-2 rounded-md">
                    <p className="text-sm font-medium">Contractor may not be qualified</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This contractor doesn&apos;t have the right qualifications for {certificateType ? CERTIFICATE_LABELS[certificateType as CertificateType] : 'this certificate'}.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowMismatchWarning(false); setPendingContractorId('') }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setContractorId(pendingContractorId)
                          setShowMismatchWarning(false)
                          setPendingContractorId('')
                        }}
                      >
                        Continue anyway
                      </Button>
                    </div>
                  </div>
                )}

                {!showMismatchWarning && contractors.length > 0 && matchingContractors.length === 0 && (
                  <p className="mt-1.5 text-xs text-warning">
                    No contractors with matching qualifications.{' '}
                    <a href="/contractors" className="underline font-medium hover:text-foreground transition-colors">
                      Add a contractor
                    </a>
                  </p>
                )}

                {!showMismatchWarning && contractors.length === 0 && certificateType && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    No contractors added yet.{' '}
                    <a href="/contractors" className="underline font-medium hover:text-foreground transition-colors">
                      Add a contractor
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : showReplace ? 'Replace Certificate' : 'Add Certificate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

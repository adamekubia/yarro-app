'use client'

import { useState } from 'react'
import { Check, Circle, Wrench, Search, CalendarCheck, CheckCircle2, Loader2, Phone, CalendarClock, AlertTriangle, Upload, X } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MiniCalendar } from './mini-calendar'
import type { ContractorPortalData } from '@/lib/portal-types'

// ─── Formatting ─────────────────────────────────────────────────────────

function fmtDatetime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' \u00b7 '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtShortDatetime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    + ' \u00b7 '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/^\+/, '')
  if (digits.startsWith('44') && digits.length === 12) {
    return `+44 ${digits.slice(2, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  return '+' + digits.replace(/(\d{2})(\d{4})(\d+)/, '$1 $2 $3')
}

// ─── Stage Logic ────────────────────────────────────────────────────────

const STAGES = ['assigned', 'booked', 'completed'] as const
type StageKey = typeof STAGES[number]

const STAGE_CONFIG: Record<StageKey, { label: string; icon: React.ReactNode }> = {
  assigned:  { label: 'Assigned',  icon: <Search className="size-4" /> },
  booked:    { label: 'Booked',    icon: <CalendarCheck className="size-4" /> },
  completed: { label: 'Completed', icon: <CheckCircle2 className="size-4" /> },
}

function getActiveStageIdx(data: ContractorPortalData): number {
  const stage = (data.job_stage || '').toLowerCase()
  if (stage === 'completed' || data.resolved_at) return 2
  if (stage === 'booked' || data.scheduled_date) return 1
  return 0
}

// ─── Time Slots ─────────────────────────────────────────────────────────

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning', range: '09:00\u201312:00', hour: 9 },
  { value: 'afternoon', label: 'Afternoon', range: '12:00\u201317:00', hour: 13 },
  { value: 'evening', label: 'Evening', range: '17:00\u201320:00', hour: 18 },
] as const

function getAvailableSlots(dateStr: string, leadHours: number): Set<number> {
  const now = new Date()
  const available = new Set<number>()
  for (const slot of TIME_SLOTS) {
    const slotStart = new Date(`${dateStr}T${String(slot.hour).padStart(2, '0')}:00:00`)
    if ((slotStart.getTime() - now.getTime()) / (1000 * 60 * 60) >= leadHours) available.add(slot.hour)
  }
  return available
}

function getMinBookableDate(leadHours: number): Date {
  const candidate = new Date()
  candidate.setHours(0, 0, 0, 0)
  for (let i = 0; i < 14; i++) {
    const dateStr = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`
    if (getAvailableSlots(dateStr, leadHours).size > 0) return candidate
    candidate.setDate(candidate.getDate() + 1)
  }
  return new Date()
}

// ─── Props ──────────────────────────────────────────────────────────────

export type ContractorPortalV2Props = {
  data: ContractorPortalData
  onSchedule: (date: string, slot: string, notes: string | null) => Promise<void>
  onCompletion: (resolved: boolean, notes: string | null, photos: File[]) => Promise<void>
}

// ─── Main Component ─────────────────────────────────────────────────────

export function ContractorPortalV2({ data, onSchedule, onCompletion }: ContractorPortalV2Props) {
  const activeIdx = getActiveStageIdx(data)

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-[640px] px-5 py-8 flex flex-col gap-5">
        <OverviewCard data={data} activeIdx={activeIdx} />
        <ContentCard data={data} onSchedule={onSchedule} onCompletion={onCompletion} />
        <p className="text-center text-xs text-muted-foreground/40">Powered by Yarro</p>
      </div>
    </div>
  )
}

// ─── Overview Card ──────────────────────────────────────────────────────

function OverviewCard({ data, activeIdx }: { data: ContractorPortalData; activeIdx: number }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground mb-4">
        T-{data.ticket_ref}
      </span>

      <h1 className="text-xl font-semibold text-foreground leading-snug">{data.property_address}</h1>
      <p className="mt-1.5 text-base font-medium text-muted-foreground">{data.issue_title}</p>
      <p className="mt-1 text-xs text-muted-foreground">From {data.agency_name} &middot; {fmtDatetime(data.date_logged)}</p>

      {data.contractor_quote && (
        <div className="mt-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
          Your quote of &pound;{Number(data.contractor_quote).toFixed(2)} has been approved.
        </div>
      )}

      <div className="border-t border-border my-5" />

      {/* Horizontal tracker */}
      <div className="flex items-start">
        {STAGES.map((stageKey, i) => {
          const config = STAGE_CONFIG[stageKey]
          const isDone = i < activeIdx
          const isActive = i === activeIdx
          const isLast = i === STAGES.length - 1

          return (
            <div key={stageKey} className="contents">
              <div className="flex flex-col items-center shrink-0" style={{ width: 72 }}>
                <div className={`flex items-center justify-center size-7 rounded-full transition-colors ${
                  isActive ? 'bg-primary text-white ring-4 ring-primary/20' :
                  isDone ? 'bg-green-500 text-white' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <Check className="size-3.5" strokeWidth={3} /> : isActive ? <Circle className="size-2 fill-white text-white" /> : config.icon}
                </div>
                <span className={`mt-2 text-[10px] font-medium text-center leading-tight ${
                  isActive ? 'text-primary' : isDone ? 'text-green-600' : 'text-muted-foreground'
                }`}>{config.label}</span>
              </div>
              {!isLast && <div className={`h-0.5 flex-1 mt-3.5 ${i < activeIdx ? 'bg-green-400' : 'bg-border'}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Content Card ───────────────────────────────────────────────────────

const tabTriggerClass = 'flex-1 rounded-none h-auto text-[13px] py-3 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none text-muted-foreground hover:text-foreground'

function ContentCard({ data, onSchedule, onCompletion }: { data: ContractorPortalData; onSchedule: (date: string, slot: string, notes: string | null) => Promise<void>; onCompletion: (resolved: boolean, notes: string | null, photos: File[]) => Promise<void> }) {
  const stage = getActiveStageIdx(data)
  const defaultTab = stage === 0 ? 'action' : 'details'

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <Tabs defaultValue={defaultTab} className="gap-0">
        <TabsList className="bg-transparent rounded-none border-b border-border p-0 h-auto w-full">
          <TabsTrigger value="action" className={tabTriggerClass}>{stage === 0 ? 'Schedule' : stage === 1 ? 'Complete' : 'Status'}</TabsTrigger>
          <TabsTrigger value="details" className={tabTriggerClass}>Details</TabsTrigger>
          <TabsTrigger value="contact" className={tabTriggerClass}>Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="action" className="p-5">
          <ActionTab data={data} onSchedule={onSchedule} onCompletion={onCompletion} />
        </TabsContent>
        <TabsContent value="details" className="p-5">
          <DetailsTab data={data} />
        </TabsContent>
        <TabsContent value="contact" className="p-5">
          <ContactTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Action Tab ─────────────────────────────────────────────────────────

function ActionTab({ data, onSchedule, onCompletion }: { data: ContractorPortalData; onSchedule: (date: string, slot: string, notes: string | null) => Promise<void>; onCompletion: (resolved: boolean, notes: string | null, photos: File[]) => Promise<void> }) {
  const stageIdx = getActiveStageIdx(data)

  if (stageIdx === 2) {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 px-3 py-3 text-sm text-green-700 flex items-center gap-2">
        <CheckCircle2 className="size-4 shrink-0" />
        This job has been completed. Thank you.
      </div>
    )
  }

  if (stageIdx === 1) return <CompletionForm data={data} onCompletion={onCompletion} />
  return <ScheduleForm data={data} onSchedule={onSchedule} />
}

function ScheduleForm({ data, onSchedule }: { data: ContractorPortalData; onSchedule: (date: string, slot: string, notes: string | null) => Promise<void> }) {
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleSlot, setScheduleSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const leadHours = data.min_booking_lead_hours ?? 24
  const availableSlots = scheduleDate ? getAvailableSlots(scheduleDate, leadHours) : null

  async function handleSubmit() {
    if (!scheduleDate || !scheduleSlot) return
    setSubmitting(true)
    await onSchedule(scheduleDate, scheduleSlot, notes || null)
    setSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Book a slot</SectionLabel>
      <div>
        <label className="text-sm font-medium text-foreground">Select a date</label>
        <MiniCalendar
          selected={scheduleDate}
          onSelect={(d) => { setScheduleDate(d); setScheduleSlot('') }}
          minDate={getMinBookableDate(leadHours)}
          isDateDisabled={(dateStr) => getAvailableSlots(dateStr, leadHours).size === 0}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Time slot</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {TIME_SLOTS.map((slot) => {
            const disabled = availableSlots != null && !availableSlots.has(slot.hour)
            return (
              <button key={slot.value} type="button" disabled={disabled} onClick={() => setScheduleSlot(slot.value)}
                className={`rounded-lg border-2 px-3 py-2.5 text-center transition-colors ${
                  scheduleSlot === slot.value ? 'border-primary bg-primary/5 text-primary' :
                  disabled ? 'border-border/50 bg-muted text-muted-foreground/50 cursor-not-allowed' :
                  'border-border bg-card text-muted-foreground hover:border-foreground/30'
                }`}>
                <span className="block text-sm font-medium">{slot.label}</span>
                <span className="block text-[10px] text-muted-foreground mt-0.5">{slot.range}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea className="mt-1.5 w-full rounded-md border border-input bg-background px-2.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none" rows={2} placeholder="e.g. Will need access to loft..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button onClick={handleSubmit} disabled={submitting || !scheduleDate || !scheduleSlot} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {submitting ? <Loader2 className="size-4 animate-spin mx-auto" /> : 'Confirm Booking'}
      </button>
    </div>
  )
}

function CompletionForm({ data, onCompletion }: { data: ContractorPortalData; onCompletion: (resolved: boolean, notes: string | null, photos: File[]) => Promise<void> }) {
  const [status, setStatus] = useState<'complete' | 'not-complete' | null>(null)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!status) return
    setSubmitting(true)
    if (status === 'not-complete') await onCompletion(false, reason || null, [])
    else await onCompletion(true, notes || null, photos)
    setSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Has this job been completed?</SectionLabel>

      {data.scheduled_date && (
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary flex items-center gap-2">
          <CalendarClock className="size-3.5 shrink-0" />
          Scheduled: {fmtDatetime(data.scheduled_date)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setStatus('complete')} className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${status === 'complete' ? 'border-green-500 bg-green-50 text-green-700' : 'border-border bg-card text-foreground hover:border-foreground/30'}`}>
          <CheckCircle2 className={`size-5 mx-auto mb-1.5 ${status === 'complete' ? 'text-green-500' : 'text-muted-foreground'}`} />
          Job Complete
        </button>
        <button type="button" onClick={() => setStatus('not-complete')} className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${status === 'not-complete' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-border bg-card text-foreground hover:border-foreground/30'}`}>
          <AlertTriangle className={`size-5 mx-auto mb-1.5 ${status === 'not-complete' ? 'text-orange-500' : 'text-muted-foreground'}`} />
          Not Complete
        </button>
      </div>

      {status === 'complete' && (
        <>
          <div>
            <label className="text-sm font-medium text-foreground">Photos <span className="font-normal text-muted-foreground">(optional, max 5)</span></label>
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); setPhotos(prev => [...prev, ...files.filter(f => f.size <= 10 * 1024 * 1024)].slice(0, 5)) }} className="mt-1.5 rounded-lg border-2 border-dashed border-border bg-muted hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
              <label className="flex flex-col items-center justify-center py-6 cursor-pointer">
                <Upload className="size-6 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground font-medium">Drop photos or tap to upload</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && setPhotos(prev => [...prev, ...Array.from(e.target.files!).filter(f => f.size <= 10 * 1024 * 1024)].slice(0, 5))} />
              </label>
            </div>
            {photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((file, i) => (
                  <div key={i} className="relative group">
                    <div className="size-16 rounded-lg overflow-hidden border border-border bg-muted"><img src={URL.createObjectURL(file)} alt="" className="size-full object-cover" /></div>
                    <button type="button" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="size-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea className="mt-1.5 w-full rounded-md border border-input bg-background px-2.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none" rows={3} placeholder="Brief description of work completed..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </>
      )}

      {status === 'not-complete' && (
        <div>
          <label className="text-sm font-medium text-foreground">Reason <span className="font-normal text-muted-foreground">(required)</span></label>
          <textarea className="mt-1.5 w-full rounded-md border border-input bg-background px-2.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none" rows={3} placeholder="Why couldn't the job be completed?" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}

      {status && (
        <button onClick={handleSubmit} disabled={submitting || (status === 'not-complete' && !reason.trim())} className={`w-full rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${status === 'complete' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
          {submitting ? <Loader2 className="size-4 animate-spin mx-auto" /> : status === 'complete' ? 'Submit Completion' : 'Report Issue'}
        </button>
      )}
    </div>
  )
}

// ─── Details Tab ────────────────────────────────────────────────────────

function DetailsTab({ data }: { data: ContractorPortalData }) {
  return (
    <>
      <SectionLabel>Issue</SectionLabel>
      <p className="text-sm text-foreground leading-relaxed mt-2">{data.issue_description}</p>

      <div className="border-t border-border my-4" />

      <SectionLabel>Job info</SectionLabel>
      <div className="mt-2">
        {data.category && <InfoRow label="Category" value={data.category} />}
        <InfoRow label="Priority" value={<span className={data.priority === 'urgent' ? 'text-destructive' : ''}>{data.priority.charAt(0).toUpperCase() + data.priority.slice(1)}</span>} />
        <InfoRow label="Reported" value={fmtDate(data.date_logged)} />
        {data.scheduled_date && <InfoRow label="Booked" value={fmtDatetime(data.scheduled_date)} />}
        {data.availability && <InfoRow label="Tenant availability" value={data.availability} last />}
      </div>

      {/* Activity */}
      <div className="border-t border-border my-4" />
      <SectionLabel>Activity</SectionLabel>
      <div className="mt-2">
        {[...data.activity].reverse().map((entry, i) => (
          <div key={i} className={`flex gap-2.5 py-2.5 ${i < data.activity.length - 1 ? 'border-b border-border/40' : ''}`}>
            <div className={`size-2 rounded-full shrink-0 mt-[7px] ${i === 0 ? 'bg-primary' : 'bg-border'}`} />
            <div className="min-w-0">
              <p className="text-[13px] text-foreground leading-relaxed">{entry.message}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">{fmtShortDatetime(entry.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Contact Tab ────────────────────────────────────────────────────────

function ContactTab({ data }: { data: ContractorPortalData }) {
  return (
    <>
      <SectionLabel>Agency</SectionLabel>
      <div className="mt-2">
        <InfoRow label="Agency" value={data.agency_name} />
        {data.agency_phone && <InfoRow label="Phone" value={<a href={`tel:${data.agency_phone}`} className="text-primary hover:underline">{data.agency_phone}</a>} />}
        {data.agency_email && <InfoRow label="Email" value={<a href={`mailto:${data.agency_email}`} className="text-primary hover:underline text-xs">{data.agency_email}</a>} last />}
      </div>

      <div className="border-t border-border my-4" />

      <SectionLabel>Tenant</SectionLabel>
      <div className="mt-2">
        <InfoRow label="Name" value={data.tenant_name || <span className="text-muted-foreground font-normal">Not provided</span>} />
        <InfoRow label="Contact" value={data.tenant_phone ? <a href={`tel:${data.tenant_phone}`} className="text-primary hover:underline inline-flex items-center gap-1"><Phone className="size-3" />{formatPhone(data.tenant_phone)}</a> : <span className="text-muted-foreground font-normal">Not provided</span>} last />
      </div>
    </>
  )
}

// ─── Shared ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
}

function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex justify-between items-start gap-4 py-2.5 ${last ? '' : 'border-b border-border/40'}`}>
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-foreground text-right">{value}</span>
    </div>
  )
}

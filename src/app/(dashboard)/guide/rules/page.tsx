'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Clock,
  Users,
  Bell,
  SlidersHorizontal,
  ShieldCheck,
  Wrench,
  Home,
  Save,
  RotateCcw,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Option constants ───

const TIMEOUT_OPTIONS = [
  { value: '1', label: '1 min (testing)' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
  { value: '360', label: '6 hours' },
  { value: '720', label: '12 hours' },
  { value: '1440', label: '24 hours' },
]

const ALL_REMINDER_OPTIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: '4 hours' },
  { value: '360', label: '6 hours' },
  { value: '480', label: '8 hours' },
  { value: '720', label: '12 hours' },
]

const LANDLORD_FOLLOWUP_OPTIONS = [
  { value: '6', label: '6 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '36', label: '36 hours' },
  { value: '48', label: '48 hours' },
]

const ALL_LANDLORD_TIMEOUT_OPTIONS = [
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
  { value: '72', label: '3 days' },
  { value: '96', label: '4 days' },
  { value: '120', label: '5 days' },
]

// ─── Draft settings shape ───

interface DraftSettings {
  dispatch_mode: 'sequential' | 'broadcast'
  contractor_timeout_minutes: string
  contractor_reminder_enabled: boolean
  contractor_reminder_minutes: string
  landlord_followup_hours: string
  landlord_timeout_hours: string
}

const DEFAULTS: DraftSettings = {
  dispatch_mode: 'sequential',
  contractor_timeout_minutes: '360',
  contractor_reminder_enabled: false,
  contractor_reminder_minutes: '120',
  landlord_followup_hours: '24',
  landlord_timeout_hours: '48',
}

type Section = 'contractor' | 'landlord'

const SECTIONS: { key: Section; label: string; icon: typeof Wrench; desc: string }[] = [
  { key: 'contractor', label: 'Contractor Dispatch', icon: Wrench, desc: 'Timeouts, reminders & dispatch mode' },
  { key: 'landlord', label: 'Landlord Approval', icon: Home, desc: 'Follow-ups & escalation timing' },
]

export default function RulesPage() {
  const { propertyManager, refreshPM } = usePM()
  const [activeSection, setActiveSection] = useState<Section>('contractor')
  const [saving, setSaving] = useState(false)

  // Draft = what user is editing. Saved = last known DB state.
  const [draft, setDraft] = useState<DraftSettings>(DEFAULTS)
  const [saved, setSaved] = useState<DraftSettings>(DEFAULTS)

  const supabase = createClient()

  // Load PM settings into draft + saved baseline
  useEffect(() => {
    if (!propertyManager) return
    const fromPM: DraftSettings = {
      dispatch_mode: (propertyManager.dispatch_mode as 'sequential' | 'broadcast') || 'sequential',
      contractor_timeout_minutes: (propertyManager.contractor_timeout_minutes || 360).toString(),
      contractor_reminder_enabled: !!propertyManager.contractor_reminder_minutes,
      contractor_reminder_minutes: (propertyManager.contractor_reminder_minutes || 120).toString(),
      landlord_followup_hours: (propertyManager.landlord_followup_hours || 24).toString(),
      landlord_timeout_hours: (propertyManager.landlord_timeout_hours || 48).toString(),
    }
    setDraft(fromPM)
    setSaved(fromPM)
  }, [propertyManager])

  // Dirty detection
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  // Filtered options
  const availableReminderOptions = useMemo(() => {
    const maxReminder = parseInt(draft.contractor_timeout_minutes) / 2
    return ALL_REMINDER_OPTIONS.filter(o => parseInt(o.value) <= maxReminder)
  }, [draft.contractor_timeout_minutes])

  const canEnableReminder = availableReminderOptions.length > 0

  const availableLandlordTimeoutOptions = useMemo(() => {
    const minTimeout = parseInt(draft.landlord_followup_hours)
    return ALL_LANDLORD_TIMEOUT_OPTIONS.filter(o => parseInt(o.value) > minTimeout)
  }, [draft.landlord_followup_hours])

  // ─── Draft updaters (local only, no DB writes) ───

  const updateDraft = useCallback((partial: Partial<DraftSettings>) => {
    setDraft(prev => ({ ...prev, ...partial }))
  }, [])

  const handleTimeoutChange = (value: string) => {
    const newMax = parseInt(value) / 2
    const updates: Partial<DraftSettings> = { contractor_timeout_minutes: value }

    // Auto-fix reminder if it exceeds new max
    if (draft.contractor_reminder_enabled && parseInt(draft.contractor_reminder_minutes) > newMax) {
      const validOptions = ALL_REMINDER_OPTIONS.filter(o => parseInt(o.value) <= newMax)
      if (validOptions.length > 0) {
        updates.contractor_reminder_minutes = validOptions[validOptions.length - 1].value
      } else {
        updates.contractor_reminder_enabled = false
      }
    }
    updateDraft(updates)
  }

  const handleReminderToggle = (checked: boolean) => {
    if (checked) {
      const mid = Math.floor(availableReminderOptions.length / 2)
      const defaultVal = availableReminderOptions[mid]?.value || draft.contractor_reminder_minutes
      updateDraft({ contractor_reminder_enabled: true, contractor_reminder_minutes: defaultVal })
    } else {
      updateDraft({ contractor_reminder_enabled: false })
    }
  }

  const handleLandlordFollowupChange = (value: string) => {
    const updates: Partial<DraftSettings> = { landlord_followup_hours: value }
    // Auto-bump timeout if it's now <= followup
    if (parseInt(draft.landlord_timeout_hours) <= parseInt(value)) {
      const validOptions = ALL_LANDLORD_TIMEOUT_OPTIONS.filter(o => parseInt(o.value) > parseInt(value))
      if (validOptions.length > 0) {
        updates.landlord_timeout_hours = validOptions[0].value
      }
    }
    updateDraft(updates)
  }

  // ─── Save all ───

  const handleSave = async () => {
    if (!propertyManager) return
    setSaving(true)

    const payload: Record<string, unknown> = {
      dispatch_mode: draft.dispatch_mode,
      contractor_timeout_minutes: parseInt(draft.contractor_timeout_minutes),
      contractor_reminder_minutes: draft.contractor_reminder_enabled
        ? parseInt(draft.contractor_reminder_minutes)
        : null,
      landlord_followup_hours: parseInt(draft.landlord_followup_hours),
      landlord_timeout_hours: parseInt(draft.landlord_timeout_hours),
    }

    const { error } = await supabase
      .from('c1_property_managers')
      .update(payload)
      .eq('id', propertyManager.id)

    if (error) {
      toast.error('Failed to save settings')
    } else {
      toast.success('Settings saved')
      setSaved({ ...draft })
      refreshPM?.()
    }
    setSaving(false)
  }

  const handleDiscard = () => {
    setDraft({ ...saved })
  }

  // ─── Per-field changed indicator ───
  const isChanged = (key: keyof DraftSettings) => draft[key] !== saved[key]

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Rules & Preferences
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure how Yarro handles your tickets and communications
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button variant="ghost" size="sm" onClick={handleDiscard} className="text-muted-foreground">
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Discard
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            size="sm"
            className={cn(
              'min-w-[100px] transition-all',
              isDirty ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : isDirty ? (
              <span className="flex items-center gap-1.5">
                <Save className="h-4 w-4" />
                Save changes
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Body: sidebar + detail */}
      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/30 p-3 flex-shrink-0">
          <div className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                  activeSection === section.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <section.icon className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{section.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{section.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'contractor' && (
            <ContractorSection
              draft={draft}
              updateDraft={updateDraft}
              handleTimeoutChange={handleTimeoutChange}
              handleReminderToggle={handleReminderToggle}
              availableReminderOptions={availableReminderOptions}
              canEnableReminder={canEnableReminder}
              isChanged={isChanged}
            />
          )}
          {activeSection === 'landlord' && (
            <LandlordSection
              draft={draft}
              updateDraft={updateDraft}
              handleLandlordFollowupChange={handleLandlordFollowupChange}
              availableLandlordTimeoutOptions={availableLandlordTimeoutOptions}
              isChanged={isChanged}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Contractor Section ───

function ContractorSection({
  draft,
  updateDraft,
  handleTimeoutChange,
  handleReminderToggle,
  availableReminderOptions,
  canEnableReminder,
  isChanged,
}: {
  draft: DraftSettings
  updateDraft: (p: Partial<DraftSettings>) => void
  handleTimeoutChange: (v: string) => void
  handleReminderToggle: (checked: boolean) => void
  availableReminderOptions: { value: string; label: string }[]
  canEnableReminder: boolean
  isChanged: (key: keyof DraftSettings) => boolean
}) {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Contractor Dispatch
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control how contractors are contacted and what happens when they don&apos;t respond.
        </p>
      </div>

      {/* Dispatch Mode */}
      <SettingRow
        icon={Users}
        label="Dispatch Mode"
        description="How contractors are contacted when a job is dispatched."
        changed={isChanged('dispatch_mode')}
      >
        <div className="grid grid-cols-2 gap-3">
          {(['sequential', 'broadcast'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateDraft({ dispatch_mode: mode })}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-colors',
                draft.dispatch_mode === mode
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <span className="text-sm font-medium">
                {mode === 'sequential' ? 'One at a time' : 'All at once'}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {mode === 'sequential'
                  ? 'Contact sequentially. Auto-advance on timeout.'
                  : 'Send to all. Choose the best quote.'}
              </span>
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Response Timeout */}
      <SettingRow
        icon={Clock}
        label="Response Timeout"
        description={
          draft.dispatch_mode === 'sequential'
            ? 'Auto-advance to next contractor after this period.'
            : 'Flag for review if no responses within this period.'
        }
        changed={isChanged('contractor_timeout_minutes')}
      >
        <Select value={draft.contractor_timeout_minutes} onValueChange={handleTimeoutChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEOUT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Reminder */}
      {canEnableReminder && (
        <SettingRow
          icon={Bell}
          label="Reminder Before Timeout"
          description="Nudge contractors who haven't responded yet."
          changed={isChanged('contractor_reminder_enabled') || isChanged('contractor_reminder_minutes')}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={draft.contractor_reminder_enabled} onCheckedChange={handleReminderToggle} />
              <span className="text-sm text-muted-foreground">
                {draft.contractor_reminder_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {draft.contractor_reminder_enabled && (
              <div className="space-y-2">
                <Select
                  value={draft.contractor_reminder_minutes}
                  onValueChange={(v) => updateDraft({ contractor_reminder_minutes: v })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReminderOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Reminder at{' '}
                  {availableReminderOptions.find(o => o.value === draft.contractor_reminder_minutes)?.label || draft.contractor_reminder_minutes + ' min'}
                  , then{' '}
                  {draft.dispatch_mode === 'sequential' ? 'auto-advance' : 'flagged'} at{' '}
                  {TIMEOUT_OPTIONS.find(o => o.value === draft.contractor_timeout_minutes)?.label || draft.contractor_timeout_minutes + ' min'}.
                </p>
              </div>
            )}
          </div>
        </SettingRow>
      )}
    </div>
  )
}

// ─── Landlord Section ───

function LandlordSection({
  draft,
  updateDraft,
  handleLandlordFollowupChange,
  availableLandlordTimeoutOptions,
  isChanged,
}: {
  draft: DraftSettings
  updateDraft: (p: Partial<DraftSettings>) => void
  handleLandlordFollowupChange: (v: string) => void
  availableLandlordTimeoutOptions: { value: string; label: string }[]
  isChanged: (key: keyof DraftSettings) => boolean
}) {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Home className="h-5 w-5" />
          Landlord Approval
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control follow-up timing when a landlord hasn&apos;t responded to an approval request.
        </p>
      </div>

      {/* Follow-up Reminder */}
      <SettingRow
        icon={Bell}
        label="Follow-up Reminder"
        description="Send the landlord a reminder if they haven't responded."
        changed={isChanged('landlord_followup_hours')}
      >
        <Select value={draft.landlord_followup_hours} onValueChange={handleLandlordFollowupChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANDLORD_FOLLOWUP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Escalation Timeout */}
      <SettingRow
        icon={ShieldCheck}
        label="Escalate to You"
        description="If the landlord still hasn't responded after the reminder, you'll be alerted to follow up directly."
        changed={isChanged('landlord_timeout_hours')}
      >
        <div className="space-y-2">
          <Select
            value={draft.landlord_timeout_hours}
            onValueChange={(v) => updateDraft({ landlord_timeout_hours: v })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableLandlordTimeoutOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Landlord reminded at{' '}
            {LANDLORD_FOLLOWUP_OPTIONS.find(o => o.value === draft.landlord_followup_hours)?.label || draft.landlord_followup_hours + 'h'}
            , then escalated to you at{' '}
            {availableLandlordTimeoutOptions.find(o => o.value === draft.landlord_timeout_hours)?.label || draft.landlord_timeout_hours + 'h'}
            . Ticket marked &quot;Landlord No Response&quot;.
          </p>
        </div>
      </SettingRow>
    </div>
  )
}

// ─── Reusable setting row ───

function SettingRow({
  icon: Icon,
  label,
  description,
  changed,
  children,
}: {
  icon: typeof Clock
  label: string
  description: string
  changed: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 transition-colors',
      changed ? 'border-primary/40 bg-primary/[0.02]' : 'border-border bg-card'
    )}>
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{label}</h3>
              {changed && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
                  Changed
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

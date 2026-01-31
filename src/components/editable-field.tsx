'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type BaseFieldProps = {
  label: string
  isEditing: boolean
  className?: string
}

type TextFieldProps = BaseFieldProps & {
  type: 'text' | 'email' | 'phone' | 'number'
  value: string | number | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

type TextareaFieldProps = BaseFieldProps & {
  type: 'textarea'
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
}

type SelectFieldProps = BaseFieldProps & {
  type: 'select'
  value: string | null | undefined
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
}

type BooleanFieldProps = BaseFieldProps & {
  type: 'boolean'
  value: boolean | null | undefined
  onChange: (value: boolean) => void
  trueLabel?: string
  falseLabel?: string
}

type EditableFieldProps =
  | TextFieldProps
  | TextareaFieldProps
  | SelectFieldProps
  | BooleanFieldProps

export function EditableField(props: EditableFieldProps) {
  const { label, isEditing, className } = props

  // Read-only display
  if (!isEditing) {
    let displayValue: React.ReactNode = '-'

    if (props.type === 'boolean') {
      displayValue = props.value
        ? (props.trueLabel || 'Yes')
        : (props.falseLabel || 'No')
    } else if (props.type === 'select') {
      const option = props.options.find((o) => o.value === props.value)
      displayValue = option?.label || props.value || '-'
    } else {
      displayValue = props.value?.toString() || '-'
    }

    return (
      <div className={cn('space-y-1', className)}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{displayValue}</p>
      </div>
    )
  }

  // Edit mode
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-xs text-muted-foreground">
        {label}
        {('required' in props && props.required) && (
          <span className="text-destructive ml-0.5">*</span>
        )}
      </label>

      {props.type === 'textarea' ? (
        <Textarea
          value={props.value || ''}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows || 3}
          className="text-sm"
        />
      ) : props.type === 'select' ? (
        <Select
          value={props.value || ''}
          onValueChange={props.onChange}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={props.placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {props.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : props.type === 'boolean' ? (
        <Select
          value={props.value ? 'true' : 'false'}
          onValueChange={(v) => props.onChange(v === 'true')}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{props.trueLabel || 'Yes'}</SelectItem>
            <SelectItem value="false">{props.falseLabel || 'No'}</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={props.type === 'phone' ? 'tel' : props.type}
          value={props.value?.toString() || ''}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="h-9 text-sm"
        />
      )}
    </div>
  )
}

// Compact version for grid layouts
type CompactFieldProps = {
  label: string
  value: string | number | null | undefined
  isEditing: boolean
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'phone' | 'number'
  placeholder?: string
  className?: string
}

export function CompactEditableField({
  label,
  value,
  isEditing,
  onChange,
  type = 'text',
  placeholder,
  className,
}: CompactFieldProps) {
  if (!isEditing) {
    return (
      <div className={cn('p-2 bg-muted/50 rounded-lg', className)}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || '-'}</p>
      </div>
    )
  }

  return (
    <div className={cn('p-2 bg-muted/30 rounded-lg border border-primary/20', className)}>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <Input
        type={type === 'phone' ? 'tel' : type}
        value={value?.toString() || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-sm border-0 bg-background p-1"
      />
    </div>
  )
}

// Currency field with £ prefix
type CurrencyFieldProps = {
  label: string
  value: number | null | undefined
  isEditing: boolean
  onChange: (value: number | null) => void
  className?: string
}

export function CurrencyField({
  label,
  value,
  isEditing,
  onChange,
  className,
}: CurrencyFieldProps) {
  if (!isEditing) {
    return (
      <div className={cn('p-2 bg-muted/50 rounded-lg', className)}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium font-mono">
          {value != null ? `£${value.toFixed(2)}` : '-'}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('p-2 bg-muted/30 rounded-lg border border-primary/20', className)}>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
        <Input
          type="number"
          step="0.01"
          value={value ?? ''}
          onChange={(e) => {
            const val = e.target.value
            onChange(val ? parseFloat(val) : null)
          }}
          className="h-7 text-sm border-0 bg-background pl-5"
        />
      </div>
    </div>
  )
}

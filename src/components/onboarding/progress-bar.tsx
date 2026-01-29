'use client'

import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'pm_details', label: 'Your Details' },
  { key: 'landlords', label: 'Landlords' },
  { key: 'properties', label: 'Properties' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'contractors', label: 'Contractors' },
] as const

interface ProgressBarProps {
  currentStep: string
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)
  const isComplete = currentStep === 'complete'

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                isComplete || i < currentIndex
                  ? 'bg-primary/20 text-primary'
                  : i === currentIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isComplete || i < currentIndex ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className="text-xs text-muted-foreground mt-1 hidden sm:block">{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'w-8 sm:w-16 h-0.5 mx-1',
                isComplete || i < currentIndex ? 'bg-primary/40' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

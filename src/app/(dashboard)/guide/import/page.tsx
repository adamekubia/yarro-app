'use client'

import { OnboardingWizard } from '@/components/onboarding-wizard'
import { Upload } from 'lucide-react'

export default function ImportPage() {
  return (
    <div className="h-full bg-gradient-to-br from-blue-50/50 via-background to-cyan-50/30 dark:from-background dark:via-background dark:to-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Import properties, landlords, tenants, and contractors from spreadsheets
          </p>
        </div>

        {/* Content - full width */}
        <div>
          <OnboardingWizard />
        </div>
      </div>
    </div>
  )
}

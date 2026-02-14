'use client'

import { OnboardingWizard } from '@/components/onboarding-wizard'
import { Upload } from 'lucide-react'

export default function ImportPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Data
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Onboard your properties, tenants, and contractors step by step
        </p>
      </div>

      <OnboardingWizard />
    </div>
  )
}

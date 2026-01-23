'use client'

import { OnboardingWizard } from '@/components/onboarding-wizard'

export default function ImportPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Import Data</h1>
        <p className="text-muted-foreground mt-1">
          Onboard your properties, tenants, and contractors step by step
        </p>
      </div>

      <OnboardingWizard />
    </div>
  )
}

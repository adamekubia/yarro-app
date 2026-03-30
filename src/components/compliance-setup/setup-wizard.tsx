'use client'

import { useState, useMemo } from 'react'
import { WelcomeStep } from './welcome-step'
import { CertStep } from './cert-step'
import { CompleteStep } from './complete-step'
import type { CertificateType } from '@/lib/constants'

interface ComplianceRow {
  cert_id: string | null
  property_id: string
  property_address: string
  certificate_type: CertificateType
  display_status: string
}

interface SetupWizardProps {
  certificates: ComplianceRow[]
  pmId: string
  onComplete: () => void
}

interface WizardStep {
  propertyId: string
  propertyAddress: string
  certType: CertificateType
}

type Phase = 'welcome' | 'steps' | 'complete'

export function ComplianceSetupWizard({ certificates, pmId, onComplete }: SetupWizardProps) {
  const [phase, setPhase] = useState<Phase>('welcome')
  const [currentStep, setCurrentStep] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  // Build flat list of steps from compliance data
  const steps = useMemo<WizardStep[]>(() => {
    // Group by property, maintain order
    const seen = new Map<string, { address: string; certs: CertificateType[] }>()
    for (const cert of certificates) {
      if (!seen.has(cert.property_id)) {
        seen.set(cert.property_id, { address: cert.property_address, certs: [] })
      }
      seen.get(cert.property_id)!.certs.push(cert.certificate_type)
    }
    const result: WizardStep[] = []
    for (const [propertyId, { address, certs }] of seen) {
      for (const ct of certs) {
        result.push({ propertyId, propertyAddress: address, certType: ct })
      }
    }
    return result
  }, [certificates])

  // Property info for welcome step
  const propertyInfo = useMemo(() => {
    const map = new Map<string, { address: string; type: string; count: number }>()
    for (const cert of certificates) {
      if (!map.has(cert.property_id)) {
        map.set(cert.property_id, { address: cert.property_address, type: 'hmo', count: 0 })
      }
      map.get(cert.property_id)!.count++
    }
    return Array.from(map.values()).map((p) => ({
      address: p.address,
      property_type: p.count > 5 ? 'hmo' : 'single_let',
      certCount: p.count,
    }))
  }, [certificates])

  if (phase === 'welcome') {
    return (
      <WelcomeStep
        properties={propertyInfo}
        onStart={() => setPhase('steps')}
      />
    )
  }

  if (phase === 'complete') {
    return (
      <CompleteStep
        savedCount={savedCount}
        skippedCount={skippedCount}
        onFinish={onComplete}
      />
    )
  }

  const step = steps[currentStep]
  if (!step) {
    setPhase('complete')
    return null
  }

  const advance = () => {
    if (currentStep >= steps.length - 1) {
      setPhase('complete')
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  return (
    <CertStep
      key={`${step.propertyId}-${step.certType}`}
      propertyAddress={step.propertyAddress}
      propertyId={step.propertyId}
      pmId={pmId}
      certType={step.certType}
      stepNumber={currentStep + 1}
      totalSteps={steps.length}
      onNext={() => {
        setSavedCount((prev) => prev + 1)
        advance()
      }}
      onSkip={() => {
        setSkippedCount((prev) => prev + 1)
        advance()
      }}
      onBack={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
      isFirst={currentStep === 0}
    />
  )
}

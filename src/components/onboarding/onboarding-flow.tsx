'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePM } from '@/contexts/pm-context'
import { AccountCard } from './account-card'
import { PropertyCard } from './property-card'
import { SuccessCard } from './success-card'

type OnboardingStep = 'account' | 'property' | 'complete'

export function OnboardingFlow() {
  const { propertyManager, authUser } = usePM()
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>('account')
  const [dismissing, setDismissing] = useState(false)

  // If PM exists, skip account step
  useEffect(() => {
    if (propertyManager && step === 'account') {
      setStep('property')
    }
  }, [propertyManager, step])

  const handleDismiss = () => {
    setDismissing(true)
    setTimeout(() => {
      router.push('/')
    }, 600)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${
        dismissing
          ? 'bg-black/0 backdrop-blur-0'
          : 'bg-black/40 backdrop-blur-sm'
      }`}
    >
      <div
        className={`w-full max-w-lg px-4 transition-all duration-500 ${
          dismissing
            ? 'opacity-0 scale-95 translate-y-4'
            : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        {step === 'account' && authUser && (
          <AccountCard
            authUser={authUser}
            onComplete={() => setStep('property')}
          />
        )}

        {step === 'property' && propertyManager && (
          <PropertyCard
            pmId={propertyManager.id}
            onComplete={() => setStep('complete')}
          />
        )}

        {step === 'complete' && (
          <SuccessCard onDismiss={handleDismiss} />
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePM } from '@/contexts/pm-context'
import { AccountCard } from './account-card'
import { SuccessCard } from './success-card'
import { DemoWalkthrough } from './demo-walkthrough'
import { Button } from '@/components/ui/button'
import { Rocket } from 'lucide-react'

type OnboardingStep = 'account' | 'welcome' | 'demo' | 'ready' | 'done'

function getDemoSeenKey(pmId: string) {
  return `yarro_demo_seen_${pmId}`
}

export function OnboardingFlow() {
  const { propertyManager, authUser, refreshPM } = usePM()
  const router = useRouter()

  const [step, setStep] = useState<OnboardingStep>(() => {
    if (typeof window === 'undefined') return 'account'
    if (propertyManager) {
      if (localStorage.getItem(getDemoSeenKey(propertyManager.id))) return 'done'
      return 'welcome'
    }
    return 'account'
  })

  useEffect(() => {
    if (!propertyManager || step !== 'account') return
    if (localStorage.getItem(getDemoSeenKey(propertyManager.id))) {
      setStep('done')
    } else {
      setStep('welcome')
    }
  }, [propertyManager, step])

  useEffect(() => {
    if (step === 'done') {
      router.replace('/')
    }
  }, [step, router])

  const handleAccountComplete = async () => {
    try {
      await refreshPM()
    } catch (err) {
      console.error('[onboarding] refreshPM failed:', err)
    }
    setStep('welcome')
  }

  const handleDemoComplete = () => {
    setStep('ready')
  }

  const handleReady = () => {
    if (propertyManager) {
      localStorage.setItem(getDemoSeenKey(propertyManager.id), 'true')
    }
    setStep('done')
  }

  if (step === 'done') return null

  if (step === 'demo' && propertyManager) {
    return <DemoWalkthrough onComplete={handleDemoComplete} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg px-4">
        {step === 'account' && authUser && (
          <AccountCard authUser={authUser} onComplete={handleAccountComplete} />
        )}

        {step === 'welcome' && (
          <SuccessCard
            onDismiss={() => setStep('demo')}
            heading={`Welcome ${propertyManager?.name?.split(' ')[0] || ''}, your account is live!`}
            subtext="Let's see what Yarro can do."
            buttonLabel="Show me"
          />
        )}

        {step === 'ready' && (
          <div className="bg-card rounded-2xl border border-border p-10 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              You&apos;re ready to go.
            </h2>
            <p className="text-sm text-muted-foreground mt-3 mb-8 max-w-xs mx-auto">
              Let&apos;s add your first property and get you set up.
            </p>
            <Button onClick={handleReady} size="lg" className="w-full">
              Add your first property →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

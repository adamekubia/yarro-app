'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePM } from '@/contexts/pm-context'
import { AccountCard } from './account-card'
import { SuccessCard } from './success-card'
import { DemoWalkthrough } from './demo-walkthrough'
import { DEMO_ISSUES, type DemoIssue } from './demo-issues'
import { typography } from '@/lib/typography'

type OnboardingStep = 'account' | 'welcome' | 'demo' | 'done'

function getDemoSeenKey(pmId: string) {
  return `yarro_demo_seen_${pmId}`
}

export function OnboardingFlow() {
  const { propertyManager, authUser, refreshPM } = usePM()
  const router = useRouter()
  const supabase = createClient()
  const [selectedIssue, setSelectedIssue] = useState<DemoIssue | null>(null)

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

  const handleIssuePick = async (issue: DemoIssue) => {
    setSelectedIssue(issue)

    // Seed demo with the chosen issue
    try {
      const { data: pm } = await supabase
        .from('c1_property_managers')
        .select('id')
        .eq('user_id', authUser!.id)
        .single()

      if (pm) {
        const { error } = await supabase.rpc('onboarding_seed_demo', {
          p_pm_id: pm.id,
          p_issue_title: issue.title,
          p_issue_description: issue.description,
          p_category: issue.category,
          p_priority: issue.priority,
        })
        if (error) console.error('[onboarding] Seed error:', error)
      }
    } catch (err) {
      console.error('[onboarding] Seed failed:', err)
    }

    setStep('demo')
  }

  const handleDemoComplete = () => {
    if (propertyManager) {
      localStorage.setItem(getDemoSeenKey(propertyManager.id), 'true')
    }
    setStep('done')
  }

  if (step === 'done') return null

  if (step === 'demo' && propertyManager && selectedIssue) {
    return <DemoWalkthrough onComplete={handleDemoComplete} issue={selectedIssue} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg px-4">
        {step === 'account' && authUser && (
          <AccountCard authUser={authUser} onComplete={handleAccountComplete} />
        )}

        {step === 'welcome' && (
          <WelcomeIssuePicker
            name={propertyManager?.name?.split(' ')[0] || ''}
            onPick={handleIssuePick}
          />
        )}
      </div>
    </div>
  )
}

function WelcomeIssuePicker({ name, onPick }: { name: string; onPick: (issue: DemoIssue) => void }) {
  // Fire confetti on mount
  useEffect(() => {
    async function fireConfetti() {
      const confetti = (await import('canvas-confetti')).default
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      setTimeout(() => confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.65 } }), 200)
      setTimeout(() => confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.65 } }), 400)
    }
    fireConfetti()
  }, [])

  return (
    <div className="bg-card rounded-2xl border border-border p-10 shadow-2xl">
      <h2 className={`${typography.pageTitle} text-center`}>
        Welcome, {name}!
      </h2>
      <p className={`${typography.bodyText} text-center mt-2 mb-8`}>
        Pick a maintenance issue to follow through the demo.
      </p>
      <div className="space-y-3">
        {DEMO_ISSUES.map((issue) => (
          <button
            key={issue.title}
            onClick={() => onPick(issue)}
            className="w-full text-left px-5 py-4 rounded-xl border border-border/60 hover:border-primary/30 transition-all bg-transparent"
          >
            <p className="text-base font-medium text-foreground">{issue.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{issue.category} · {issue.priority}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

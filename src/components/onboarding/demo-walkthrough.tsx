'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Wrench,
  MapPin,
  Camera,
  ClipboardCheck,
  Play,
} from 'lucide-react'

interface DemoPage {
  icon: React.ElementType
  title: string
  subtitle: string
  videoUrl?: string
}

const DEMO_PAGES: DemoPage[] = [
  {
    icon: MessageSquare,
    title: 'Tenant reports an issue',
    subtitle: '24/7 intake, triage and emergency handling via WhatsApp or email.',
  },
  {
    icon: Wrench,
    title: 'Contractors get assigned',
    subtitle: 'The right contractor is dispatched automatically. No chasing quotes.',
  },
  {
    icon: MapPin,
    title: 'Access gets coordinated',
    subtitle: 'No ghosting, no wasted trips. Everyone knows where to be and when.',
  },
  {
    icon: Camera,
    title: 'Photo-verified completion',
    subtitle: 'Contractors submit proof of work before any job is marked as done.',
  },
  {
    icon: ClipboardCheck,
    title: 'Audit trail for every job',
    subtitle: 'Every message, photo, and decision is timestamped and logged. Automatically.',
  },
]

export function DemoWalkthrough({ onComplete }: { onComplete: () => void }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [dismissing, setDismissing] = useState(false)

  const page = DEMO_PAGES[currentPage]
  const isLast = currentPage === DEMO_PAGES.length - 1
  const handleContinue = () => {
    if (isLast) {
      setDismissing(true)
      setTimeout(() => onComplete(), 600)
    } else {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${
        dismissing ? 'bg-black/0 backdrop-blur-0' : 'bg-black/40 backdrop-blur-sm'
      }`}
    >
      <div
        className={`w-full max-w-4xl px-4 transition-all duration-500 ${
          dismissing ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
          {/* Split screen */}
          <div className="flex flex-col md:flex-row md:items-stretch">
            {/* Left: video — flush to card edge */}
            <div className="flex-1 min-w-0 flex">
              <div className="flex-1 bg-muted/50 flex flex-col items-center justify-center gap-3 min-h-[500px] md:rounded-l-2xl overflow-hidden">
                {page.videoUrl ? (
                  <video
                    key={page.videoUrl}
                    src={page.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="w-6 h-6 text-primary ml-0.5" />
                    </div>
                    <p className="text-xs text-muted-foreground">Demo video coming soon</p>
                  </>
                )}
              </div>
            </div>

            {/* Right: copy */}
            <div className="flex-1 min-w-0 flex flex-col justify-center px-14 py-14">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <page.icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground leading-tight mb-5">
                {page.title}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-12">
                {page.subtitle}
              </p>
              <Button
                onClick={handleContinue}
                size="lg"
                className="w-full"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { ShieldCheck, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PropertyInfo {
  address: string
  property_type: string
  certCount: number
}

interface WelcomeStepProps {
  properties: PropertyInfo[]
  onStart: () => void
}

export function WelcomeStep({ properties, onStart }: WelcomeStepProps) {
  const totalCerts = properties.reduce((sum, p) => sum + p.certCount, 0)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto px-6">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <ShieldCheck className="h-8 w-8 text-primary" />
      </div>

      <h1 className="text-2xl font-bold text-center mb-2">Set up your compliance</h1>
      <p className="text-muted-foreground text-center mb-8">
        We&apos;ll walk you through each property and its required certificates.
        Upload what you have, skip what you don&apos;t — you can always add them later.
      </p>

      <div className="w-full bg-card border border-border rounded-xl p-4 mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {properties.length} {properties.length === 1 ? 'property' : 'properties'} &middot; {totalCerts} certificates
        </p>
        <div className="space-y-2">
          {properties.map((p) => (
            <div key={p.address} className="flex items-center gap-3 py-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm flex-1 truncate">{p.address}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {p.certCount} certs &middot; {p.property_type === 'single_let' ? 'Single Let' : 'HMO'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Button size="lg" onClick={onStart} className="px-8">
        Start Setup
      </Button>
    </div>
  )
}

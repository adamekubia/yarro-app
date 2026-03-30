'use client'

import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CompleteStepProps {
  savedCount: number
  skippedCount: number
  onFinish: () => void
}

export function CompleteStep({ savedCount, skippedCount, onFinish }: CompleteStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto px-6">
      <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-6">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>

      <h1 className="text-2xl font-bold text-center mb-2">Setup complete</h1>
      <p className="text-muted-foreground text-center mb-6">
        Your compliance is configured. You can upload remaining certificates at any time from the certificates page.
      </p>

      <div className="flex items-center gap-6 mb-8 text-sm">
        {savedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span>{savedCount} uploaded</span>
          </div>
        )}
        {skippedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span>{skippedCount} skipped</span>
          </div>
        )}
      </div>

      <Button size="lg" onClick={onFinish} className="px-8">
        View Certificates
      </Button>
    </div>
  )
}

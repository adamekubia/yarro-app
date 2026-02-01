'use client'

import { GuideTabs } from '@/components/guide-tabs'
import { CopyableGuide } from '@/components/copyable-guide'
import { Bell, ThumbsUp, Settings } from 'lucide-react'

const LANDLORD_GUIDE_TEXT = `HOW YARRO WORKS FOR LANDLORDS

1. GET NOTIFIED
When a maintenance ticket is created for your property, you'll receive a WhatsApp notification with:
- Property address
- Issue description
- Category (plumbing, electrical, etc.)

2. APPROVE QUOTES (WHEN NEEDED)
If the quoted cost is ABOVE your auto-approve limit:
- You'll be asked to approve or decline
- Tap "Approve" to proceed
- Tap "Decline" to stop the work

If the quote is BELOW your limit, work proceeds automatically.

3. THAT'S IT!
Your property manager handles everything else.
You only get involved for costs above your set limit.

AUTO-APPROVE LIMITS
Each property can have a different limit. Work below this amount proceeds without your approval.`

export default function LandlordGuidePage() {
  return (
    <div className="h-full overflow-hidden bg-gradient-to-br from-blue-50/50 via-background to-cyan-50/30 dark:from-background dark:via-background dark:to-background">
      <div className="h-full p-4 space-y-3 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-semibold text-foreground">Product Guide</h1>
          <p className="text-muted-foreground text-sm">
            Your complete guide to Yarro property management
          </p>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0">
          <GuideTabs />
        </div>

        {/* Content - full width, fills remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <CopyableGuide title="For Your Landlords" content={LANDLORD_GUIDE_TEXT}>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this guide with your landlords so they know how approvals and notifications work.
              </p>

              {/* Grid layout for compact display */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground text-sm">1. Get Notified</h3>
                    <p className="text-xs text-muted-foreground mt-1">When a ticket is created, you'll receive:</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                      <li>Property address</li>
                      <li>Issue description</li>
                      <li>Category (plumbing, electrical, etc.)</li>
                    </ul>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground text-sm">2. Approve Quotes (When Needed)</h3>
                    <p className="text-xs text-muted-foreground mt-1">If cost is <strong>above</strong> your auto-approve limit:</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                      <li>Tap "Approve" to proceed</li>
                      <li>Tap "Decline" to stop the work</li>
                    </ul>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 bg-emerald-500/10 inline-block px-2 py-0.5 rounded">
                      Below limit = auto-approved
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Settings className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground text-sm">3. That's It!</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your property manager handles everything else. You only get involved for costs above your set limit.
                    </p>
                  </div>
                </div>

                {/* Auto-approve info */}
                <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                  <h4 className="font-medium text-card-foreground text-sm mb-1">Auto-Approve Limits</h4>
                  <p className="text-xs text-muted-foreground">
                    Each property can have a different limit. Work below this amount proceeds without your approval. Talk to your PM to adjust.
                  </p>
                </div>
              </div>
            </div>
          </CopyableGuide>
        </div>
      </div>
    </div>
  )
}

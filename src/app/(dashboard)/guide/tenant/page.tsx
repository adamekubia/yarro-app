'use client'

import { GuideTabs } from '@/components/guide-tabs'
import { CopyableGuide } from '@/components/copyable-guide'
import { MessageSquare, ClipboardList, Bell } from 'lucide-react'

const TENANT_GUIDE_TEXT = `HOW TO REPORT MAINTENANCE ISSUES

1. START A CONVERSATION
Send a WhatsApp message to report your maintenance issue.
Tip: One issue per conversation works best.

2. FOLLOW THE PROMPTS
Our assistant will ask for:
- Your property address
- Description of the issue
- Photos if helpful
- Your availability for a repair visit

3. WAIT FOR UPDATES
You'll automatically hear when:
- A contractor is assigned
- A visit is scheduled

That's it! Just follow the conversation, send one message at a time, and wait for replies. We handle the rest.`

export default function TenantGuidePage() {
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
          <CopyableGuide title="For Your Tenants" content={TENANT_GUIDE_TEXT}>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this guide with your tenants so they know how to report maintenance issues.
              </p>

              {/* Grid layout for compact display */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground text-sm">1. Start a Conversation</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Send a WhatsApp message to report your maintenance issue.
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 bg-blue-500/10 inline-block px-2 py-0.5 rounded">
                      Tip: One issue per conversation works best.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground text-sm">2. Follow the Prompts</h3>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                      <li>Your property address</li>
                      <li>Description of the issue</li>
                      <li>Photos if helpful</li>
                      <li>Your availability for repair</li>
                    </ul>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground text-sm">3. Wait for Updates</h3>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                      <li>A contractor is assigned</li>
                      <li>A visit is scheduled</li>
                    </ul>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                  <h4 className="font-medium text-card-foreground text-sm mb-1">That's It!</h4>
                  <p className="text-xs text-muted-foreground">
                    Just follow the conversation, send one message at a time, and wait for replies. We handle the rest.
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

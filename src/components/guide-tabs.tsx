'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/guide', label: 'Getting Started' },
  { href: '/guide/tenant', label: 'For Tenants' },
  { href: '/guide/contractor', label: 'For Contractors' },
  { href: '/guide/landlord', label: 'For Landlords' },
]

export function GuideTabs() {
  const pathname = usePathname()

  return (
    <div className="relative flex items-end gap-6">
      {/* Full-width baseline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border/40" />
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative pb-3 text-sm font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </Link>
        )
      })}
    </div>
  )
}

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function BillingPage() {
  const supabase = createClient()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md text-center space-y-6">
        <Image
          src="/logo-wordmark.png"
          alt="Yarro"
          width={120}
          height={40}
          className="mx-auto"
          priority
        />

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your free trial has ended
          </h1>
          <p className="text-muted-foreground">
            Your 14-day trial has expired. To continue using Yarro, get in touch and we&apos;ll get you set up.
          </p>
        </div>

        <a
          href="mailto:adam@yarro.ai?subject=Yarro%20PM%20—%20Continue%20after%20trial"
          className="inline-flex items-center justify-center h-11 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Contact us to continue
        </a>

        <div className="pt-4 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <button
            onClick={handleLogout}
            className="hover:text-foreground transition-colors"
          >
            Sign out
          </button>
          <span className="text-border">|</span>
          <Link href="/" className="hover:text-foreground transition-colors">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

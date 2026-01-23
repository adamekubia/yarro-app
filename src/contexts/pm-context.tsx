'use client'

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

type PropertyManager = Tables<'c1_property_managers'>

interface PMContextType {
  propertyManager: PropertyManager | null
  loading: boolean
  signOut: () => void
}

const PMContext = createContext<PMContextType>({
  propertyManager: null,
  loading: true,
  signOut: () => {},
})

export function PMProvider({ children }: { children: ReactNode }) {
  const [propertyManager, setPropertyManager] = useState<PropertyManager | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    // Initial session check - getSession() is instant (reads from cookies, no network)
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (session?.user) {
        const { data: pm } = await supabase
          .from('c1_property_managers')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        if (mounted) {
          setPropertyManager(pm)
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }

    initSession()

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_OUT' || !session?.user) {
          setPropertyManager(null)
          setLoading(false)
        } else if (event === 'SIGNED_IN' && session?.user) {
          const { data: pm } = await supabase
            .from('c1_property_managers')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          if (mounted) {
            setPropertyManager(pm)
            setLoading(false)
          }
        }
      }
    )

    // Fallback: never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted && loading) setLoading(false)
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <PMContext.Provider value={{ propertyManager, loading, signOut }}>
      {children}
    </PMContext.Provider>
  )
}

export function usePM() {
  const context = useContext(PMContext)
  if (context === undefined) {
    throw new Error('usePM must be used within a PMProvider')
  }
  return context
}

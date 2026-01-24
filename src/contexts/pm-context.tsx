'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
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
    const resolved = { current: false }

    const fetchPM = async (userId: string) => {
      const { data: pm } = await supabase
        .from('c1_property_managers')
        .select('*')
        .eq('user_id', userId)
        .single()
      return pm
    }

    const handleSession = async (session: { user: { id: string } } | null) => {
      if (!mounted || resolved.current) return
      resolved.current = true
      if (session?.user) {
        const pm = await fetchPM(session.user.id)
        if (mounted) {
          setPropertyManager(pm)
          setLoading(false)
        }
      } else {
        setPropertyManager(null)
        setLoading(false)
      }
    }

    // Primary: directly check session (reads from cookies, fast)
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    // Also listen for auth changes (sign in/out after initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Reset resolved flag for new sign-ins
          resolved.current = false
          await handleSession(session)
        } else if (event === 'SIGNED_OUT') {
          resolved.current = false
          setPropertyManager(null)
          setLoading(false)
        }
      }
    )

    // Hard timeout: never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted && !resolved.current) {
        resolved.current = true
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase])

  const signingOut = useRef(false)
  const signOut = useCallback(() => {
    if (signingOut.current) return
    signingOut.current = true
    supabase.auth.signOut().finally(() => {
      window.location.href = '/login'
    })
  }, [supabase])

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

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
    }).catch(() => {
      // Corrupted cookies/storage — treat as no session
      if (mounted && !resolved.current) {
        resolved.current = true
        setPropertyManager(null)
        setLoading(false)
      }
    })

    // Also listen for auth changes (sign in/out after initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Reset state for new sign-ins - show loading while PM is fetched
          resolved.current = false
          setLoading(true)
          await handleSession(session)
        } else if (event === 'SIGNED_OUT') {
          resolved.current = false
          setPropertyManager(null)
          setLoading(false)
        }
      }
    )

    // Hard timeout: never stay loading forever (3s is generous for cookie read + 1 query)
    const timeout = setTimeout(() => {
      if (mounted && !resolved.current) {
        resolved.current = true
        setLoading(false)
      }
    }, 3000)

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

    // Force-clear all Supabase auth cookies to prevent stale state
    const clearCookies = () => {
      document.cookie.split(';').forEach(c => {
        const name = c.trim().split('=')[0]
        if (name.startsWith('sb-') && name.includes('auth-token')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        }
      })
    }

    clearCookies()
    supabase.auth.signOut().catch(() => {}).finally(() => {
      clearCookies() // Double-clear in case signOut restored something
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

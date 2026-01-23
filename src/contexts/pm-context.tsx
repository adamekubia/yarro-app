'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
  const supabase = createClient()

  useEffect(() => {
    const loadSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: pm } = await supabase
          .from('c1_property_managers')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (pm) {
          setPropertyManager(pm)
        }
      }

      setLoading(false)
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setPropertyManager(null)
        } else if (event === 'SIGNED_IN' && session?.user) {
          const { data: pm } = await supabase
            .from('c1_property_managers')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          if (pm) setPropertyManager(pm)
        }
      }
    )

    return () => subscription.unsubscribe()
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

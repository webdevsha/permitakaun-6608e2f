"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Profile } from '@/types/supabase-types'

type AuthContextType = {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: string | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  isLoading: true,
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Create the client once and reuse it (Singleton-like behavior for the provider)
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (mounted && !error && data) {
          setProfile(data)
          setRole(data.role ?? 'tenant')
        }
      } catch (error) {
        console.error("Profile fetch error:", error)
      }
    }

    const initAuth = async () => {
      try {
        // Check for active session
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        
        if (mounted) {
          if (initialSession) {
            setSession(initialSession)
            setUser(initialSession.user)
            await fetchProfile(initialSession.user.id)
          }
          // If no session, user is null (default), we just stop loading
        }
      } catch (error) {
        console.error("Auth init error:", error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    initAuth()

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return

      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      if (currentSession?.user) {
        // Fetch profile on sign-in or token refresh to ensure role is up to date
        await fetchProfile(currentSession.user.id)
      } else {
        setProfile(null)
        setRole(null)
      }

      setIsLoading(false)

      if (event === 'SIGNED_OUT') {
        router.refresh()
        router.push('/')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

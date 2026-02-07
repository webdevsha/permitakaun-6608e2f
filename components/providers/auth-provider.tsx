"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import { signOutAction } from "@/actions/auth"

interface AuthContextType {
  user: any | null
  session: any | null
  profile: any | null
  role: string | null
  isLoading: boolean
  isInitialized: boolean
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  isLoading: true,
  isInitialized: false,
  signOut: async () => { },
  refreshAuth: async () => { },
})

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${context} timeout after ${ms}ms`)), ms)
    )
  ])
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState<any | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Function to determine role from profile
  const determineRole = useCallback((profileData: any, userEmail?: string) => {
    if (!profileData) return null

    // Priority: 1. Explicit role from profile, 2. Email-based fallback
    let determinedRole = profileData.role

    if (!determinedRole && userEmail) {
      if (userEmail === 'admin@permit.com') determinedRole = 'admin'
      else if (userEmail === 'staff@permit.com') determinedRole = 'staff'
      else if (userEmail === 'organizer@permit.com') determinedRole = 'organizer'
      else if (userEmail === 'rafisha92@gmail.com') determinedRole = 'superadmin'
      else if (userEmail === 'admin@kumim.my') determinedRole = 'admin'
    }

    return determinedRole || 'tenant'
  }, [])

  // Fetch profile data - FIXED: pass userEmail as parameter to avoid stale closure
  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { data: profileData, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        5000,
        'fetchProfile'
      )

      if (error) {
        console.error('[Auth] Profile fetch error:', error)
        return null
      }

      if (profileData) {
        setProfile(profileData)
        const determinedRole = determineRole(profileData, userEmail)
        setRole(determinedRole)
        return profileData
      }
      return null
    } catch (error) {
      console.error('[Auth] Profile fetch error:', error)
      return null
    }
  }, [supabase, determineRole])

  // Refresh auth state
  const refreshAuth = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await withTimeout(
        supabase.auth.getSession(),
        5000,
        'getSession'
      )

      if (currentSession?.user) {
        setUser(currentSession.user)
        setSession(currentSession)
        await fetchProfile(currentSession.user.id, currentSession.user.email)
      } else {
        setUser(null)
        setSession(null)
        setProfile(null)
        setRole(null)
      }
    } catch (error) {
      console.error('[Auth] Refresh error:', error)
    }
  }, [supabase, fetchProfile])

  useEffect(() => {
    let mounted = true

    // Initial auth check
    const initAuth = async () => {
      try {
        // Add timeout to prevent hanging
        const { data: { session: initialSession }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'initAuth'
        )

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError)
        }

        if (!mounted) return

        if (initialSession?.user) {
          setUser(initialSession.user)
          setSession(initialSession)
          // CRITICAL FIX: Pass user.email directly to avoid stale closure
          await fetchProfile(initialSession.user.id, initialSession.user.email)
        }
      } catch (error) {
        console.error('[Auth] Init error:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
          setIsInitialized(true)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setSession(null)
        setProfile(null)
        setRole(null)
      } else if (newSession?.user) {
        setUser(newSession.user)
        setSession(newSession)
        await fetchProfile(newSession.user.id, newSession.user.email)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    try {
      // Clear local state immediately for instant feedback
      setUser(null)
      setSession(null)
      setProfile(null)
      setRole(null)

      // Call server action to clear cookies and redirect
      await signOutAction()
    } catch (error) {
      console.error('Sign out error:', error)
      // Force redirect even on error
      window.location.href = '/login'
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isLoading, isInitialized, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
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
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState<any | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // CRITICAL: Safety timer to ensure we never get stuck loading
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('[Auth] Safety timer triggered - forcing isLoading=false')
        setIsLoading(false)
        setIsInitialized(true)
      }
    }, 15000) // 15 seconds max loading time

    return () => clearTimeout(safetyTimer)
  }, [isLoading])

  // Function to determine role from profile
  const determineRole = useCallback((profileData: any, userEmail?: string) => {
    if (!profileData) return null

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

  // Fetch profile data
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
    console.log('[Auth] Initializing...')

    const initAuth = async () => {
      try {
        console.log('[Auth] Getting session...')
        
        // First, try to get session with timeout
        let sessionResult
        try {
          sessionResult = await withTimeout(
            supabase.auth.getSession(),
            8000,
            'initAuth'
          )
        } catch (timeoutError) {
          console.error('[Auth] getSession timeout:', timeoutError)
          // Continue without session
          sessionResult = { data: { session: null }, error: timeoutError }
        }

        const { data: { session: initialSession }, error: sessionError } = sessionResult

        console.log('[Auth] Session result:', { 
          hasSession: !!initialSession, 
          hasUser: !!initialSession?.user,
          error: sessionError?.message 
        })

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError)
        }

        if (!mounted) {
          console.log('[Auth] Component unmounted, aborting')
          return
        }

        if (initialSession?.user) {
          console.log('[Auth] User found, fetching profile...')
          setUser(initialSession.user)
          setSession(initialSession)
          
          // Fetch profile but don't let it block initialization
          try {
            await fetchProfile(initialSession.user.id, initialSession.user.email)
            console.log('[Auth] Profile fetch complete')
          } catch (profileError) {
            console.error('[Auth] Profile fetch failed:', profileError)
          }
        } else {
          console.log('[Auth] No user session')
        }
      } catch (error) {
        console.error('[Auth] Init error:', error)
      } finally {
        console.log('[Auth] Initialization complete, setting isLoading=false')
        if (mounted) {
          setIsLoading(false)
          setIsInitialized(true)
        }
      }
    }

    // Start initialization
    initAuth()

    // Set up auth state listener
    let subscription: { unsubscribe: () => void } | null = null
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('[Auth] Auth state change:', event)
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
      subscription = data.subscription
    } catch (listenerError) {
      console.error('[Auth] Failed to set up auth listener:', listenerError)
    }

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    try {
      setUser(null)
      setSession(null)
      setProfile(null)
      setRole(null)
      await signOutAction()
    } catch (error) {
      console.error('Sign out error:', error)
      window.location.href = '/login'
    }
  }

  console.log('[Auth] Render state:', { isLoading, isInitialized, hasUser: !!user })

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isLoading, isInitialized, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[AuthProvider] Component rendering')
  
  const router = useRouter()
  const pathname = usePathname()
  const initStartedRef = useRef(false)

  const [user, setUser] = useState<any | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // CRITICAL: Safety timer to ensure we never get stuck loading
  useEffect(() => {
    console.log('[AuthProvider] Safety timer effect running, isLoading:', isLoading)
    if (!isLoading) return
    
    const safetyTimer = setTimeout(() => {
      console.warn('[AuthProvider] Safety timer triggered - forcing isLoading=false')
      setIsLoading(false)
      setIsInitialized(true)
    }, 10000) // 10 seconds max loading time

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

  // Main initialization effect
  useEffect(() => {
    console.log('[AuthProvider] Main init effect running, initStarted:', initStartedRef.current)
    
    // Prevent double initialization in React StrictMode
    if (initStartedRef.current) {
      console.log('[AuthProvider] Already initialized, skipping')
      return
    }
    initStartedRef.current = true

    let mounted = true
    let subscription: any = null

    const initAuth = async () => {
      console.log('[AuthProvider] initAuth starting')
      const supabase = createClient()
      
      try {
        console.log('[AuthProvider] Calling getSession...')
        
        // Add manual timeout using Promise.race
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 8000)
        )
        
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any
        const { data: { session: initialSession }, error: sessionError } = result

        console.log('[AuthProvider] getSession result:', { 
          hasSession: !!initialSession, 
          hasUser: !!initialSession?.user,
          error: sessionError?.message 
        })

        if (!mounted) {
          console.log('[AuthProvider] Component unmounted, aborting')
          return
        }

        if (sessionError) {
          console.error('[AuthProvider] Session error:', sessionError)
        }

        if (initialSession?.user) {
          console.log('[AuthProvider] User found, setting state...')
          setUser(initialSession.user)
          setSession(initialSession)
          
          // Fetch profile
          try {
            console.log('[AuthProvider] Fetching profile...')
            const profilePromise = supabase
              .from('profiles')
              .select('*')
              .eq('id', initialSession.user.id)
              .single()
            
            const profileTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('profile fetch timeout')), 5000)
            )
            
            const { data: profileData, error: profileError } = await Promise.race([profilePromise, profileTimeout]) as any

            if (profileError) {
              console.error('[AuthProvider] Profile error:', profileError)
            } else if (profileData) {
              console.log('[AuthProvider] Profile fetched successfully')
              setProfile(profileData)
              const determinedRole = determineRole(profileData, initialSession.user.email)
              setRole(determinedRole)
            }
          } catch (profileErr) {
            console.error('[AuthProvider] Profile fetch failed:', profileErr)
          }
        } else {
          console.log('[AuthProvider] No user session')
        }
      } catch (error) {
        console.error('[AuthProvider] Init error:', error)
      } finally {
        console.log('[AuthProvider] Init complete, setting isLoading=false')
        if (mounted) {
          setIsLoading(false)
          setIsInitialized(true)
        }
      }

      // Set up auth state listener
      try {
        console.log('[AuthProvider] Setting up auth listener...')
        const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          console.log('[AuthProvider] Auth state change:', event)
          if (!mounted) return

          if (event === 'SIGNED_OUT') {
            setUser(null)
            setSession(null)
            setProfile(null)
            setRole(null)
          } else if (newSession?.user) {
            setUser(newSession.user)
            setSession(newSession)
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newSession.user.id)
                .single()
              if (profileData) {
                setProfile(profileData)
                setRole(determineRole(profileData, newSession.user.email))
              }
            } catch (e) {
              console.error('[AuthProvider] Profile fetch on auth change failed:', e)
            }
          }
        })
        subscription = data.subscription
        console.log('[AuthProvider] Auth listener set up successfully')
      } catch (listenerError) {
        console.error('[AuthProvider] Failed to set up auth listener:', listenerError)
      }
    }

    initAuth()

    return () => {
      console.log('[AuthProvider] Cleanup running')
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [determineRole]) // Only run once on mount

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

  const refreshAuth = useCallback(async () => {
    const supabase = createClient()
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession?.user) {
        setUser(currentSession.user)
        setSession(currentSession)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single()
        if (profileData) {
          setProfile(profileData)
          setRole(determineRole(profileData, currentSession.user.email))
        }
      } else {
        setUser(null)
        setSession(null)
        setProfile(null)
        setRole(null)
      }
    } catch (error) {
      console.error('[Auth] Refresh error:', error)
    }
  }, [determineRole])

  console.log('[AuthProvider] Rendering, state:', { isLoading, isInitialized, hasUser: !!user })

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isLoading, isInitialized, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

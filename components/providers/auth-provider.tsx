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

// Inline role determination - no dependencies
function determineRoleInline(profileData: any, userEmail?: string): string {
  if (!profileData) return 'tenant'
  let determinedRole = profileData.role
  if (!determinedRole && userEmail) {
    if (userEmail === 'admin@permit.com') determinedRole = 'admin'
    else if (userEmail === 'staff@permit.com') determinedRole = 'staff'
    else if (userEmail === 'organizer@permit.com') determinedRole = 'organizer'
    else if (userEmail === 'rafisha92@gmail.com') determinedRole = 'superadmin'
    else if (userEmail === 'admin@kumim.my') determinedRole = 'admin'
  }
  return determinedRole || 'tenant'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[AuthProvider] Render')
  
  const [user, setUser] = useState<any | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Main initialization effect - NO DEPENDENCIES to ensure it runs once
  useEffect(() => {
    console.log('[AuthProvider] useEffect running')
    
    let mounted = true
    let subscription: any = null

    const initAuth = async () => {
      console.log('[AuthProvider] initAuth started')
      
      try {
        const supabase = createClient()
        console.log('[AuthProvider] Client created')
        
        // Get session with timeout
        const timeoutMs = 5000
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )
        
        let result: any
        try {
          result = await Promise.race([sessionPromise, timeoutPromise])
        } catch (timeoutErr) {
          console.log('[AuthProvider] getSession timeout, continuing without session')
          result = { data: { session: null }, error: null }
        }
        
        const { data: { session: initialSession }, error: sessionError } = result
        console.log('[AuthProvider] Session:', { hasSession: !!initialSession, error: !!sessionError })

        if (!mounted) return

        if (sessionError) {
          console.error('[AuthProvider] Session error:', sessionError)
        }

        if (initialSession?.user) {
          setUser(initialSession.user)
          setSession(initialSession)
          
          // Fetch profile - don't block on this
          supabase
            .from('profiles')
            .select('*')
            .eq('id', initialSession.user.id)
            .single()
            .then(({ data: profileData, error: profileError }: any) => {
              if (!mounted) return
              if (profileError) {
                console.error('[AuthProvider] Profile error:', profileError)
              } else if (profileData) {
                setProfile(profileData)
                setRole(determineRoleInline(profileData, initialSession.user.email))
              }
            })
            .catch((err: any) => {
              console.error('[AuthProvider] Profile fetch error:', err)
            })
        }
        
        // Set up auth listener
        try {
          const { data } = supabase.auth.onAuthStateChange((event: any, newSession: any) => {
            console.log('[AuthProvider] Auth change:', event)
            if (!mounted) return
            
            if (event === 'SIGNED_OUT') {
              setUser(null)
              setSession(null)
              setProfile(null)
              setRole(null)
            } else if (newSession?.user) {
              setUser(newSession.user)
              setSession(newSession)
            }
          })
          subscription = data.subscription
        } catch (e) {
          console.error('[AuthProvider] Listener error:', e)
        }
        
      } catch (error) {
        console.error('[AuthProvider] Init error:', error)
      } finally {
        console.log('[AuthProvider] Init complete')
        if (mounted) {
          setIsLoading(false)
          setIsInitialized(true)
        }
      }
    }

    initAuth()

    return () => {
      console.log('[AuthProvider] Cleanup')
      mounted = false
      if (subscription) subscription.unsubscribe()
    }
  }, []) // NO DEPENDENCIES - run once on mount

  const signOut = async () => {
    try {
      setUser(null)
      setSession(null)
      setProfile(null)
      setRole(null)
      await signOutAction()
    } catch (error) {
      window.location.href = '/login'
    }
  }

  const refreshAuth = useCallback(async () => {
    try {
      const supabase = createClient()
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
          setRole(determineRoleInline(profileData, currentSession.user.email))
        }
      } else {
        setUser(null)
        setSession(null)
        setProfile(null)
        setRole(null)
      }
    } catch (error) {
      console.error('[AuthProvider] Refresh error:', error)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isLoading, isInitialized, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

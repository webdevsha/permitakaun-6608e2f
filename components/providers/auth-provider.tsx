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

  // Fetch profile data
  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileData) {
      setProfile(profileData)
      const determinedRole = determineRole(profileData, user?.email)
      setRole(determinedRole)
    }
  }, [supabase, determineRole, user?.email])

  // Refresh auth state
  const refreshAuth = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (currentSession?.user) {
      setUser(currentSession.user)
      setSession(currentSession)
      await fetchProfile(currentSession.user.id)
    } else {
      setUser(null)
      setSession(null)
      setProfile(null)
      setRole(null)
    }
  }, [supabase, fetchProfile])

  useEffect(() => {
    let mounted = true

    // Initial auth check
    const initAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession()

      if (!mounted) return

      if (initialSession?.user) {
        setUser(initialSession.user)
        setSession(initialSession)
        await fetchProfile(initialSession.user.id)
      }

      setIsLoading(false)
      setIsInitialized(true)
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
        await fetchProfile(newSession.user.id)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router, fetchProfile, pathname])

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

"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Users,
  Receipt,
  Home,
  Settings,
  LogOut,
  Menu,
  MapPin,
  Bell,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Building,
  Store
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetHeader } from "@/components/ui/sheet"
import { useAuth } from "@/components/providers/auth-provider"
import { createClient } from "@/utils/supabase/client"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface SidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  initialUser?: any
  initialRole?: string | null
  initialProfile?: any
}

export function AppSidebar({ isCollapsed, setIsCollapsed, initialUser, initialRole, initialProfile }: SidebarProps) {
  const { role: authRole, signOut, user: authUser, profile: authProfile, isLoading, isInitialized } = useAuth()
  const pathname = usePathname()
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const [businessName, setBusinessName] = React.useState<string>("")
  const [adminInfo, setAdminInfo] = React.useState<{name: string, organizer_code: string} | null>(null)

  // CRITICAL: Use server-provided initial data as source of truth to prevent flickering
  // Only fall back to auth context if initial data is not available
  const user = initialUser || authUser
  const role = initialRole || authRole
  const profile = initialProfile || authProfile

  // Fetch business name from tenant/organizer profile
  React.useEffect(() => {
    const fetchBusinessName = async () => {
      if (!user?.id) return
      
      const supabase = createClient()
      
      // Fetch based on role
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const userRole = userProfile?.role
      
      if (userRole === 'organizer') {
        // For organizers, use 'name' as business name
        const { data: organizer } = await supabase
          .from('organizers')
          .select('name')
          .eq('profile_id', user.id)
          .maybeSingle()
        
        if (organizer?.name) {
          setBusinessName(organizer.name)
          return
        }
      } else if (userRole === 'admin') {
        // For admins, use full_name from admins table
        const { data: admin } = await supabase
          .from('admins')
          .select('full_name')
          .eq('profile_id', user.id)
          .maybeSingle()
        
        if (admin?.full_name) {
          setBusinessName(admin.full_name)
          return
        }
      } else if (userRole === 'staff') {
        // For staff, use full_name from staff table
        const { data: staff } = await supabase
          .from('staff')
          .select('full_name')
          .eq('profile_id', user.id)
          .maybeSingle()
        
        if (staff?.full_name) {
          setBusinessName(staff.full_name)
          return
        }
      } else {
        // For tenants, use business_name
        const { data: tenant } = await supabase
          .from('tenants')
          .select('business_name, full_name')
          .eq('profile_id', user.id)
          .maybeSingle()
        
        if (tenant?.business_name) {
          setBusinessName(tenant.business_name)
          return
        } else if (tenant?.full_name) {
          setBusinessName(tenant.full_name)
          return
        }
      }
    }
    
    fetchBusinessName()
  }, [user?.id])

  // Fetch admin info for staff
  React.useEffect(() => {
    const fetchAdminInfo = async () => {
      if (role !== 'staff' || !user?.id) return
      
      const supabase = createClient()
      
      // Get staff's organizer_code
      const { data: staffProfile } = await supabase
        .from('profiles')
        .select('organizer_code')
        .eq('id', user.id)
        .single()
      
      if (!staffProfile?.organizer_code) return
      
      // Try to get organizer info
      const { data: organizer } = await supabase
        .from('organizers')
        .select('name, organizer_code')
        .eq('organizer_code', staffProfile.organizer_code)
        .single()
      
      if (organizer) {
        setAdminInfo(organizer)
        return
      }
      
      // Fallback: get admin profile info
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('organizer_code', staffProfile.organizer_code)
        .eq('role', 'admin')
        .single()
      
      if (adminProfile) {
        setAdminInfo({ 
          name: adminProfile.full_name || adminProfile.email, 
          organizer_code: staffProfile.organizer_code 
        })
      }
    }
    
    fetchAdminInfo()
  }, [role, user?.id])

  // Only show skeleton if we have NO role data at all and auth is still initializing
  const showSkeleton = !role && isLoading && !isInitialized

  if (showSkeleton) {
    // Return a skeleton sidebar matching the collapsed state to prevent layout shift
    return (
      <aside className={cn(
        "hidden md:flex flex-col border-r bg-white h-screen sticky top-0 transition-all duration-300 ease-in-out z-30 shadow-sm",
        isCollapsed ? "w-[80px]" : "w-[280px]"
      )}>
        <div className={cn("flex items-center border-b border-border/50", isCollapsed ? "justify-center h-20" : "justify-between px-6 h-24")}>
          <div className="w-10 h-10 bg-secondary/50 rounded-full animate-pulse"></div>
        </div>
        <div className="flex-1 py-6 flex flex-col gap-2 px-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-secondary/30 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </aside>
    )
  }

  let navItems = []

  if (role === 'admin' || role === 'superadmin') {
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "organizers", label: "Penganjur", icon: Building, href: "/dashboard/organizers" },
      { id: "tenants", label: "Peniaga & Sewa", icon: Users, href: "/dashboard/tenants" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "locations", label: "Lokasi", icon: MapPin, href: "/dashboard/locations" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  } else if (role === 'organizer') {
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "locations", label: "Lokasi", icon: MapPin, href: "/dashboard/locations" },
      { id: "tenants", label: "Peniaga & Sewa", icon: Users, href: "/dashboard/tenants" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  } else if (role === 'staff') {
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "organizers", label: "Penganjur", icon: Building, href: "/dashboard/organizers" },
      { id: "tenants", label: "Peniaga & Sewa", icon: Users, href: "/dashboard/tenants" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "locations", label: "Lokasi", icon: MapPin, href: "/dashboard/locations" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  } else {
    // Tenant
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "rentals", label: "Sewa Saya", icon: Home, href: "/dashboard/rentals" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-white h-screen sticky top-0 transition-all duration-300 ease-in-out z-30 shadow-sm",
        isCollapsed ? "w-[80px]" : "w-[280px]"
      )}
    >
      <div className={cn("flex items-center border-b border-border/50", isCollapsed ? "justify-center h-20" : "justify-between px-6 h-24")}>
        {!isCollapsed && (
          <div className="relative w-40 h-16 animate-in fade-in duration-300">
            <Image
              src="https://permitakaun.kumim.my/logo.png"
              alt="Permit Akaun"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        )}
        {isCollapsed && (
          <div className="relative w-10 h-10">
            <Image
              src="https://permitakaun.kumim.my/logo.png"
              alt="PA"
              fill
              className="object-cover object-left"
              style={{ objectPosition: '0 50%' }}
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("hidden md:flex text-muted-foreground hover:text-primary", isCollapsed && "mx-auto mt-4 hidden")}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      {isCollapsed && (
        <div className="flex justify-center py-2 border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-muted-foreground"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center w-full justify-start h-12 rounded-xl transition-all",
                active
                  ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-secondary hover:text-primary",
                isCollapsed ? "justify-center px-0" : "px-4"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
              {!isCollapsed && active && (
                <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
              )}
            </Link>
          )
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        {/* Staff Admin Info Banner */}
        {role === 'staff' && adminInfo && !isCollapsed && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-[10px] text-blue-600 uppercase font-semibold tracking-wider">Staf bagi</p>
            <p className="text-xs text-blue-800 font-medium truncate">{adminInfo.name}</p>
          </div>
        )}
        <div className={cn(
          "bg-secondary/30 rounded-2xl p-4 flex items-center gap-3 transition-all",
          isCollapsed ? "justify-center p-2 bg-transparent" : ""
        )}>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
            {(businessName || profile?.full_name || user?.user_metadata?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate text-foreground">
                {businessName || profile?.business_name || profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </p>
              {(businessName || profile?.business_name) && (
                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                  <Store className="w-3 h-3" /> {profile?.full_name || user?.email?.split('@')[0]}
                </p>
              )}
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider truncate">{role}</p>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={() => {
            // Immediate logout without waiting
            signOut()
          }}
          className={cn(
            "w-full mt-2 text-muted-foreground hover:text-destructive hover:text-destructive/90 hover:bg-destructive/10",
            isCollapsed ? "h-10 w-10 p-0 justify-center mx-auto" : "justify-start px-4"
          )}
          title="Log Keluar"
        >
          <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
          {!isCollapsed && "Log Keluar"}
        </Button>
      </div>
    </aside>
  )
}

interface MobileNavProps {
  initialUser?: any
  initialRole?: string | null
}

export function MobileNav({ initialUser, initialRole }: MobileNavProps) {
  const { role: authRole, signOut, user: authUser, isInitialized } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)

  // CRITICAL: Use server-provided initial data as source of truth
  const user = initialUser || authUser
  const role = initialRole || authRole
  const userRole = role || "tenant"

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  let navItems = []

  if (userRole === 'admin') {
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "organizers", label: "Penganjur", icon: Building, href: "/dashboard/organizers" },
      { id: "tenants", label: "Peniaga & Sewa", icon: Users, href: "/dashboard/tenants" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "locations", label: "Lokasi", icon: MapPin, href: "/dashboard/locations" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  } else if (userRole === 'organizer') {
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "locations", label: "Lokasi", icon: MapPin, href: "/dashboard/locations" },
      { id: "tenants", label: "Peniaga & Sewa", icon: Users, href: "/dashboard/tenants" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  } else if (userRole === 'staff') {
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "organizers", label: "Penganjur", icon: Building, href: "/dashboard/organizers" },
      { id: "tenants", label: "Peniaga & Sewa", icon: Users, href: "/dashboard/tenants" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "locations", label: "Lokasi", icon: MapPin, href: "/dashboard/locations" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  } else {
    navItems = [
      { id: "overview", label: "Utama", icon: LayoutDashboard, href: "/dashboard" },
      { id: "accounting", label: "Akaun", icon: Receipt, href: "/dashboard/accounting" },
      { id: "rentals", label: "Sewa Saya", icon: Home, href: "/dashboard/rentals" },
      { id: "settings", label: "Tetapan", icon: Settings, href: "/dashboard/settings" },
    ]
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  const handleNavClick = () => {
    setOpen(false)
  }

  if (!isMounted) {
    return (
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-border/50 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="-ml-2">
            <Menu className="h-6 w-6 text-foreground" />
          </Button>
          <div className="relative w-28 h-8">
            <Image
              src="https://permitakaun.kumim.my/logo.png"
              alt="Permit Akaun"
              fill
              className="object-contain object-left"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-secondary rounded-full flex items-center justify-center text-xs font-bold text-primary">
            U
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-border/50 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="h-6 w-6 text-foreground" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
            <SheetHeader className="p-6 border-b border-border/50 bg-secondary/10">
              <div className="relative w-40 h-12 mb-2">
                <Image
                  src="https://permitakaun.kumim.my/logo.png"
                  alt="Permit Akaun"
                  fill
                  className="object-contain object-left"
                />
              </div>
              <SheetDescription className="text-left text-xs">
                Sistem Pengurusan Bersepadu
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col h-full pb-20">
              <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center w-full justify-start h-14 rounded-xl text-base",
                        active
                          ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:bg-secondary hover:text-primary"
                      )}
                    >
                      <item.icon className="h-5 w-5 mr-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
              <div className="p-4 border-t border-border/50">
                <div className="flex items-center gap-3 px-4 mb-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{user?.email?.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-4 w-4 mr-2" /> Log Keluar
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <div className="relative w-28 h-8">
          <Image
            src="https://permitakaun.kumim.my/logo.png"
            alt="Permit Akaun"
            fill
            className="object-contain object-left"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div className="h-8 w-8 bg-secondary rounded-full flex items-center justify-center text-xs font-bold text-primary">
          {user?.email?.charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  )
}

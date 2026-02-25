"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Download,
  TrendingUp,
  Edit2,
  Trash2,
  Wallet,
  Building,
  PiggyBank,
  ShieldAlert,
  Heart,
  Landmark,
  Loader2,
  FileText,
  Upload,
  User,
  Calendar,
  Briefcase,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Filter,
  ChevronDown,
  Lock,
  Settings,
  CheckCircle,
  Pencil,
  X,
  Search
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import useSWR from "swr"
import { createClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"
import { SubscriptionPlans } from "@/components/subscription-plans"
import { useAuth } from "@/components/providers/auth-provider"
import { logAction } from "@/utils/logging"
import { generateFinancialReport } from "@/utils/pdf/generate-report"


export function AccountingModule({ initialTransactions, tenants }: { initialTransactions?: any[], tenants?: any[] }) {
  const { role, user, isLoading: authLoading, activePlan } = useAuth()
  const [userRole, setUserRole] = useState<string>("")
  // Use server-provided transactions (already filtered by role in fetchDashboardData)
  const transactions = initialTransactions || []
  const router = useRouter()
  const mutate = () => router.refresh()
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  // Access Control State
  const [isModuleVerified, setIsModuleVerified] = useState(false)
  const [accessDeniedStatus, setAccessDeniedStatus] = useState<"locked" | "trial_expired" | null>(null)

  // Config State
  const [activeTab, setActiveTab] = useState("dashboard")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null)
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Filtering & Pagination State
  const [filterMonth, setFilterMonth] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  // Default to showing ALL transactions so users don't miss any data
  // They can filter to 'approved' or 'pending' if needed
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [displayLimit, setDisplayLimit] = useState<number>(5)

  // Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const [newTransaction, setNewTransaction] = useState({
    description: "",
    category: "",
    amount: "",
    type: "income" as "income" | "expense",
    tenant_id: "",
    date: new Date().toISOString().split('T')[0],
    modal_type: "" as "" | "operasi" | "investment" | "savings" | "emergency"
  })

  // 7-Tabung Config State
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [percentages, setPercentages] = useState({
    operating: 60,
    tax: 10,
    zakat: 2.5,
    investment: 10,
    dividend: 10,
    savings: 4,
    emergency: 3.5
  })
  // Individual bank names for each of the 7 tabungs
  const [bankNames, setBankNames] = useState({
    operating: "",
    tax: "",
    zakat: "",
    investment: "",
    dividend: "",
    savings: "",
    emergency: ""
  })

  // Superadmin Settings State
  const [systemSettings, setSystemSettings] = useState({ is_active: true, trial_duration_days: 14 })
  const [isSuperadminConfigOpen, setIsSuperadminConfigOpen] = useState(false)

  // Trial status state
  const [isTrial, setIsTrial] = useState(false)

  // Fetch Accounting Config on Mount
  useEffect(() => {
    const fetchConfig = async () => {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('accounting_config')
          .select('percentages, bank_names')
          .eq('profile_id', user.id)
          .maybeSingle()

        // Silently handle errors - config is optional, defaults will be used
        if (error) {
          // Only log actual errors, not "no data found" which is expected for new users
          if (error.code !== 'PGRST116') {
            console.log('[Accounting] No config found for user, using defaults')
          }
          return
        }

        if (data) {
          if (data.percentages) {
            console.log('[Accounting] Loaded percentages:', data.percentages)
            setPercentages(data.percentages)
          }
          if (data.bank_names) {
            console.log('[Accounting] Loaded bank names:', data.bank_names)
            setBankNames(data.bank_names)
          }
        }
      } catch (e) {
        // Silently ignore - config is optional
        console.log('[Accounting] Using default config')
      }
    }

    if (user) {
      fetchConfig()
    }
  }, [user])

  // Check if user is in trial mode (no active subscription)
  useEffect(() => {
    const checkTrialStatus = async () => {
      // If user has an active plan from auth context, they are NOT in trial mode
      if (activePlan !== null && activePlan !== undefined) {
        console.log('[TrialCheck] User has activePlan:', activePlan, '- not in trial')
        setIsTrial(false)
        return
      }

      if (!user || role !== 'tenant') {
        setIsTrial(false)
        return
      }

      try {
        // Check if tenant has active subscription
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id, accounting_status')
          .eq('profile_id', user.id)
          .single()

        // If has active subscription, NEVER show trial badge
        if (tenant?.accounting_status === 'active') {
          setIsTrial(false)
          return
        }

        // Check if still in trial period (14 days from profile creation)
        const { data: profile } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .single()

        if (profile) {
          const createdDate = new Date(profile.created_at)
          const trialEndDate = new Date(createdDate)
          trialEndDate.setDate(trialEndDate.getDate() + 14)

          const daysLeft = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          setIsTrial(daysLeft > 0)
        }
      } catch (error) {
        console.error('Error checking trial status:', error)
        setIsTrial(false)
      }
    }

    checkTrialStatus()
  }, [user, role, supabase, activePlan])

  // Refresh data when window gains focus (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Accounting] Window visible, refreshing data...')
        mutate() // Refresh server data
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Simplified init with timeout protection
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let isMounted = true

    const init = async () => {
      console.log('[Accounting] INIT START - role:', role, 'user:', user?.id, 'isLoading:', isLoading, 'authLoading:', authLoading)

      // If auth is still loading, wait
      if (authLoading) {
        console.log('[Accounting] Waiting for auth loading...')
        return
      }

      // Safety timeout - force loading to false after 3 seconds
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.error('[Accounting] TIMEOUT - forcing loading to false')
          setIsModuleVerified(true)
          setIsLoading(false)
        }
      }, 3000)

      try {
        setIsLoading(true)
        setAccessDeniedStatus(null)
        setIsModuleVerified(false)

        if (!user || !role) {
          console.log('[Accounting] No user or role - allowing access for now')
          setIsModuleVerified(true)
          setIsLoading(false)
          return
        }

        setUserRole(role)

        // FAST-PATH: Admin/Staff/Superadmin - no eligibility check needed
        // Also check email for admin@kumim.my which should always have admin access
        const isAdminEmail = user?.email === 'admin@kumim.my' || user?.email === 'admin@permit.com'
        if (role === 'superadmin' || role === 'admin' || role === 'staff' || isAdminEmail) {
          console.log('[Accounting] Privileged role or admin email - instant access')
          setAccessDeniedStatus(null)
          setIsModuleVerified(true)
          setIsLoading(false)
          return
        }

        // For organizers/tenants - simple check
        if (role === 'organizer') {
          try {
            // Run all checks in parallel for speed
            const [orgResult, tenantResult, profileResult] = await Promise.all([
              supabase.from('organizers').select('accounting_status').eq('profile_id', user.id).maybeSingle(),
              supabase.from('tenants').select('id').eq('profile_id', user.id).maybeSingle(),
              supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle()
            ])

            // Grant access if accounting is active
            if (orgResult.data?.accounting_status === 'active') {
              console.log('[Accounting] Organizer with active accounting')
              setAccessDeniedStatus(null)
              setIsModuleVerified(true)
              setIsLoading(false)
              return
            }

            // FALLBACK: If they are also a TENANT, allow access
            if (tenantResult.data) {
              console.log('[Accounting] User is also a Tenant - bypassing organizer trial check')
              setAccessDeniedStatus(null)
              setIsModuleVerified(true)
              setIsLoading(false)
              return
            }

            // Check trial as fallback
            if (profileResult.data) {
              const daysRemaining = 14 - Math.floor((Date.now() - new Date(profileResult.data.created_at).getTime()) / (1000 * 60 * 60 * 24))
              console.log('[Accounting] Days remaining:', daysRemaining)

              if (daysRemaining > 0) {
                setAccessDeniedStatus(null)
                setIsModuleVerified(true)
                setIsLoading(false)
                return
              }
            }

            // Trial expired
            setAccessDeniedStatus('trial_expired')
            setIsModuleVerified(false)
          } catch (e) {
            console.error('[Accounting] Error checking organizer:', e)
            // Allow access on error
            setIsModuleVerified(true)
            setIsLoading(false)
          }

        } else if (role === 'tenant') {
          // Tenants always get access to their own Akaun
          console.log('[Accounting] Tenant access granted')
          setAccessDeniedStatus(null)
          setIsModuleVerified(true)
          setIsLoading(false)
        } else {
          // Unknown role - allow access
          setIsModuleVerified(true)
          setIsLoading(false)
        }

      } catch (e) {
        console.error("[Accounting] Error:", e)
        // Allow access on error
        setIsModuleVerified(true)
      } finally {
        clearTimeout(timeoutId)
        if (isMounted) {
          setIsLoading(false)
          console.log('[Accounting] INIT COMPLETE')
        }
      }
    }

    init()

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [role, user?.id, authLoading])

  const handleSaveConfig = async () => {
    // Determine allowed tabungs based on active plan
    // Plan IDs from subscription-plans: enterprise, sdn-bhd, sdn-bhd-berhad
    const isEnterprise = activePlan === 'enterprise' || activePlan === 'premium'
    const isSdnBhd = activePlan === 'sdn-bhd' || activePlan === 'standard'
    const isSdnBhdBerhad = activePlan === 'sdn-bhd-berhad' || activePlan === 'berhad'
    const isAdminOrStaff = role === 'superadmin' || role === 'admin' || role === 'staff'
    const isLocalTrial = activePlan === null  // Only trial if explicitly null
    const allowedTabungs = (isSdnBhdBerhad || isAdminOrStaff || isLocalTrial)
      ? ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency']
      : isSdnBhd
        ? ['operating', 'tax', 'zakat', 'investment']
        : isEnterprise
          ? ['operating', 'tax', 'zakat']
          : ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency'];

    // Warn if not exactly 100%, but don't force return block
    const total = allowedTabungs.reduce((sum, key) => sum + (percentages[key as keyof typeof percentages] || 0), 0)
    if (Math.abs(total - 100) > 0.1) {
      toast.error(`Jumlah peratus mesti 100%. Sekarang: ${total.toFixed(1)}%`)
      return
    }

    if (!user) return

    try {
      const { error } = await supabase.from('accounting_config').upsert({
        profile_id: user.id,
        percentages: percentages,
        bank_names: bankNames
      }, { onConflict: 'profile_id' })

      if (error) throw error
      toast.success("Konfigurasi 7-Tabung disimpan.")
      setIsConfigOpen(false)
    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message)
    }
  }

  // Auto-adjust percentages to make total = 100%
  const handleAutoAdjustPercentages = () => {
    // Plan IDs from subscription-plans: enterprise, sdn-bhd, sdn-bhd-berhad
    const isEnterprise = activePlan === 'enterprise' || activePlan === 'premium'
    const isSdnBhd = activePlan === 'sdn-bhd' || activePlan === 'standard'
    const isSdnBhdBerhad = activePlan === 'sdn-bhd-berhad' || activePlan === 'berhad'
    const isAdminOrStaff = role === 'superadmin' || role === 'admin' || role === 'staff'
    const isLocalTrial = activePlan === null  // Only trial if explicitly null
    const allowedTabungs = (isSdnBhdBerhad || isAdminOrStaff || isLocalTrial)
      ? ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency']
      : isSdnBhd
        ? ['operating', 'tax', 'zakat', 'investment']
        : isEnterprise
          ? ['operating', 'tax', 'zakat']
          : ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency'];

    console.log('[AutoAdjust] Debug:', { activePlan, isEnterprise, isSdnBhd, allowedTabungs })

    const currentTotal = allowedTabungs.reduce((sum, key) => sum + (percentages[key as keyof typeof percentages] || 0), 0)

    console.log('[AutoAdjust] currentTotal:', currentTotal, 'percentages:', percentages)

    if (currentTotal === 0) {
      toast.error("Sila masukkan nilai peratus terlebih dahulu")
      return
    }

    // Calculate the factor to multiply each percentage to reach 100%
    const factor = 100 / currentTotal

    const newPercentages = { ...percentages }
    allowedTabungs.forEach((key) => {
      const currentValue = percentages[key as keyof typeof percentages] || 0
      newPercentages[key as keyof typeof percentages] = Number((currentValue * factor).toFixed(1))
    })

    // Handle rounding error - adjust the last tabung to ensure exactly 100%
    const newTotal = allowedTabungs.reduce((sum, key) => sum + (newPercentages[key as keyof typeof percentages] || 0), 0)
    if (Math.abs(newTotal - 100) > 0.01 && allowedTabungs.length > 0) {
      const lastKey = allowedTabungs[allowedTabungs.length - 1] as keyof typeof percentages
      newPercentages[lastKey] = Number((newPercentages[lastKey] + (100 - newTotal)).toFixed(1))
    }

    setPercentages(newPercentages)
    toast.success(`Peratusan telah digenapkan kepada 100% (daripada ${currentTotal.toFixed(1)}%)`)
  }

  // Calculate remaining percentage needed to reach 100%
  const getRemainingPercentage = () => {
    // Plan IDs from subscription-plans: enterprise, sdn-bhd, sdn-bhd-berhad
    const isEnterprise = activePlan === 'enterprise' || activePlan === 'premium'
    const isSdnBhd = activePlan === 'sdn-bhd' || activePlan === 'standard'
    const isSdnBhdBerhad = activePlan === 'sdn-bhd-berhad' || activePlan === 'berhad'
    const isAdminOrStaff = role === 'superadmin' || role === 'admin' || role === 'staff'
    const isLocalTrial = activePlan === null  // Only trial if explicitly null
    const allowedTabungs = (isSdnBhdBerhad || isAdminOrStaff || isLocalTrial)
      ? ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency']
      : isSdnBhd
        ? ['operating', 'tax', 'zakat', 'investment']
        : isEnterprise
          ? ['operating', 'tax', 'zakat']
          : ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency'];

    const currentTotal = allowedTabungs.reduce((sum, key) => sum + (percentages[key as keyof typeof percentages] || 0), 0)
    return 100 - currentTotal
  }

  const handleSaveSystemSettings = async () => {
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'accounting_module',
        value: systemSettings,
        updated_at: new Date().toISOString()
      })
      if (error) throw error
      toast.success("Tetapan Sistem Disimpan")
      setIsSuperadminConfigOpen(false)
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  // Reset limit when filters change
  useEffect(() => {
    setDisplayLimit(5)
  }, [filterMonth, filterType, filterStatus])

  console.log('[Accounting] RENDER - isLoading:', isLoading, 'accessDeniedStatus:', accessDeniedStatus, 'isModuleVerified:', isModuleVerified)


  if (isLoading || !user || (user && !role)) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center text-muted-foreground animate-pulse">
        <Loader2 className="animate-spin h-10 w-10 mx-auto mb-4 text-primary" />
        <p className="font-semibold text-sm">
          Memuatkan Akaun...
        </p>
      </div>
    )
  }

  // Tenant-specific: wait for plan check
  if (role === 'tenant' && activePlan === undefined) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center text-muted-foreground animate-pulse">
        <Loader2 className="animate-spin h-10 w-10 mx-auto mb-4 text-primary" />
        <p className="font-semibold text-sm">Memuatkan Akaun...</p>
      </div>
    )
  }

  if (accessDeniedStatus === 'trial_expired') {
    console.log('[Accounting] RENDERING SubscriptionPlans (trial_expired)')
    return <SubscriptionPlans />
  }

  if (accessDeniedStatus === 'locked') {
    return <SubscriptionPlans />
  }

  // ------------------------------------------------------------------
  // FINANCIAL CALCULATION ENGINE
  // ------------------------------------------------------------------

  // Note: With role-specific tables (tenant_transactions vs organizer_transactions),
  // the transactions are already in the viewer's correct perspective:
  // - Tenant sees their transactions from tenant_transactions (expenses are already 'expense')
  // - Organizer sees their transactions from organizer_transactions (income is already 'income')
  // No perspective transformation needed!

  const perspectiveTransactions = transactions || []

  // Include both approved and pending transactions for all roles
  // Admins/organizers own the data so pending is still valid revenue
  // Tenants also see their own pending transactions
  const statusFilter = ['approved', 'pending']

  // 1. Paid Up Capital (Modal)
  // Updated to include new capital terms and sub-category distribution
  const capitalCategories = ['Modal', 'Modal Pinjaman']
  const modalTransactions = perspectiveTransactions
    ?.filter((t: any) => t.type === 'income' && statusFilter.includes(t.status) && capitalCategories.includes(t.category)) || []

  const totalCapital = modalTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0)

  // Calculate modal amount per tabung based on metadata
  const modalByTabung = modalTransactions.reduce((acc: any, t: any) => {
    // Default to 'operasi' if no specific modal_type is set
    const type = t.metadata?.modal_type || 'operasi'
    acc[type] = (acc[type] || 0) + Number(t.amount)
    return acc
  }, {
    operasi: 0,
    tax: 0,
    zakat: 0,
    investment: 0,
    dividend: 0,
    savings: 0,
    emergency: 0
  })

  // 2. Operating Revenue (Income excluding Modal, including negative amounts/cash out)
  const operatingRevenue = perspectiveTransactions
    ?.filter((t: any) => t.type === 'income' && statusFilter.includes(t.status) && !capitalCategories.includes(t.category))
    .reduce((sum: number, t: any) => {
      const amount = Number(t.amount)
      // Include both positive income and negative amounts (cash out/refunds)
      return sum + amount
    }, 0) || 0

  // 3. Total Expenses
  const totalExpenses = perspectiveTransactions
    ?.filter((t: any) => t.type === 'expense' && statusFilter.includes(t.status))
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

  // 4. Net Profit / Retained Earnings
  const netProfit = operatingRevenue - totalExpenses

  // 5. Cash Balance (Total Cash In - Total Cash Out)
  const cashBalance = (totalCapital + operatingRevenue) - totalExpenses

  // DETAILED REPORTING CALCULATIONS

  // Cash In By Category
  const cashInByCategory = perspectiveTransactions
    ?.filter((t: any) => t.type === 'income' && statusFilter.includes(t.status))
    .reduce((acc: any, t: any) => {
      const cat = t.category || "Lain-lain"
      acc[cat] = (acc[cat] || 0) + Number(t.amount)
      return acc
    }, {}) || {}

  // Cash Out By Category
  const cashOutByCategory = perspectiveTransactions
    ?.filter((t: any) => t.type === 'expense' && statusFilter.includes(t.status))
    .reduce((acc: any, t: any) => {
      const cat = t.category || "Lain-lain"
      acc[cat] = (acc[cat] || 0) + Number(t.amount)
      return acc
    }, {}) || {}

  // Liabilites (Tax & Zakat Payable from 7-Tabung)
  // Assuming these are accrued liabilities until paid out
  const taxPayable = operatingRevenue * (percentages.tax / 100)
  const zakatPayable = operatingRevenue * (percentages.zakat / 100)
  const totalLiabilities = taxPayable + zakatPayable

  // Assets Detailed
  const currentAssets = cashBalance
  const fixedAssets = 0
  const totalAssets = currentAssets + fixedAssets

  const calculatedEquity = totalAssets - totalLiabilities

  // 7-TABUNG ALLOCATION (Based on Net Operating Profit)

  // Calculate expenses by tabung linkage
  const zakaatCategories = ['Zakat']
  const investmentCategories = ['Kelengkapan Pejabat', 'Aset / Investment', 'Aset / Propaty', 'Bangunan', 'Kenderaan', 'Alatan Mesin', 'Hartanah', 'Saham']

  // Expenses linked to Investment Fund
  const investmentExpenses = perspectiveTransactions
    ?.filter((t: any) => t.type === 'expense' && statusFilter.includes(t.status) && investmentCategories.includes(t.category))
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

  // Expenses linked to Zakat Fund
  const zakatExpenses = perspectiveTransactions
    ?.filter((t: any) => t.type === 'expense' && statusFilter.includes(t.status) && zakaatCategories.includes(t.category))
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

  // All other expenses are standard Operating Expenses
  const operatingExpensesOnly = totalExpenses - investmentExpenses - zakatExpenses

  // DISTRIBUTION BASE: Non-modal revenue minus operating expenses
  // This represents the 100% "Profit" to be shared
  const profitToShare = operatingRevenue - operatingExpensesOnly
  const distributionBase = Math.max(0, profitToShare)
  const operatingShortfall = Math.max(0, operatingExpensesOnly - operatingRevenue)

  // 7-Tabung allocation: distribute distributionBase across all tabungs by percentage
  // Each tabung receives: (distributionBase × percentage / 100) AS AGIHAN 
  // PLUS direct modal allocations AS MODAL

  // Tax tabung
  const taxAgihan = distributionBase * (percentages.tax / 100)
  const taxModal = modalByTabung.tax || 0
  const taxAmount = taxAgihan + taxModal

  // Zakat tabung
  const zakatAgihan = distributionBase * (percentages.zakat / 100)
  const zakatModal = modalByTabung.zakat || 0
  const zakatAmount = zakatAgihan + zakatModal - zakatExpenses

  // Investment tabung
  const investmentAgihan = distributionBase * (percentages.investment / 100)
  const investmentModal = modalByTabung.investment || 0
  const investmentAmount = investmentAgihan + investmentModal - investmentExpenses

  // Dividend tabung
  const dividendAgihan = distributionBase * (percentages.dividend / 100)
  const dividendModal = modalByTabung.dividend || 0
  const dividendAmount = dividendAgihan + dividendModal

  // Savings tabung
  const savingsAgihan = distributionBase * (percentages.savings / 100)
  const savingsModal = modalByTabung.savings || 0
  const savingsAmount = savingsAgihan + savingsModal

  // Emergency tabung
  const emergencyAgihan = distributionBase * (percentages.emergency / 100)
  const emergencyModal = modalByTabung.emergency || 0
  const emergencyAmount = emergencyAgihan + emergencyModal

  // Operating tabung (Perbelanjaan)
  const operatingAgihan = distributionBase * (percentages.operating / 100)
  const operatingModal = modalByTabung.operasi || 0
  // Total = share of profit + direct modal - any expenses that exceeded revenue
  const operatingAmount = operatingAgihan + operatingModal - operatingShortfall

  const accounts = [
    {
      name: "Perbelanjaan",
      percent: `${percentages.operating}%`,
      // Actual amount based on operating transactions + capital
      amount: operatingAmount,
      agihan: operatingAgihan,
      modal: operatingModal,
      color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
      icon: Wallet,
      tag: "Actionable",
      bankKey: "operating",
      bankLabel: "Operating Account"
    },
    {
      name: "Tax",
      percent: `${percentages.tax}%`,
      // Actual amount based on tax-related transactions
      amount: taxAmount,
      agihan: taxAgihan,
      modal: taxModal,
      color: "bg-orange-50 text-orange-600 border-orange-100",
      icon: Building,
      tag: "Liability",
      bankKey: "tax",
      bankLabel: "Cukai"
    },
    {
      name: "Zakat",
      percent: `${percentages.zakat}%`,
      // Actual amount based on zakat transactions
      amount: zakatAmount,
      agihan: zakatAgihan,
      modal: zakatModal,
      color: "bg-brand-green/10 text-brand-green border-brand-green/20",
      icon: Heart,
      tag: "Do Not Touch",
      bankKey: "zakat",
      bankLabel: "Zakat"
    },
    {
      name: "Investment",
      percent: `${percentages.investment}%`,
      // Actual amount based on investment transactions
      amount: investmentAmount,
      agihan: investmentAgihan,
      modal: investmentModal,
      color: "bg-blue-50 text-blue-600 border-blue-100",
      icon: TrendingUp,
      tag: "(Aset / Property)",
      bankKey: "investment",
      bankLabel: "Pelaburan"
    },
    {
      name: "Dividend",
      percent: `${percentages.dividend}%`,
      // Actual amount based on dividend transactions
      amount: dividendAmount,
      agihan: dividendAgihan,
      modal: dividendModal,
      color: "bg-indigo-50 text-indigo-600 border-indigo-100",
      icon: Landmark,
      tag: "(For Share Holder Company)",
      bankKey: "dividend",
      bankLabel: "Dividen"
    },
    {
      name: "Savings",
      percent: `${percentages.savings}%`,
      // Actual amount based on savings transactions
      amount: savingsAmount,
      agihan: savingsAgihan,
      modal: savingsModal,
      color: "bg-purple-50 text-purple-600 border-purple-100",
      icon: PiggyBank,
      tag: "(Duplicate your Bisnes)",
      bankKey: "savings",
      bankLabel: "Simpanan"
    },
    {
      name: "Emergency",
      percent: `${percentages.emergency}%`,
      // Actual amount based on emergency fund transactions
      amount: emergencyAmount,
      agihan: emergencyAgihan,
      modal: emergencyModal,
      color: "bg-yellow-50 text-yellow-600 border-yellow-100",
      icon: ShieldAlert,
      tag: "Safety Net",
      bankKey: "emergency",
      bankLabel: "Kecemasan"
    },
  ]

  // Filter Logic
  const months = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Mac" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Jun" },
    { value: "7", label: "Julai" },
    { value: "8", label: "Ogos" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Disember" },
  ]



  const filteredTransactions = transactions?.filter((t: any) => {
    const date = new Date(t.date)
    const monthMatch = filterMonth === "all" || (date.getMonth() + 1).toString() === filterMonth
    const typeMatch = filterType === "all" || t.type === filterType
    const statusMatch = filterStatus === "all" || t.status === filterStatus

    // Search logic
    const searchLower = searchQuery.toLowerCase()
    const searchMatch = !searchQuery ||
      (t.description && t.description.toLowerCase().includes(searchLower)) ||
      (t.category && t.category.toLowerCase().includes(searchLower)) ||
      (t.amount && t.amount.toString().includes(searchLower))

    return monthMatch && typeMatch && statusMatch && searchMatch
  }) || []

  const displayedTransactions = filteredTransactions.slice(0, displayLimit)
  const hasMore = filteredTransactions.length > displayLimit

  // Bulk Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all visible transactions (applying filters)
      const allIds = filteredTransactions.map((t: any) => t.id)
      setSelectedIds(allIds)
    } else {
      setSelectedIds([])
    }
  }

  const handleSelect = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return

    if (!window.confirm(`Adakah anda pasti mahu memadam ${selectedIds.length} transaksi? Tindakan ini tidak boleh dikembalikan.`)) {
      return
    }

    setIsDeleting(true)
    try {
      // Group selected transactions by their source table
      const allTx = transactions || []
      const grouped: Record<string, number[]> = {}
      for (const id of selectedIds) {
        const tx = allTx.find((t: any) => t.id === id)
        const table = tx?.table_source || ((userRole === 'tenant' || role === 'tenant') ? 'tenant_transactions' : 'organizer_transactions')
        if (!grouped[table]) grouped[table] = []
        grouped[table].push(id)
      }

      // Delete from each table
      for (const [tableName, ids] of Object.entries(grouped)) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .in('id', ids)
        if (error) throw error
      }

      toast.success(`${selectedIds.length} transaksi telah dipadam`)
      setSelectedIds([])
      mutate()
    } catch (error: any) {
      toast.error("Gagal memadam: " + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount) {
      toast.error("Sila isi semua maklumat")
      return
    }

    setIsSaving(true)
    const amount = parseFloat(newTransaction.amount)

    try {
      let receiptUrl = null

      // Handle Receipt Logic
      if (receiptFile) {
        // New file uploaded - use new file
        const fileExt = receiptFile.name.split('.').pop()
        const fileName = `tx-${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile)

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(fileName)
          receiptUrl = publicUrl
        }
      } else if (editingTransaction && existingReceiptUrl && !removeExistingReceipt) {
        // Editing, has existing receipt, and NOT removed - keep existing
        receiptUrl = existingReceiptUrl
      }
      // If removeExistingReceipt is true or no existing receipt, receiptUrl stays null

      if (!user) {
        toast.error("Ralat: Sesi pengguna tidak sah")
        setIsSaving(false)
        return
      }

      // Determine which table to use based on role
      const isTenant = (userRole === 'tenant' || role === 'tenant')
      const isAdmin = (userRole === 'admin' || userRole === 'superadmin' || role === 'admin' || role === 'superadmin')

      let tableName: string
      if (isTenant) {
        tableName = 'tenant_transactions'
      } else if (isAdmin) {
        tableName = 'admin_transactions'
      } else {
        tableName = 'organizer_transactions'
      }

      // 1. Get or create tenant record ONLY if this is a tenant transaction
      // or if the user is a tenant role (their personal account)
      let entityId: number | null = null

      if (isTenant || tableName === 'tenant_transactions') {
        const { data: existingTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()

        if (existingTenant?.id) {
          entityId = existingTenant.id
        } else if (isTenant) {
          // Only force CREATE if the user is actually a TENANT role
          // Organizers/Admins should NOT be forced to have a tenant record
          let fullName = user.email?.split('@')[0] || 'User'
          let orgCode = null

          if (userRole === 'organizer') {
            const { data: org } = await supabase
              .from('organizers')
              .select('name, organizer_code')
              .eq('profile_id', user.id)
              .maybeSingle()
            if (org) {
              fullName = org.name
              orgCode = org.organizer_code
            }
          } else if (userRole === 'admin') {
            const { data: admin } = await supabase
              .from('admins')
              .select('full_name, organizer_code')
              .eq('profile_id', user.id)
              .maybeSingle()
            if (admin) {
              fullName = admin.full_name
              orgCode = admin.organizer_code
            }
          }

          const { data: newTenant, error: createError } = await supabase
            .from('tenants')
            .insert({
              profile_id: user.id,
              full_name: fullName,
              business_name: fullName,
              email: user.email,
              organizer_code: orgCode,
              status: 'active',
              accounting_status: 'active'
            })
            .select('id')
            .single()

          if (createError) {
            console.error('[Accounting] Error creating tenant:', createError)
            toast.error("Ralat: Gagal mencipta rekod peniaga")
            setIsSaving(false)
            return
          }
          entityId = newTenant?.id || null
        }
      }

      // Get entity IDs based on role
      let organizerId = null
      let adminId = null

      if (!isTenant && !isAdmin && user) {
        // Organizer/Staff - get organizer_id
        const { data: orgData } = await supabase
          .from('organizers')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()
        if (orgData) {
          organizerId = orgData.id
        }
      } else if (isAdmin && user) {
        // Admin - get admin_id
        const { data: adminData } = await supabase
          .from('admins')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()
        if (adminData) {
          adminId = adminData.id
        }
      }

      // Build transaction data based on role
      // Determine default status based on role
      // - Admin/Superadmin: approved (they have authority)
      // - Tenant: approved (it's their own personal Akaun)
      // - Organizer/Staff: pending (may need review)
      let defaultStatus: 'approved' | 'pending' = 'approved'

      let txData: any = {
        description: newTransaction.description,
        category: newTransaction.category || "Lain-lain",
        amount: amount,
        type: newTransaction.type,
        status: defaultStatus,
        date: newTransaction.date,
        receipt_url: receiptUrl,
        metadata: {
          ...(editingTransaction?.metadata || {}),
          modal_type: newTransaction.category.includes('Modal') ? newTransaction.modal_type : null
        }
      }

      // Add role-specific foreign keys
      if (isTenant) {
        txData.tenant_id = entityId
        // Check if this is a rent payment
        txData.is_rent_payment = newTransaction.category === 'Sewa'

        // Validate tenant ID
        if (!txData.tenant_id) {
          toast.error("Ralat: Tidak dapat mengenal pasti entiti pengguna. Sila cuba lagi.")
          setIsSaving(false)
          return
        }
      } else if (isAdmin) {
        // Admin transactions - always use profile_id (user.id) for consistency
        // admin_id may be UUID or different format, but profile_id matches auth.uid()
        txData.profile_id = user.id
        txData.admin_id = user.id // admin_id references auth.users(id), same as profile_id

        console.log('[Accounting] Saving admin transaction:', { profile_id: user.id, admin_id: txData.admin_id })
      } else {
        // Organizer/Staff transactions
        txData.organizer_id = organizerId
        txData.tenant_id = entityId // May be null for non-rent transactions
        txData.is_auto_generated = false // Manual entry

        // Validate organizer ID
        if (!txData.organizer_id) {
          toast.error("Ralat: Tidak dapat mengenal pasti organizer. Sila cuba lagi.")
          setIsSaving(false)
          return
        }
      }

      if (editingTransaction) {
        const { error } = await supabase
          .from(tableName)
          .update(txData)
          .eq('id', editingTransaction.id)

        if (error) throw error
        await logAction('UPDATE', 'transaction', editingTransaction.id, txData)
        toast.success("Transaksi berjaya dikemaskini")
      } else {
        const { data: newTx, error } = await supabase
          .from(tableName)
          .insert(txData)
          .select()
          .single()
        if (error) throw error
        await logAction('CREATE', 'transaction', newTx.id, txData)
        const successMessage = userRole === 'staff' || role === 'staff'
          ? "Transaksi direkod (Menunggu kelulusan)"
          : "Transaksi berjaya ditambah"
        toast.success(successMessage)
      }

      mutate()
      setIsDialogOpen(false)
      resetForm()

    } catch (error: any) {
      toast.error("Ralat: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: number, tableSource?: string) => {
    // Allow admin, superadmin, organizer, or tenant to delete
    const isAuthorized = userRole === "admin" || userRole === "superadmin" ||
      role === "admin" || role === "superadmin" ||
      role === "tenant" || userRole === "tenant" ||
      role === "organizer" || userRole === "organizer"

    if (!isAuthorized) {
      toast.error("Tidak dibenarkan memadam transaksi")
      return
    }

    try {
      // Use table_source from the transaction if available, otherwise fall back to role-based
      const tableName = tableSource || (
        (userRole === 'tenant' || role === 'tenant')
          ? 'tenant_transactions'
          : 'organizer_transactions'
      )

      const { error } = await supabase.from(tableName).delete().eq('id', id)
      if (error) throw error

      await logAction('DELETE', 'transaction', id, {})
      toast.success("Transaksi telah dipadam")
      mutate()
    } catch (error: any) {
      toast.error("Gagal memadam: " + error.message)
    }
  }

  const handleApproveTransaction = async (id: number, tableSource?: string) => {
    try {
      // Use table_source from the transaction if available, otherwise fall back to role-based
      const tableName = tableSource || (
        (userRole === 'tenant' || role === 'tenant')
          ? 'tenant_transactions'
          : 'organizer_transactions'
      )

      const { error } = await supabase.from(tableName).update({ status: 'approved' }).eq('id', id)
      if (error) throw error
      await logAction('APPROVE', 'transaction', id, { status: 'approved' })
      toast.success("Transaksi diluluskan")
      mutate()
    } catch (e: any) {
      toast.error("Gagal lulus: " + e.message)
    }
  }

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction)
    setNewTransaction({
      description: transaction.description || "",
      category: transaction.category || "",
      amount: transaction.amount.toString(),
      type: transaction.type,
      tenant_id: transaction.tenant_id?.toString() || "",
      date: transaction.date,
      modal_type: transaction.metadata?.modal_type || ""
    })
    // Load existing receipt if any
    setExistingReceiptUrl(transaction.receipt_url || null)
    setRemoveExistingReceipt(false)
    setReceiptFile(null)
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingTransaction(null)
    setReceiptFile(null)
    setExistingReceiptUrl(null)
    setRemoveExistingReceipt(false)
    setNewTransaction({
      description: "",
      category: "",
      amount: "",
      type: "income",
      tenant_id: "",
      date: new Date().toISOString().split('T')[0],
      modal_type: ""
    })

    // Re-fetch tenant ID if user is tenant
    if (role === 'tenant' && tenants) {
      // Find self in tenants list if possible, or just rely on init. 
      // Better: store "myTenantId" in state during init.
      // For now, simpler: user.id check
    }
  }

  // --- TIERED ACCESS LOGIC ---
  // Plan IDs from subscription-plans: enterprise, sdn-bhd, sdn-bhd-berhad
  // activePlan: undefined = loading, null = trial/no subscription, string = subscribed
  const isEnterprise = activePlan === 'enterprise' || activePlan === 'premium'
  const isSdnBhd = activePlan === 'sdn-bhd' || activePlan === 'standard'
  const isSdnBhdBerhad = activePlan === 'sdn-bhd-berhad' || activePlan === 'berhad'
  // Trial mode: when activePlan is explicitly null OR isTrial state is true
  // Note: isTrial is now properly managed by the useEffect above
  const isTrialMode = activePlan === null || isTrial
  const isAdminOrStaff = role === 'superadmin' || role === 'admin' || role === 'staff'

  // Debug logging
  console.log('[TieredAccess] Debug:', {
    activePlan,
    isEnterprise,
    isSdnBhd,
    isSdnBhdBerhad,
    isTrialMode,
    isTrial,
    isAdminOrStaff,
    role
  })

  // Enterprise = 3 tabungs. Sdn Bhd = 4 tabungs. 
  // SdnBhd/Berhad, Admin, Staff, Trial = 7 tabungs.
  // While loading (activePlan === undefined), default to 7 tabungs (will correct after load)
  const allowedTabungs = (isSdnBhdBerhad || isAdminOrStaff || isTrialMode)
    ? ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency']
    : isSdnBhd
      ? ['operating', 'tax', 'zakat', 'investment']
      : isEnterprise
        ? ['operating', 'tax', 'zakat']
        : ['operating', 'tax', 'zakat', 'investment', 'dividend', 'savings', 'emergency']

  console.log('[TieredAccess] allowedTabungs:', allowedTabungs)

  // Enterprise cannot download reports, but Sdn Bhd and SdnBhd/Berhad can
  const canDownloadReports = !isEnterprise || isAdminOrStaff

  // All accounts are shown, but some may be disabled based on subscription tier

  const currentTotalPercent = allowedTabungs.reduce((sum, key) => sum + (percentages[key as keyof typeof percentages] || 0), 0)

  // Determine plan display name for consistency with Subscription page
  const getPlanDisplayName = () => {
    // Admin always has full access - don't show trial label
    if (role === 'admin' || role === 'superadmin') return 'Admin'
    if (isSdnBhdBerhad) return 'SdnBhd/Berhad'
    if (isSdnBhd) return 'Sdn Bhd'
    if (isEnterprise) return 'Enterprise'
    if (isTrialMode || activePlan === undefined) return 'Percubaan'
    return 'Percubaan'
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-serif font-bold text-foreground leading-tight">Perakaunan</h2>
          <p className="text-muted-foreground text-lg flex items-center">
            Urus {isEnterprise ? '3 Tabung' : isSdnBhd ? '4 Tabung' : '7 Tabung'} Simpanan & Rekod Kewangan
            <Badge variant="outline" className={`ml-2 uppercase ${activePlan ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>{getPlanDisplayName()}</Badge>
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl px-6 h-12 shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-5 w-5" />
                Tambah Transaksi
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-border rounded-3xl sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-foreground font-serif">
                  {editingTransaction ? "Kemaskini Transaksi" : "Tambah Transaksi Baru"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Masukkan butiran transaksi kewangan
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Tarikh</Label>
                  <Input
                    id="date"
                    type="date"
                    className="border-input rounded-xl h-11"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  />
                </div>

                {/* Transaction Type and Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Jenis</Label>
                    <Select
                      value={newTransaction.type}
                      onValueChange={(v: "income" | "expense") => setNewTransaction({ ...newTransaction, type: v, category: "" })}
                    >
                      <SelectTrigger className="border-input rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Pendapatan</SelectItem>
                        <SelectItem value="expense">Perbelanjaan (-)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Jumlah (RM)</Label>
                    <Input
                      id="amount"
                      type="number"
                      className="border-input rounded-xl h-11"
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select
                    value={newTransaction.category}
                    onValueChange={(v) => setNewTransaction({ ...newTransaction, category: v })}
                  >
                    <SelectTrigger className="border-input rounded-xl h-11">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {newTransaction.type === 'income' ? (
                        <>
                          <SelectItem value="Jualan">Jualan</SelectItem>
                          <SelectItem value="Servis">Servis</SelectItem>
                          <SelectItem value="Modal">Modal (Capital)</SelectItem>
                          <SelectItem value="Modal Pinjaman">Modal Pinjaman</SelectItem>
                          <SelectItem value="Lain-lain">Lain-lain</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Operasi">Operasi</SelectItem>
                          <SelectItem value="Gaji & Upah">Gaji & Upah</SelectItem>
                          <SelectItem value="Gaji">Gaji</SelectItem>
                          <SelectItem value="Sewa">Sewa</SelectItem>
                          <SelectItem value="Bil">Bil</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Komisyen">Komisyen</SelectItem>
                          <SelectItem value="Pengangkutan">Pengangkutan</SelectItem>
                          <SelectItem value="Pembungkusan">Pembungkusan</SelectItem>
                          <SelectItem value="Lesen & Permit">Lesen & Permit</SelectItem>
                          <SelectItem value="Latihan">Latihan</SelectItem>
                          <SelectItem value="Fotostat">Fotostat</SelectItem>
                          <SelectItem value="Alat Tulis">Alat Tulis</SelectItem>
                          <SelectItem value="KWSP">KWSP</SelectItem>
                          <SelectItem value="EPF">EPF</SelectItem>
                          <SelectItem value="Tunai di Bank">Tunai di Bank</SelectItem>
                          <SelectItem value="Zakat">Zakat</SelectItem>
                          <SelectItem value="Kelengkapan Pejabat">Kelengkapan Pejabat (Asset)</SelectItem>
                          <SelectItem value="Aset / Investment">Aset / Investment</SelectItem>
                          <SelectItem value="Lain-lain">Lain-lain</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modal Sub-category Dropdown */}
                {newTransaction.type === 'income' && (newTransaction.category === 'Modal' || newTransaction.category === 'Modal Pinjaman') && (
                  <div className="grid gap-2 animate-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="modal_type" className="text-primary font-bold flex items-center gap-2">
                      <PiggyBank className="w-4 h-4" /> Agihan Tabung Modal
                    </Label>
                    <Select
                      value={newTransaction.modal_type || "operasi"}
                      onValueChange={(v: any) => setNewTransaction({ ...newTransaction, modal_type: v })}
                    >
                      <SelectTrigger className="border-primary/30 rounded-xl h-11 bg-primary/5">
                        <SelectValue placeholder="Pilih Tabung Agihan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operasi">Perbelanjaan (Operating)</SelectItem>

                        <SelectItem
                          value="investment"
                          disabled={isEnterprise}
                        >
                          Investment {isEnterprise && "(🔒 Perlu SdnBhd)"}
                        </SelectItem>

                        <SelectItem
                          value="savings"
                          disabled={isEnterprise || isSdnBhd}
                        >
                          Savings {(isEnterprise || isSdnBhd) && "(🔒 Perlu Berhad)"}
                        </SelectItem>

                        <SelectItem
                          value="emergency"
                          disabled={isEnterprise || isSdnBhd}
                        >
                          Emergency {(isEnterprise || isSdnBhd) && "(🔒 Perlu Berhad)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground italic px-1">
                      * Modal ini akan dimasukkan terus ke baki tabung yang dipilih.
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="description">Keterangan</Label>
                  <Input
                    id="description"
                    className="border-input rounded-xl h-11"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    placeholder="Contoh: Jualan nasi lemak / Bayar bil elektrik"
                  />
                </div>

                <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
                  <Label className="flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Muat Naik Resit
                  </Label>

                  {/* Show existing receipt with X button to remove */}
                  {existingReceiptUrl && !removeExistingReceipt && !receiptFile && (
                    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border/50">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <a
                          href={existingReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate"
                        >
                          Resit Sedia Ada
                        </a>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        onClick={() => setRemoveExistingReceipt(true)}
                        title="Buang resit"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Show message if receipt was removed */}
                  {removeExistingReceipt && !receiptFile && (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                      <span className="text-sm text-red-600">Resit akan dibuang</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-primary hover:text-primary/80"
                        onClick={() => setRemoveExistingReceipt(false)}
                      >
                        Batalkan
                      </Button>
                    </div>
                  )}

                  {/* File input for new upload */}
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    onChange={(e) => {
                      setReceiptFile(e.target.files?.[0] || null)
                      if (e.target.files?.[0]) {
                        setRemoveExistingReceipt(false) // Clear remove flag if new file selected
                      }
                    }}
                    className="h-10 pt-1.5 rounded-xl bg-secondary/20 cursor-pointer text-xs"
                  />

                  {/* Show new file info */}
                  {receiptFile && (
                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground truncate">{receiptFile.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={receiptFile.size > 10 * 1024 * 1024 ? "text-red-500 font-bold text-xs" : "text-muted-foreground text-xs"}>
                          {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setReceiptFile(null)}
                          title="Buang fail"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={isSaving}
                  onClick={handleSaveTransaction}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-2xl h-12 font-bold"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : (editingTransaction ? "Simpan Perubahan" : "Tambah Transaksi")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-border/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Wallet className="w-4 h-4 mr-2" /> {getPlanDisplayName()} Dashboard
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white relative overflow-hidden group">
            <div className="flex items-center">
              {canDownloadReports ? <FileText className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2 text-white/50" />} Laporan Kewangan
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-8">
          {/* 7-TABUNG DASHBOARD */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Card className="lg:col-span-12 bg-white border border-border/50 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
              <div className="p-10 border-b border-border/30 bg-secondary/30 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2">
                    Lebihan / (Kurangan) Tunai
                  </p>
                  <h3 className={cn(
                    "text-5xl lg:text-6xl font-sans font-black tracking-tighter",
                    cashBalance >= 0 ? "text-primary" : "text-red-600"
                  )}>
                    {cashBalance >= 0 ? '' : '- '}RM {Math.abs(cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs font-bold mb-1">Status Agihan</p>
                  <Badge className="bg-brand-green/10 text-brand-green border-none px-4 py-1 rounded-full font-bold">
                    100% DIAGIH
                  </Badge>
                  {/* Show count of configured banks based on allowed tabungs */}
                  {(() => {
                    const configuredBanks = Object.values(bankNames).filter(b => b && b.trim() !== '').length;
                    if (configuredBanks > 0) {
                      return (
                        <p className="text-xs text-muted-foreground mt-1">
                          {configuredBanks}/{allowedTabungs.length} Bank ditetapkan
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {userRole === 'superadmin' && (
                    <Dialog open={isSuperadminConfigOpen} onOpenChange={setIsSuperadminConfigOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-2 h-8 rounded-full text-xs border-dashed border-red-300 text-red-600 bg-red-50 hover:bg-red-100">
                          <Lock className="w-3 h-3 mr-1" /> Admin Control
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Kawalan Superadmin (Akaun)</DialogTitle>
                          <DialogDescription>Tetapan global untuk modul Akaun</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex items-center justify-between">
                            <Label>Akses Modul (Global)</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{systemSettings.is_active ? 'Aktif' : 'Nyahaktif'}</span>
                              <input
                                type="checkbox"
                                checked={systemSettings.is_active}
                                onChange={(e) => setSystemSettings({ ...systemSettings, is_active: e.target.checked })}
                                className="toggle"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Tempoh Percubaan (Hari)</Label>
                            <Input
                              type="number"
                              value={systemSettings.trial_duration_days}
                              onChange={(e) => setSystemSettings({ ...systemSettings, trial_duration_days: parseInt(e.target.value) })}
                            />
                            <p className="text-[10px] text-muted-foreground">Pengguna akan melihat skrin langganan selepas tempoh ini dari tarikh pendaftaran.</p>
                          </div>
                          <Button onClick={handleSaveSystemSettings} className="w-full">Simpan Perubahan Sistem</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="ml-2 h-8 w-8 text-muted-foreground hover:text-primary">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Konfigurasi Tabung</DialogTitle>
                        <DialogDescription>Tetapkan peratusan agihan untuk pelan anda.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {/* Header row */}
                        <div className="grid grid-cols-12 gap-2 items-center text-xs font-medium text-muted-foreground border-b pb-2">
                          <div className="col-span-3">Tabung</div>
                          <div className="col-span-3">Peratus (%)</div>
                          <div className="col-span-6">Nama Bank / Akaun</div>
                        </div>

                        {/* Operating */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Label className="col-span-3 text-sm">Perbelanjaan</Label>
                          <Input className="col-span-3 h-9" type="number" value={percentages.operating} onChange={(e) => setPercentages({ ...percentages, operating: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.operating} onChange={(e) => setBankNames({ ...bankNames, operating: e.target.value })} placeholder="Contoh: Maybank Business" />
                        </div>

                        {/* Tax */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Label className="col-span-3 text-sm">Tax</Label>
                          <Input className="col-span-3 h-9" type="number" value={percentages.tax} onChange={(e) => setPercentages({ ...percentages, tax: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.tax} onChange={(e) => setBankNames({ ...bankNames, tax: e.target.value })} placeholder="Contoh: LHDN / Bank Pembayar Cukai" />
                        </div>

                        {/* Zakat */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Label className="col-span-3 text-sm">Zakat</Label>
                          <Input className="col-span-3 h-9" type="number" value={percentages.zakat} onChange={(e) => setPercentages({ ...percentages, zakat: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.zakat} onChange={(e) => setBankNames({ ...bankNames, zakat: e.target.value })} placeholder="Contoh: Pusat Pungutan Zakat" />
                        </div>

                        {/* Investment */}
                        <div className={cn("grid grid-cols-12 gap-2 items-center", !allowedTabungs.includes('investment') && "opacity-50 pointer-events-none")}>
                          <Label className="col-span-3 text-sm">Investment {!allowedTabungs.includes('investment') && <Lock className="inline w-3 h-3 ml-1" />}</Label>
                          <Input className="col-span-3 h-9" type="number" value={!allowedTabungs.includes('investment') ? 0 : percentages.investment} onChange={(e) => setPercentages({ ...percentages, investment: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.investment} onChange={(e) => setBankNames({ ...bankNames, investment: e.target.value })} placeholder="Contoh: CIMB Investment Account" />
                        </div>

                        {/* Dividend */}
                        <div className={cn("grid grid-cols-12 gap-2 items-center", !allowedTabungs.includes('dividend') && "opacity-50 pointer-events-none")}>
                          <Label className="col-span-3 text-sm">Dividend {!allowedTabungs.includes('dividend') && <Lock className="inline w-3 h-3 ml-1" />}</Label>
                          <Input className="col-span-3 h-9" type="number" value={!allowedTabungs.includes('dividend') ? 0 : percentages.dividend} onChange={(e) => setPercentages({ ...percentages, dividend: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.dividend} onChange={(e) => setBankNames({ ...bankNames, dividend: e.target.value })} placeholder="Contoh: RHB Dividend Account" />
                        </div>

                        {/* Savings */}
                        <div className={cn("grid grid-cols-12 gap-2 items-center", !allowedTabungs.includes('savings') && "opacity-50 pointer-events-none")}>
                          <Label className="col-span-3 text-sm">Savings {!allowedTabungs.includes('savings') && <Lock className="inline w-3 h-3 ml-1" />}</Label>
                          <Input className="col-span-3 h-9" type="number" value={!allowedTabungs.includes('savings') ? 0 : percentages.savings} onChange={(e) => setPercentages({ ...percentages, savings: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.savings} onChange={(e) => setBankNames({ ...bankNames, savings: e.target.value })} placeholder="Contoh: Tabung Haji / ASB" />
                        </div>

                        {/* Emergency */}
                        <div className={cn("grid grid-cols-12 gap-2 items-center", !allowedTabungs.includes('emergency') && "opacity-50 pointer-events-none")}>
                          <Label className="col-span-3 text-sm">Emergency {!allowedTabungs.includes('emergency') && <Lock className="inline w-3 h-3 ml-1" />}</Label>
                          <Input className="col-span-3 h-9" type="number" value={!allowedTabungs.includes('emergency') ? 0 : percentages.emergency} onChange={(e) => setPercentages({ ...percentages, emergency: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.emergency} onChange={(e) => setBankNames({ ...bankNames, emergency: e.target.value })} placeholder="Contoh: Maybank Savings" />
                        </div>

                        <div className="flex flex-col gap-3 pt-4 border-t">
                          {/* Total and Remaining Percentage Display */}
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <p className={cn("text-sm font-bold",
                                Math.abs(currentTotalPercent - 100) < 0.1 ? "text-green-600" : "text-red-600"
                              )}>
                                Jumlah: {currentTotalPercent.toFixed(1)}%
                              </p>
                              {Math.abs(currentTotalPercent - 100) > 0.1 && (
                                <p className="text-xs text-muted-foreground">
                                  {getRemainingPercentage() > 0
                                    ? `Baki diperlukan: +${getRemainingPercentage().toFixed(1)}% untuk genap 100%`
                                    : `Lebihan: ${Math.abs(getRemainingPercentage()).toFixed(1)}% melebihi 100%`}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {Math.abs(currentTotalPercent - 100) > 0.1 && (
                                <Button
                                  onClick={handleAutoAdjustPercentages}
                                  size="sm"
                                  variant="outline"
                                  className="text-xs bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                >
                                  ✨ Genapkan 100%
                                </Button>
                              )}
                              <Button
                                onClick={handleSaveConfig}
                                size="sm"
                                disabled={Math.abs(currentTotalPercent - 100) > 0.1}
                              >
                                Simpan
                              </Button>
                            </div>
                          </div>

                          {/* Warning Message */}
                          {Math.abs(currentTotalPercent - 100) > 0.1 && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                              <span className="mt-0.5">⚠️</span>
                              <p>
                                Jumlah peratus mestilah tepat 100% untuk simpan.
                                {getRemainingPercentage() > 0
                                  ? ` Sila tambah ${getRemainingPercentage().toFixed(1)}% lagi.`
                                  : ` Sila kurangkan ${Math.abs(getRemainingPercentage()).toFixed(1)}%.`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <CardContent className="p-10 bg-white">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                  {accounts.map((acc) => {
                    const bankName = bankNames[acc.bankKey as keyof typeof bankNames];
                    const isAllowed = allowedTabungs.includes(acc.bankKey);
                    return (
                      <div key={acc.name} className={cn("space-y-3 group", !isAllowed && "opacity-40 grayscale")}>
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm border",
                            isAllowed ? "group-hover:scale-110" : "cursor-not-allowed",
                            isAllowed ? acc.color : "bg-gray-200 text-gray-500 border-gray-300",
                          )}
                          title={isAllowed ? acc.name : "Tidak termasuk dalam pelan ini - Naik taraf untuk akses"}
                        >
                          <acc.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase",
                              isAllowed ? acc.color.replace('bg-', 'bg-white/50 ') : "bg-gray-200 text-gray-500 border-gray-300"
                            )}>
                              {isAllowed ? acc.percent : "-"}
                            </span>
                            {!isAllowed && (
                              <span className="text-[8px] text-gray-500 font-medium">
                                <Lock className="w-3 h-3 inline" />
                              </span>
                            )}
                          </div>
                          <p className={cn("text-xs font-bold uppercase tracking-wide", isAllowed ? "text-muted-foreground" : "text-gray-500")}>
                            {acc.name}
                          </p>
                          <p className={cn("text-xl font-bold mt-0.5", isAllowed ? "text-foreground" : "text-gray-500")}>
                            {isAllowed ? `RM ${acc.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "-"}
                          </p>
                          {/* Portion Breakdown */}
                          {isAllowed && (Number(acc.agihan || 0) !== 0 || Number(acc.modal || 0) !== 0) && (
                            <div className="flex flex-col gap-0.5 mt-1 border-t border-dashed border-border/20 pt-1">
                              {Number(acc.agihan || 0) !== 0 && (
                                <p className="text-[9px] text-muted-foreground flex justify-between">
                                  <span>Agihan:</span>
                                  <span className="font-semibold text-primary">RM {Number(acc.agihan).toLocaleString()}</span>
                                </p>
                              )}
                              {Number(acc.modal || 0) !== 0 && (
                                <p className="text-[9px] text-muted-foreground flex justify-between">
                                  <span>Modal:</span>
                                  <span className="font-semibold text-orange-600">RM {Number(acc.modal).toLocaleString()}</span>
                                </p>
                              )}
                            </div>
                          )}
                          {/* Show bank name if set */}
                          {bankName && isAllowed && (
                            <p className="text-xs text-primary font-medium mt-0.5 break-words max-w-[120px]" title={bankName}>
                              {bankName}
                            </p>
                          )}
                          {/* Special subtitle for Operating Account */}
                          {acc.bankKey === 'operating' && (
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-medium">(Operating Account)</p>
                          )}
                          <p className={cn("text-[10px] italic mt-0.5", isAllowed ? "text-muted-foreground/60" : "text-gray-500")}>
                            {isAllowed ? acc.tag : "Naik taraf untuk akses"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white rounded-[2.5rem] border border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="p-6 md:p-10 border-b border-border/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-3xl font-serif">Senarai Transaksi</CardTitle>
                  <CardDescription className="text-muted-foreground text-lg mt-1 font-medium">
                    Rekod keluar masuk kewangan berpusat
                  </CardDescription>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Bulk Delete Button */}
                  {selectedIds.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      className="h-9 rounded-xl animate-in fade-in zoom-in duration-300"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Padam ({selectedIds.length})
                    </Button>
                  )}

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Cari transaksi..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setDisplayLimit(5) // Reset limit when searching
                      }}
                      className="pl-9 pr-4 h-9 w-[200px] bg-white border border-border/30 rounded-xl text-sm focus-visible:ring-primary"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('')
                          setDisplayLimit(5)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 bg-secondary/30 p-1.5 rounded-xl border border-border/30">
                    <Filter className="w-4 h-4 text-muted-foreground ml-2 hidden sm:block" />

                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger className="w-[100px] h-9 bg-white border-none text-xs rounded-lg shadow-sm font-medium">
                        <SelectValue placeholder="Bulan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Bulan</SelectItem>
                        {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[90px] h-9 bg-white border-none text-xs rounded-lg shadow-sm font-medium">
                        <SelectValue placeholder="Jenis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Jenis</SelectItem>
                        <SelectItem value="income">Masuk (+)</SelectItem>
                        <SelectItem value="expense">Perbelanjaan (-)</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[100px] h-9 bg-white border-none text-xs rounded-lg shadow-sm font-medium">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="approved">Lulus</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 flex justify-center text-muted-foreground">
                  <Loader2 className="animate-spin mr-2" /> Memuatkan Akaun...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow className="border-border/20 h-16 hover:bg-transparent">
                        <TableHead className="w-[50px] pl-6">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                            checked={selectedIds.length > 0 && selectedIds.length === filteredTransactions.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-widest">Tarikh</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-widest">Keterangan</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-widest text-right">Jumlah</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-widest text-center">Resit</TableHead>
                        {/* Only show Status for non-tenants */}
                        {role !== 'tenant' && (
                          <TableHead className="font-bold text-xs uppercase tracking-widest text-center">Status</TableHead>
                        )}
                        <TableHead className="px-8 font-bold text-xs uppercase tracking-widest text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedTransactions?.map((transaction: any) => {
                        const receipt = transaction.receipt_url

                        // Simple display: transactions are already in correct perspective
                        // - tenant_transactions: expenses show as 'expense' (negative)
                        // - organizer_transactions: income shows as 'income' (positive)
                        const displayType = transaction.type
                        const displaySign = transaction.type === 'income' ? '+' : '-'

                        return (
                          <TableRow
                            key={transaction.id}
                            className="border-border/10 h-20 hover:bg-secondary/10 transition-colors"
                          >
                            <TableCell className="pl-6">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                checked={selectedIds.includes(transaction.id)}
                                onChange={(e) => handleSelect(transaction.id, e.target.checked)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-muted-foreground/70" />
                                {new Date(transaction.date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-foreground">{transaction.description}</div>
                              <div className="flex flex-col gap-1 mt-1">
                                {/* Show tenant name or payer name from metadata for public payments */}
                                {transaction.tenants ? (
                                  <div className="flex items-center gap-1 text-xs text-primary font-medium">
                                    <User size={12} />
                                    {transaction.tenants.full_name}
                                  </div>
                                ) : transaction.metadata?.payer_name ? (
                                  <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                                    <User size={12} />
                                    {transaction.metadata.payer_name}
                                    <span className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded">Awam</span>
                                  </div>
                                ) : null}
                                <Badge variant="outline" className={cn(
                                  "w-fit text-[10px] py-0 h-5 border",
                                  transaction.table_source === 'tenant_payments'
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                    : "bg-slate-50 text-slate-500 border-slate-200",
                                  transaction.category.includes('Modal') && "bg-orange-50 text-orange-600 border-orange-200"
                                )}>
                                  {transaction.category}
                                  {transaction.metadata?.modal_type && (
                                    <span className="capitalize ml-1 italic opacity-80">({transaction.metadata.modal_type})</span>
                                  )}
                                  {transaction.table_source === 'tenant_payments' && " 💰"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell
                              className={`text-right font-bold text-lg ${displayType === "income" ? "text-brand-green" : "text-red-500"}`}
                            >
                              {displaySign} RM {Number(transaction.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {receipt ? (
                                <a href={receipt} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 bg-secondary rounded-lg hover:bg-secondary/80">
                                  <FileText className="w-4 h-4 text-primary" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            {/* Only show Status for non-tenants */}
                            {role !== 'tenant' && (
                              <TableCell className="text-center">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-wider",
                                    transaction.status === "approved"
                                      ? "bg-brand-green/10 text-brand-green border-brand-green/20"
                                      : "bg-orange-50 text-orange-600 border-orange-100",
                                  )}
                                >
                                  {transaction.status === "approved" ? "Diluluskan" : "Menunggu"}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="px-8 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Admin/Superadmin/Organizer: Approve */}
                                {(userRole === "admin" || userRole === "superadmin" || role === "admin" || role === "superadmin" || userRole === "organizer" || role === "organizer") && transaction.status === 'pending' && (
                                  <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm" onClick={() => handleApproveTransaction(transaction.id, transaction.table_source)} title="Luluskan">
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                )}
                                {/* Organizer: Can edit/delete their own transactions (but NOT tenant rent payments) */}
                                {(userRole === "organizer" || role === "organizer") && transaction.table_source !== 'tenant_payments' && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                      onClick={() => handleEdit(transaction)}
                                      title="Kemaskini"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all"
                                      onClick={() => handleDelete(transaction.id, transaction.table_source)}
                                      title="Padam"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {/* Staff: Edit only (if pending) */}
                                {((userRole === "staff" || role === "staff") && transaction.status === 'pending') && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                    onClick={() => handleEdit(transaction)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {/* Admin/Superadmin: Edit, Delete */}
                                {(userRole === "admin" || userRole === "superadmin" || role === "admin" || role === "superadmin") && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                      onClick={() => handleEdit(transaction)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all"
                                      onClick={() => handleDelete(transaction.id, transaction.table_source)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {/* Tenant: Can edit/delete their own transactions */}
                                {role === 'tenant' && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                      onClick={() => handleEdit(transaction)}
                                      title="Kemaskini"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all"
                                      onClick={() => handleDelete(transaction.id, transaction.table_source)}
                                      title="Padam"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {(!displayedTransactions || displayedTransactions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={role === 'tenant' ? 5 : 6} className="text-center py-12 text-muted-foreground">
                            {searchQuery ? (
                              <>
                                <p>Tiada transaksi dijumpai untuk carian &quot;{searchQuery}&quot;.</p>
                                <p className="text-xs opacity-50 mt-2">Sila cuba kata kunci lain atau kosongkan carian.</p>
                              </>
                            ) : (
                              <>
                                <p>Tiada transaksi direkodkan.</p>
                                <p className="text-xs opacity-50 mt-2">Sila tambah transaksi baru atau semak filter anda.</p>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {hasMore && (
                    <div className="p-4 border-t border-border/10 flex justify-center items-center gap-3 bg-slate-50/30">
                      <Button
                        variant="outline"
                        onClick={() => setDisplayLimit(prev => prev + 10)}
                        className="rounded-xl text-sm h-10 px-6 font-medium border-primary/20 hover:bg-primary/5 hover:text-primary"
                      >
                        Lihat Lagi <ChevronDown className="w-4 h-4 ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setDisplayLimit(filteredTransactions.length)}
                        className="rounded-xl text-sm text-muted-foreground hover:text-primary h-10 px-4"
                      >
                        Lihat Semua ({filteredTransactions.length})
                      </Button>
                    </div>
                  )}

                  {/* Show summary when all items are displayed */}
                  {!hasMore && filteredTransactions.length > 5 && (
                    <div className="p-3 border-t border-border/10 text-center text-xs text-muted-foreground bg-slate-50/30">
                      Menunjukkan kesemua {filteredTransactions.length} transaksi
                      {searchQuery && ` untuk carian "${searchQuery}"`}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

            {/* Cash Flow Statement */}
            <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50 pb-6 print:hidden">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl text-emerald-900">Penyata Aliran Tunai</CardTitle>
                    <CardDescription className="text-emerald-700/70">
                      Ringkasan kemasukan dan perbelanjaan tunai
                      {role === 'tenant' && <span className="block text-xs mt-1 text-emerald-600/70">* Termasuk transaksi yang belum disahkan</span>}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {canDownloadReports ? (
                      <Button
                        variant="outline"
                        className="flex w-full md:w-auto bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200"
                        onClick={() => {
                          const businessName = user?.user_metadata?.full_name || user?.email || 'Perniagaan'
                          const period = filterMonth !== 'all'
                            ? new Date(2024, parseInt(filterMonth) - 1).toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
                            : new Date().toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
                          generateFinancialReport({
                            businessName,
                            reportPeriod: period,
                            operatingRevenue,
                            totalCapital,
                            totalExpenses,
                            cashBalance,
                            cashInByCategory,
                            cashOutByCategory,
                            currentAssets,
                            fixedAssets,
                            totalAssets,
                            taxPayable,
                            zakatPayable,
                            totalLiabilities,
                            calculatedEquity,
                            netProfit,
                          })
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Muat Turun PDF
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled
                        className="flex w-full md:w-auto bg-slate-50 text-slate-400 border-slate-200"
                        title="Naik taraf ke pelan Sdn Bhd untuk Laporan Penuh"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Muat Turun Dikunci
                      </Button>
                    )}
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <ArrowUpRight className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Print Header */}
                <div className="hidden print:block p-8 pb-0 text-center">
                  <h1 className="text-2xl font-serif font-bold mb-2">Penyata Aliran Tunai</h1>
                  <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString('ms-MY', { year: 'numeric', month: 'long' })}</p>
                </div>
                <Table>
                  <TableBody>
                    {/* Cash Inflow */}
                    <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                      <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Aliran Masuk (Pendapatan)</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10 font-medium text-emerald-700">Jumlah Jualan & Operasi</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-emerald-700">
                        {/* Sum of all income categories except Modal */}
                        RM {operatingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    {/* Detailed Income Rows */}
                    {Object.entries(cashInByCategory).map(([cat, amount]: [string, any]) => {
                      if (cat === 'Modal') return null; // Skip Modal, shown separately
                      return (
                        <TableRow key={cat} className="hover:bg-transparent border-0 h-8">
                          <TableCell className="pl-16 text-xs text-muted-foreground py-1">• {cat}</TableCell>
                          <TableCell className="text-right pr-10 text-xs text-muted-foreground py-1 font-mono">
                            {Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    <TableRow className="border-t border-dashed">
                      <TableCell className="pl-10 font-medium">Modal & Pembiayaan</TableCell>
                      <TableCell className="text-right pr-10 font-mono">
                        RM {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-dashed">
                      <TableCell className="pl-6 font-bold">Jumlah Tunai Masuk</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-emerald-600">
                        RM {(operatingRevenue + totalCapital).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>

                    {/* Cash Outflow */}
                    <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                      <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Aliran Keluar (Cash Out)</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10 font-medium text-red-600">Jumlah Perbelanjaan</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-red-500">
                        (RM {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </TableCell>
                    </TableRow>
                    {/* Detailed Expense Rows */}
                    {Object.entries(cashOutByCategory).map(([cat, amount]: [string, any]) => (
                      <TableRow key={cat} className="hover:bg-transparent border-0 h-8">
                        <TableCell className="pl-16 text-xs text-muted-foreground py-1">• {cat}</TableCell>
                        <TableCell className="text-right pr-10 text-xs text-muted-foreground py-1 font-mono">
                          ({Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Net Flow */}
                    <TableRow className="bg-emerald-900 text-white hover:bg-emerald-900/90">
                      <TableCell className="pl-6 py-6 font-bold text-lg">Lebihan / (Kurangan) Tunai</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-xl font-mono">
                        RM {cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Balance Sheet (Simplified) */}
            <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-blue-50/50 border-b border-blue-100/50 pb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl text-blue-900">Kunci Kira-Kira</CardTitle>
                    <CardDescription className="text-blue-700/70">Kedudukan kewangan semasa (Aset = Liabiliti + Ekuiti)</CardDescription>
                  </div>
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {/* Assets */}
                    <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                      <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Aset (Assets)</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Aset Semasa (Tunai di Tangan/Bank)</TableCell>
                      <TableCell className="text-right pr-10 font-mono">
                        RM {currentAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Aset Tetap (Fixed Assets)</TableCell>
                      <TableCell className="text-right pr-10 font-mono">
                        RM {fixedAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t bg-blue-50/30">
                      <TableCell className="pl-6 font-bold text-blue-900">Jumlah Aset</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-blue-900">
                        RM {totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>

                    {/* Liabiliti */}
                    <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                      <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Liabiliti (Liabilities)</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Cukai Belum Bayar (Accrued Tax)</TableCell>
                      <TableCell className="text-right pr-10 font-mono text-orange-600">
                        RM {taxPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Zakat Belum Bayar (Accrued Zakat)</TableCell>
                      <TableCell className="text-right pr-10 font-mono text-orange-600">
                        RM {zakatPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t bg-orange-50/30">
                      <TableCell className="pl-6 font-bold text-orange-900">Jumlah Liabiliti</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-orange-900">
                        RM {totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>

                    {/* Equity */}
                    <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                      <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Ekuiti Pemilik (Owner's Equity)</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Modal Pusingan</TableCell>
                      <TableCell className="text-right pr-10 font-mono">
                        RM {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Untung Bersih Terkumpul (Retained Earnings)</TableCell>
                      <TableCell className={cn("text-right pr-10 font-mono", (calculatedEquity - totalCapital) < 0 ? "text-red-500" : "text-emerald-600")}>
                        RM {(calculatedEquity - totalCapital).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-900 text-white hover:bg-slate-900/90 print:bg-black/90">
                      <TableCell className="pl-6 py-6 font-bold text-lg">Jumlah Ekuiti & Liabiliti</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-xl font-mono">
                        RM {(totalLiabilities + calculatedEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Analisis Untung Rugi Ringkas (Profit & Loss) - Only for Sdn Bhd and above */}
            {!isEnterprise && (
              <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] overflow-hidden print:w-full print:break-inside-avoid shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
                <CardHeader className="bg-amber-50/50 border-b border-amber-100/50 pb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="font-serif text-2xl text-amber-900">Analisis Untung Rugi Ringkas</CardTitle>
                      <CardDescription className="text-amber-700/70">Ringkasan pendapatan dan perbelanjaan operasi</CardDescription>
                    </div>
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <TrendingUp className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                        <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Pendapatan (Revenue)</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-10 font-medium">Jumlah Pendapatan Operasi</TableCell>
                        <TableCell className="text-right pr-10 font-mono text-emerald-600">
                          RM {operatingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                        <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Perbelanjaan (Expenses)</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-10 font-medium text-red-600">Jumlah Kos Operasi & Lain-lain</TableCell>
                        <TableCell className="text-right pr-10 font-mono text-red-500">
                          (RM {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                        </TableCell>
                      </TableRow>
                      <TableRow className={cn("text-white hover:text-white/90 print:text-black print:bg-slate-100", netProfit >= 0 ? "bg-amber-600 hover:bg-amber-600/90" : "bg-red-600 hover:bg-red-600/90")}>
                        <TableCell className="pl-6 py-6 font-bold text-lg">Untung / (Rugi) Bersih</TableCell>
                        <TableCell className="text-right pr-10 font-bold text-xl font-mono">
                          RM {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

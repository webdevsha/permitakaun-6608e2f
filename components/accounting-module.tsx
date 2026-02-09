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
  X
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
import { SubscriptionNotification } from "@/components/subscription-notification"
import { useAuth } from "@/components/providers/auth-provider"
import { logAction } from "@/utils/logging"


export function AccountingModule({ initialTransactions, tenants }: { initialTransactions?: any[], tenants?: any[] }) {
  const { role, user, isLoading: authLoading } = useAuth()
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
  const [isSaving, setIsSaving] = useState(false)

  // Filtering & Pagination State
  const [filterMonth, setFilterMonth] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [displayLimit, setDisplayLimit] = useState<number>(5)

  const [newTransaction, setNewTransaction] = useState({
    description: "",
    category: "",
    amount: "",
    type: "income" as "income" | "expense",
    tenant_id: "",
    date: new Date().toISOString().split('T')[0]
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

      // Safety timeout - force loading to false after 8 seconds
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.error('[Accounting] TIMEOUT - forcing loading to false')
          setIsLoading(false)
        }
      }, 8000)

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
        if (role === 'superadmin' || role === 'admin' || role === 'staff') {
          console.log('[Accounting] Privileged role - instant access')
          setAccessDeniedStatus(null)
          setIsModuleVerified(true)
          setIsLoading(false)
          return
        }

        // For organizers/tenants - simple check
        if (role === 'organizer') {
          try {
            const { data: organizer } = await supabase
              .from('organizers')
              .select('accounting_status')
              .eq('profile_id', user.id)
              .maybeSingle()

            // Grant access if accounting is active
            if (organizer?.accounting_status === 'active') {
              console.log('[Accounting] Organizer with active accounting')
              setAccessDeniedStatus(null)
              setIsModuleVerified(true)
              setIsLoading(false)
              return
            }
          } catch (e) {
            console.error('[Accounting] Error checking organizer:', e)
          }

          // FALLBACK: If they are also a TENANT, allow access (don't block on organizer trial)
          // This fixes the issue where hybrid users (Organizer + Tenant) get blocked by trial logic
          try {
            // We can check if they have a tenant record
            const { data: tenantProfile } = await supabase
              .from('tenants')
              .select('id')
              .eq('profile_id', user.id)
              .maybeSingle()

            if (tenantProfile) {
              console.log('[Accounting] User is also a Tenant - bypassing organizer trial check')
              setAccessDeniedStatus(null)
              setIsModuleVerified(true)
              setIsLoading(false)
              return
            }
          } catch (e) {
            console.error('[Accounting] Error checking tenant status:', e)
          }

          // Check trial as fallback
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('created_at')
              .eq('id', user.id)
              .maybeSingle()

            if (profile) {
              const daysRemaining = 14 - Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
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
            console.error('[Accounting] Error checking trial:', e)
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
    // Validate total 100%
    const total = Object.values(percentages).reduce((a, b) => a + b, 0)
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

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" />Menyemak kelayakan...</div>
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

  // For tenants, include pending transactions in calculations (it's their own Akaun)
  // For organizers/admins, only count approved transactions
  // Use 'role' from auth (available immediately) rather than userRole state
  const isTenantRole = role === 'tenant'
  const statusFilter = isTenantRole ? ['approved', 'pending'] : ['approved']

  // 1. Paid Up Capital (Modal)
  const totalCapital = perspectiveTransactions
    ?.filter((t: any) => t.type === 'income' && statusFilter.includes(t.status) && t.category === 'Modal')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

  // 2. Operating Revenue (Income excluding Modal, including negative amounts/cash out)
  const operatingRevenue = perspectiveTransactions
    ?.filter((t: any) => t.type === 'income' && statusFilter.includes(t.status) && t.category !== 'Modal')
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

  // 7-TABUNG ALLOCATION (Based on Operating Revenue)
  const accounts = [
    {
      name: "Operating Account",
      percent: `${percentages.operating}%`,
      amount: operatingRevenue * (percentages.operating / 100),
      color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
      icon: Wallet,
      tag: "Actionable",
      bankKey: "operating",
      bankLabel: "Operating"
    },
    {
      name: "Tax",
      percent: `${percentages.tax}%`,
      amount: operatingRevenue * (percentages.tax / 100),
      color: "bg-orange-50 text-orange-600 border-orange-100",
      icon: Building,
      tag: "Liability",
      bankKey: "tax",
      bankLabel: "Cukai"
    },
    {
      name: "Zakat",
      percent: `${percentages.zakat}%`,
      amount: operatingRevenue * (percentages.zakat / 100),
      color: "bg-brand-green/10 text-brand-green border-brand-green/20",
      icon: Heart,
      tag: "Do Not Touch",
      bankKey: "zakat",
      bankLabel: "Zakat"
    },
    {
      name: "Investment",
      percent: `${percentages.investment}%`,
      amount: operatingRevenue * (percentages.investment / 100),
      color: "bg-blue-50 text-blue-600 border-blue-100",
      icon: TrendingUp,
      tag: "Growth",
      bankKey: "investment",
      bankLabel: "Pelaburan"
    },
    {
      name: "Dividend",
      percent: `${percentages.dividend}%`,
      amount: operatingRevenue * (percentages.dividend / 100),
      color: "bg-indigo-50 text-indigo-600 border-indigo-100",
      icon: Landmark,
      tag: "Growth",
      bankKey: "dividend",
      bankLabel: "Dividen"
    },
    {
      name: "Savings",
      percent: `${percentages.savings}%`,
      amount: operatingRevenue * (percentages.savings / 100),
      color: "bg-purple-50 text-purple-600 border-purple-100",
      icon: PiggyBank,
      tag: "Growth",
      bankKey: "savings",
      bankLabel: "Simpanan"
    },
    {
      name: "Emergency",
      percent: `${percentages.emergency}%`,
      amount: operatingRevenue * (percentages.emergency / 100),
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
    return monthMatch && typeMatch && statusMatch
  }) || []

  const displayedTransactions = filteredTransactions.slice(0, displayLimit)
  const hasMore = filteredTransactions.length > displayLimit

  const handleSaveTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount) {
      toast.error("Sila isi semua maklumat")
      return
    }

    setIsSaving(true)
    const amount = parseFloat(newTransaction.amount)

    try {
      let receiptUrl = null

      // Upload Receipt
      if (receiptFile) {
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
      }

      if (!user) {
        toast.error("Ralat: Sesi pengguna tidak sah")
        setIsSaving(false)
        return
      }

      // Get or create tenant record for transaction
      let entityId: number | null = null

      // Check for existing tenant
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (existingTenant?.id) {
        entityId = existingTenant.id
      } else {
        // Need to create tenant record - get user details based on role
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
        } else if (userRole === 'staff') {
          const { data: staff } = await supabase
            .from('staff')
            .select('full_name, organizer_code')
            .eq('profile_id', user.id)
            .maybeSingle()
          if (staff) {
            fullName = staff.full_name
            orgCode = staff.organizer_code
          }
        }

        // Create tenant record
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

      // Determine which table to use based on role
      const isTenant = (userRole === 'tenant' || role === 'tenant')
      const tableName = isTenant ? 'tenant_transactions' : 'organizer_transactions'

      // Get organizer_id for organizer/staff/admin transactions
      let organizerId = null
      if (!isTenant && user) {
        const { data: orgData } = await supabase
          .from('organizers')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()
        if (orgData) {
          organizerId = orgData.id
        }
      }

      // Build transaction data based on role
      // Determine default status based on role
      // - Admin/Superadmin: approved (they have authority)
      // - Tenant: approved (it's their own personal Akaun)
      // - Organizer/Staff: pending (may need review)
      let defaultStatus: 'approved' | 'pending' = 'pending'
      if (userRole === 'admin' || userRole === 'superadmin' || role === 'admin' || role === 'superadmin') {
        defaultStatus = 'approved'
      } else if (role === 'tenant' || userRole === 'tenant') {
        defaultStatus = 'approved' // Tenant's own transactions are auto-approved
      }

      let txData: any = {
        description: newTransaction.description,
        category: newTransaction.category || "Lain-lain",
        amount: amount,
        type: newTransaction.type,
        status: defaultStatus,
        date: newTransaction.date,
        receipt_url: receiptUrl
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
      } else {
        // Organizer/Staff/Admin transactions
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

  const handleDelete = async (id: number) => {
    // Allow admin, superadmin, or tenant to delete
    const isAuthorized = userRole === "admin" || userRole === "superadmin" ||
      role === "admin" || role === "superadmin" ||
      role === "tenant" || userRole === "tenant"

    if (!isAuthorized) {
      toast.error("Tidak dibenarkan memadam transaksi")
      return
    }

    try {
      // Determine which table to delete from based on role
      const tableName = (userRole === 'tenant' || role === 'tenant')
        ? 'tenant_transactions'
        : 'organizer_transactions'

      const { error } = await supabase.from(tableName).delete().eq('id', id)
      if (error) throw error

      await logAction('DELETE', 'transaction', id, {})
      toast.success("Transaksi telah dipadam")
      mutate()
    } catch (error: any) {
      toast.error("Gagal memadam: " + error.message)
    }
  }

  const handleApproveTransaction = async (id: number) => {
    try {
      // Determine which table to update based on role
      const tableName = (userRole === 'tenant' || role === 'tenant')
        ? 'tenant_transactions'
        : 'organizer_transactions'

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
      date: transaction.date
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingTransaction(null)
    setReceiptFile(null)
    setNewTransaction({
      description: "",
      category: "",
      amount: "",
      type: "income",
      tenant_id: "",
      date: new Date().toISOString().split('T')[0]
    })

    // Re-fetch tenant ID if user is tenant
    if (role === 'tenant' && tenants) {
      // Find self in tenants list if possible, or just rely on init. 
      // Better: store "myTenantId" in state during init.
      // For now, simpler: user.id check
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Subscription Notification for Organizers and Tenants */}
      {(role === 'organizer' || role === 'tenant') && <SubscriptionNotification />}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-serif font-bold text-foreground leading-tight">Perakaunan</h2>
          <p className="text-muted-foreground text-lg">Urus 7 Tabung Simpanan & Rekod Kewangan</p>
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
                        <SelectItem value="income">Cash In</SelectItem>
                        <SelectItem value="expense">Cash Out</SelectItem>
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
                          <SelectItem value="Modal">Modal (Capital)</SelectItem>
                          <SelectItem value="Jualan">Jualan</SelectItem>
                          <SelectItem value="Servis">Servis</SelectItem>
                          <SelectItem value="Lain-lain">Lain-lain</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Operasi">Operasi</SelectItem>
                          <SelectItem value="Sewa">Sewa</SelectItem>
                          <SelectItem value="Bil">Bil</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Gaji">Gaji</SelectItem>
                          <SelectItem value="Lain-lain">Lain-lain</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

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
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="h-10 pt-1.5 rounded-xl bg-secondary/20 cursor-pointer text-xs"
                  />
                  {receiptFile && (
                    <div className="flex items-center justify-between text-[10px] mt-1">
                      <span className={receiptFile.size > 10 * 1024 * 1024 ? "text-red-500 font-bold" : "text-muted-foreground"}>
                        Saiz: {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB
                        {receiptFile.size > 10 * 1024 * 1024 && " (Fail besar, mungkin mengambil masa)"}
                      </span>
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
            <Wallet className="w-4 h-4 mr-2" /> 7-Tabung Dashboard
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" /> Laporan Kewangan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-8">
          {/* 7-TABUNG DASHBOARD */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Card className="lg:col-span-12 bg-white border border-border/50 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
              <div className="p-10 border-b border-border/30 bg-secondary/30 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2">
                    Jumlah Pendapatan Operasi (Revenue)
                  </p>
                  <h3 className="text-5xl lg:text-6xl font-sans font-black tracking-tighter text-primary">
                    RM {operatingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-none px-2 py-0.5 rounded-md text-xs font-bold">
                      + RM {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 0 })} Modal
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs font-bold mb-1">Status Agihan</p>
                  <Badge className="bg-brand-green/10 text-brand-green border-none px-4 py-1 rounded-full font-bold">
                    100% DIAGIH
                  </Badge>
                  {/* Show count of configured banks */}
                  {(() => {
                    const configuredBanks = Object.values(bankNames).filter(b => b && b.trim() !== '').length;
                    if (configuredBanks > 0) {
                      return (
                        <p className="text-xs text-muted-foreground mt-1">
                          {configuredBanks}/7 Bank ditetapkan
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
                        <DialogTitle>Konfigurasi 7-Tabung</DialogTitle>
                        <DialogDescription>Tetapkan peratusan agihan dan nama bank untuk setiap tabung.</DialogDescription>
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
                          <Label className="col-span-3 text-sm">Operating</Label>
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
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Label className="col-span-3 text-sm">Investment</Label>
                          <Input className="col-span-3 h-9" type="number" value={percentages.investment} onChange={(e) => setPercentages({ ...percentages, investment: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.investment} onChange={(e) => setBankNames({ ...bankNames, investment: e.target.value })} placeholder="Contoh: CIMB Investment Account" />
                        </div>

                        {/* Dividend */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Label className="col-span-3 text-sm">Dividend</Label>
                          <Input className="col-span-3 h-9" type="number" value={percentages.dividend} onChange={(e) => setPercentages({ ...percentages, dividend: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.dividend} onChange={(e) => setBankNames({ ...bankNames, dividend: e.target.value })} placeholder="Contoh: RHB Dividend Account" />
                        </div>

                        {/* Savings */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Label className="col-span-3 text-sm">Savings</Label>
                          <Input className="col-span-3 h-9" type="number" value={percentages.savings} onChange={(e) => setPercentages({ ...percentages, savings: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.savings} onChange={(e) => setBankNames({ ...bankNames, savings: e.target.value })} placeholder="Contoh: Tabung Haji / ASB" />
                        </div>

                        {/* Emergency */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Label className="col-span-3 text-sm">Emergency</Label>
                          <Input className="col-span-3 h-9" type="number" value={percentages.emergency} onChange={(e) => setPercentages({ ...percentages, emergency: Number(e.target.value) })} />
                          <Input className="col-span-6 h-9" type="text" value={bankNames.emergency} onChange={(e) => setBankNames({ ...bankNames, emergency: e.target.value })} placeholder="Contoh: Maybank Savings" />
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                          <p className={cn("text-xs font-bold",
                            (percentages.operating + percentages.tax + percentages.zakat + percentages.investment + percentages.dividend + percentages.savings + percentages.emergency) === 100 ? "text-green-600" : "text-red-600"
                          )}>
                            Jumlah: {(percentages.operating + percentages.tax + percentages.zakat + percentages.investment + percentages.dividend + percentages.savings + percentages.emergency).toFixed(1)}%
                          </p>
                          <Button onClick={handleSaveConfig} size="sm">Simpan</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <CardContent className="p-10 bg-white">

                {/* Paid Up Capital Section */}
                <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center text-slate-600">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Modal Pusingan (Paid Up Capital)</p>
                    <p className="text-2xl font-bold text-slate-800">
                      RM {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-slate-400">Modal suntikan pemilik & pelabur (Tidak termasuk dalam agihan 7-Tabung)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                  {accounts.map((acc) => {
                    const bankName = bankNames[acc.bankKey as keyof typeof bankNames];
                    return (
                      <div key={acc.name} className="space-y-3 group">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm border",
                            acc.color,
                          )}
                        >
                          <acc.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase", acc.color.replace('bg-', 'bg-white/50 '))}>
                              {acc.percent}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            {acc.name}
                          </p>
                          <p className="text-lg font-bold text-foreground mt-0.5">
                            RM {acc.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          {/* Show bank name if set */}
                          {bankName && (
                            <p className="text-[9px] text-primary font-medium truncate" title={bankName}>
                              {bankName}
                            </p>
                          )}
                          <p className="text-[9px] text-muted-foreground/60 italic">
                            {acc.tag}
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

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
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
                        <SelectItem value="expense">Keluar (-)</SelectItem>
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
                  <Loader2 className="animate-spin mr-2" /> Memuatkan data...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow className="border-border/20 h-16 hover:bg-transparent">
                        <TableHead className="px-8 font-bold text-xs uppercase tracking-widest">Tarikh</TableHead>
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
                            <TableCell className="px-8 font-mono text-xs text-muted-foreground">
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
                                <Badge variant="outline" className="w-fit text-[10px] py-0 h-5 bg-slate-50 text-slate-500 border-slate-200">
                                  {transaction.category}
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
                                  <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm" onClick={() => handleApproveTransaction(transaction.id)} title="Luluskan">
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                )}
                                {/* Organizer: Can edit/delete their own transactions */}
                                {(userRole === "organizer" || role === "organizer") && (
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
                                      onClick={() => handleDelete(transaction.id)}
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
                                      onClick={() => handleDelete(transaction.id)}
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
                                      onClick={() => handleDelete(transaction.id)}
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
                            <p>Tiada transaksi direkodkan.</p>
                            <p className="text-xs opacity-50 mt-2">Sila tambah transaksi baru atau semak filter anda.</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {hasMore && (
                    <div className="p-4 border-t border-border/10 flex justify-center bg-slate-50/30">
                      <Button
                        variant="ghost"
                        onClick={() => setDisplayLimit(prev => prev + 5)}
                        className="rounded-xl text-xs text-muted-foreground hover:text-primary h-10 px-6 font-medium"
                      >
                        Lihat Lagi ({filteredTransactions.length - displayLimit} lagi) <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
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
              <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50 pb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl text-emerald-900">Penyata Aliran Tunai</CardTitle>
                    <CardDescription className="text-emerald-700/70">
                      Ringkasan kemasukan dan perbelanjaan tunai
                      {isTenantRole && <span className="block text-xs mt-1 text-emerald-600/70">* Termasuk transaksi yang belum disahkan</span>}
                    </CardDescription>
                  </div>
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <ArrowUpRight className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {/* Cash Inflow */}
                    <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                      <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Aliran Masuk (Cash In)</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Jualan & Operasi</TableCell>
                      <TableCell className="text-right pr-10 font-mono">
                        RM {operatingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Modal & Pembiayaan</TableCell>
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
                      <TableCell className="pl-10">Perbelanjaan Operasi</TableCell>
                      <TableCell className="text-right pr-10 font-mono text-red-500">
                        (RM {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </TableCell>
                    </TableRow>

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
                      <TableCell className="pl-10">Tunai di Tangan / Bank</TableCell>
                      <TableCell className="text-right pr-10 font-mono">
                        RM {cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="pl-6 font-bold">Jumlah Aset</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-blue-600">
                        RM {cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>

                    {/* Equity & Liabilities */}
                    <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                      <TableCell className="font-bold py-4 pl-6 text-muted-foreground uppercase text-xs tracking-wider">Ekuiti & Liabiliti</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Modal Pusingan</TableCell>
                      <TableCell className="text-right pr-10 font-mono">
                        RM {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-10">Untung Bersih (Retained Earnings)</TableCell>
                      <TableCell className={cn("text-right pr-10 font-mono", netProfit < 0 ? "text-red-500" : "text-emerald-600")}>
                        {netProfit < 0 ? `(RM ${Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })})` : `RM ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-900 text-white hover:bg-slate-900/90">
                      <TableCell className="pl-6 py-6 font-bold text-lg">Jumlah Ekuiti</TableCell>
                      <TableCell className="text-right pr-10 font-bold text-xl font-mono">
                        RM {(totalCapital + netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

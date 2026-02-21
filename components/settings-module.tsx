"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import { cn } from "@/lib/utils"
import { Loader2, Upload, FileText, Check, Database, Download, Trash2, RefreshCw, Shield, ShieldAlert, HardDrive, Pencil, X, Utensils, FolderOpen, Users, Lock, UserPlus, Activity, ScrollText, PlusCircle, Pencil as PencilIcon, XCircle, CheckCircle, BookOpen, CreditCard } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PaymentSettings } from "@/components/settings-toggle"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { clearAllSetupData } from "@/app/setup/actions"
import { AddStaffDialog } from "@/components/add-staff-dialog"
import { SubscriptionTab } from "@/components/subscription-tab"
import { AdminSubscriptionsTab } from "@/components/admin-subscriptions-tab"

// Helper component defined outside to prevent re-renders causing focus loss
const DataField = ({
  label,
  value,
  field,
  placeholder,
  isEditing,
  onChange
}: {
  label: string,
  value: string,
  field: string,
  placeholder?: string,
  isEditing: boolean,
  onChange: (field: string, val: string) => void
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    {isEditing ? (
      <Input
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        className="border-border bg-white"
        placeholder={placeholder}
      />
    ) : (
      <div className="p-3 bg-secondary/10 rounded-xl border border-transparent font-medium min-h-[2.75rem] flex items-center text-sm">
        {value || <span className="text-muted-foreground italic text-xs">Belum ditetapkan</span>}
      </div>
    )}
  </div>
)

export function SettingsModule({ initialProfile, initialBackups, trialPeriodDays = 14, currentUser, serverRole }: { initialProfile?: any, initialBackups?: any[], trialPeriodDays?: number, currentUser?: any, serverRole?: string | null }) {
  const { user, role: clientRole } = useAuth()
  // Use server-provided role if available, otherwise fall back to client-side role
  const role = serverRole || clientRole
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [entityId, setEntityId] = useState<number | string | null>(null)

  // Calculate Trial Status
  const getTrialStatus = (createdAtDate: string) => {
    const created = new Date(createdAtDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    // Logic: created at is day 0? exact logic matters. Using ceil diff.
    // If trial is 14 days. Diff needs to be <= 14.
    const remaining = trialPeriodDays - diffDays

    return {
      daysUsed: diffDays,
      daysRemaining: remaining > 0 ? remaining : 0,
      isExpired: remaining <= 0,
      startDate: created.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
    }
  }

  const myTrialStatus = currentUser ? getTrialStatus(currentUser.created_at) : null

  // Check if this is admin@kumim.my - they don't need subscription
  const isAdminExempt = user?.email === 'admin@kumim.my' || user?.email === 'admin@permit.com' || role === 'admin' || role === 'superadmin' || role === 'staff'

  // Account Status State
  const [accountStatus, setAccountStatus] = useState<'trial' | 'active' | 'expired'>('trial')
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null)

  // Fetch subscription status for tenant/organizer (skip for admin users)
  useEffect(() => {
    if (!user?.id || !role || (role !== 'tenant' && role !== 'organizer')) return

    // Skip subscription check for admin exempt users
    if (isAdminExempt) {
      setAccountStatus('active')
      setSubscriptionEndDate('Lifetime Admin Access')
      return
    }

    const checkSubscription = async () => {
      try {
        let hasActive = false

        if (role === 'tenant') {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('id, accounting_status')
            .eq('profile_id', user.id)
            .single()

          if (tenant?.accounting_status === 'active') {
            hasActive = true
          } else {
            // Check for approved payments
            const { data: payments } = await supabase
              .from('tenant_transactions')
              .select('date, status')
              .eq('tenant_id', tenant?.id)
              .eq('category', 'Langganan')
              .eq('status', 'approved')
              .order('date', { ascending: false })
              .limit(1)

            if (payments && payments.length > 0) {
              hasActive = true
              // Calculate end date
              const lastPayment = new Date(payments[0].date)
              const endDate = new Date(lastPayment)
              endDate.setDate(endDate.getDate() + 30)
              setSubscriptionEndDate(endDate.toLocaleDateString('ms-MY'))
            }
          }
        } else if (role === 'organizer') {
          const { data: organizer } = await supabase
            .from('organizers')
            .select('id, accounting_status')
            .eq('profile_id', user.id)
            .single()

          if (organizer?.accounting_status === 'active') {
            hasActive = true
          } else {
            const { data: payments } = await supabase
              .from('organizer_transactions')
              .select('date, status')
              .eq('organizer_id', organizer?.id)
              .eq('category', 'Langganan')
              .eq('status', 'approved')
              .order('date', { ascending: false })
              .limit(1)

            if (payments && payments.length > 0) {
              hasActive = true
              const lastPayment = new Date(payments[0].date)
              const endDate = new Date(lastPayment)
              endDate.setDate(endDate.getDate() + 30)
              setSubscriptionEndDate(endDate.toLocaleDateString('ms-MY'))
            }
          }
        }

        if (hasActive) {
          setAccountStatus('active')
        } else if (myTrialStatus?.isExpired) {
          setAccountStatus('expired')
        } else {
          setAccountStatus('trial')
        }
      } catch (error) {
        console.error('Error checking subscription:', error)
      }
    }

    checkSubscription()
  }, [user?.id, role, myTrialStatus?.isExpired, isAdminExempt])

  // UI State
  const [isEditing, setIsEditing] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Profile State
  const [formData, setFormData] = useState({
    fullName: initialProfile?.full_name || "",
    businessName: initialProfile?.business_name || "",
    email: initialProfile?.email || user?.email || "",
    phone: initialProfile?.phone_number || "",
    organizerCode: initialProfile?.organizer_code || "",
    ssmNumber: initialProfile?.ssm_number || "",
    icNumber: initialProfile?.ic_number || "",
    address: initialProfile?.address || "",
    bankName: initialProfile?.bank_name || "",
    bankAccountNumber: initialProfile?.bank_account_number || "",
    bankAccountHolder: initialProfile?.bank_account_holder || ""
  })

  const [files, setFiles] = useState<{
    profile?: File,
    ssm?: File,
    food?: File,
    other?: File
  }>({})

  const [urls, setUrls] = useState({
    profile: initialProfile?.profile_image_url || "",
    ssm: initialProfile?.ssm_file_url || "",
    food: initialProfile?.food_handling_cert_url || "",
    other: initialProfile?.other_docs_url || ""
  })

  // Backup State
  const [backups, setBackups] = useState<any[]>(initialBackups || [])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)

  useEffect(() => {
    if (initialProfile) {
      setEntityId(initialProfile.id)
    }
  }, [initialProfile])

  const fetchBackups = async () => {
    setLoadingBackups(true)
    const { data, error } = await supabase.storage.from('backups').list('', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })

    if (!error && data) {
      setBackups(data)
    }
    setLoadingBackups(false)
  }

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    try {
      const { data, error } = await supabase.functions.invoke('system-backup')
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      toast.success("Backup berjaya dicipta!")
      fetchBackups()
    } catch (e: any) {
      toast.error("Gagal backup: " + e.message)
    } finally {
      setCreatingBackup(false)
    }
  }



  // Password Update State
  const [passwordForm, setPasswordForm] = useState({ new: "", confirm: "" })
  const [updatingPassword, setUpdatingPassword] = useState(false)

  const handleUpdatePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error("Kata laluan baru dan pengesahan tidak sepadan")
      return
    }
    if (passwordForm.new.length < 6) {
      toast.error("Kata laluan mesti sekurang-kurangnya 6 aksara")
      return
    }

    setUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new })
      if (error) throw error
      toast.success("Kata laluan berjaya ditukar")
      setPasswordForm({ new: "", confirm: "" })
    } catch (e: any) {
      toast.error("Gagal menukar kata laluan: " + e.message)
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleDownloadBackup = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('backups').download(fileName)
      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error("Gagal muat turun: " + e.message)
    }
  }

  const handleDeleteBackup = async (fileName: string) => {
    if (!confirm("Adakah anda pasti mahu memadam backup ini?")) return

    try {
      const { error } = await supabase.storage.from('backups').remove([fileName])
      if (error) throw error

      toast.success("Backup dipadam")
      setBackups(prev => prev.filter(b => b.name !== fileName))
    } catch (e: any) {
      toast.error("Gagal padam: " + e.message)
    }
  }

  const handleClearData = async () => {
    if (!confirm("⚠️ AMARAN: Ini akan memadam SEMUA data (Lokasi, Peniaga, Penganjur) kecuali Akaun Pengguna. Data tidak boleh dikembalikan. Adakah anda pasti?")) return

    setLoading(true)
    try {
      const res = await clearAllSetupData()
      if (res.success) {
        if (res.warning) {
          toast.warning(res.warning, { duration: 6000 })
        }

        const counts = res.counts || { tenant_transactions: 0, organizer_transactions: 0, rentals: 0, tenants: 0, locations: 0, organizers: 0 }
        const totalTransactions = (counts.tenant_transactions || 0) + (counts.organizer_transactions || 0)
        const totalDeleted = totalTransactions + (counts.rentals || 0) + (counts.tenants || 0) + (counts.locations || 0) + (counts.organizers || 0)

        if (totalDeleted === 0 && !res.warning) {
          toast.info("Tiada data untuk dipadam.")
        } else {
          toast.success(`Berjaya memadam: ${totalTransactions} Transaksi, ${counts.organizers || 0} Penganjur, ${counts.tenants || 0} Peniaga, ${counts.locations || 0} Lokasi, ${counts.rentals || 0} Sewaan.`)
        }

        // Optional: refresh page or data
        window.location.reload()
      } else {
        toast.error("Gagal memadam data: " + res.error)
      }
    } catch (e: any) {
      toast.error("Ralat: " + e.message)
    } finally {
      setLoading(false)
    }
  }

  // --- USER MANAGEMENT (SUPERADMIN ONLY) ---
  const [usersList, setUsersList] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // --- LOGS STATE ---
  const [logs, setLogs] = useState<any[]>([])

  const fetchUsers = async () => {
    setLoadingUsers(true)

    // For staff, only show users from their organization
    if (role === 'staff') {
      // Get organizer_code from staff table (not profiles)
      const { data: staffData } = await supabase.from('staff').select('organizer_code').eq('profile_id', user?.id).single()
      console.log('[Settings] Staff fetchUsers - organizer_code from staff table:', staffData?.organizer_code)
      if (staffData?.organizer_code) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('organizer_code', staffData.organizer_code)
          .neq('role', 'superadmin')
          .order('created_at', { ascending: false })
        console.log('[Settings] Staff users fetched:', data?.length || 0)
        if (data) setUsersList(data)
      } else {
        console.warn('[Settings] Staff has no organizer_code in staff table - showing empty list')
        setUsersList([])
      }
      setLoadingUsers(false)
      return
    }

    // For admin, show users from their organization only
    if (role === 'admin') {
      // Get organizer_code from admins table
      const { data: adminData } = await supabase.from('admins').select('organizer_code').eq('profile_id', user?.id).single()
      console.log('[Settings] Admin fetchUsers - organizer_code from admins table:', adminData?.organizer_code)
      if (adminData?.organizer_code) {
        let query = supabase
          .from('profiles')
          .select('*')
          .eq('organizer_code', adminData.organizer_code)
          .neq('role', 'superadmin')
          .order('created_at', { ascending: false })

        // Also exclude hidden demo users for cleaner view
        if (user?.email === 'admin@kumim.my') {
          const hiddenEmails = [
            'admin@permit.com',
            'organizer@permit.com',
            'staff@permit.com',
            'rafisha92@gmail.com',
            'nurshafiranoh@gmail.com',
            'hai@shafiranoh.com',
            'nshfnoh@proton.me'
          ]
          query = query.not('email', 'in', `(${hiddenEmails.map(e => `"${e}"`).join(',')})`)
        }

        const { data } = await query
        console.log('[Settings] Admin users fetched:', data?.length || 0)
        if (data) setUsersList(data)
      } else {
        console.warn('[Settings] Admin has no organizer_code in admins table - showing empty list')
        setUsersList([])
      }
      setLoadingUsers(false)
      return
    }

    // For superadmin, show all users
    let query = supabase.from('profiles').select('*').neq('role', 'superadmin').order('created_at', { ascending: false })

    // SPECIAL RULE for Hazman (admin@kumim.my):
    // Hide all "Seed/Demo" users so he starts with a clean list.
    // He should only see his own staff (e.g. manjaya.solution) and new users.
    if (user?.email === 'admin@kumim.my') {
      const hiddenEmails = [
        'admin@permit.com',
        'organizer@permit.com',
        'staff@permit.com',
        'rafisha92@gmail.com',
        'siti@permit.com',
        'ahmad@permit.com',
        'nurshafiranoh@gmail.com',
        'hai@shafiranoh.com',
        'nshfnoh@proton.me',
        'admin@klpasar.com',
        'admin@uptown.com'
      ]
      query = query.not('email', 'in', `(${hiddenEmails.map(e => `"${e}"`).join(',')})`)
    }

    const { data } = await query
    if (data) setUsersList(data)
    setLoadingUsers(false)
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
      if (error) throw error
      toast.success(`Role updated to ${newRole}`)
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (e: any) {
      toast.error("Failed to update role: " + e.message)
    }
  }

  // State for editing trial date
  const [editingTrialUser, setEditingTrialUser] = useState<string | null>(null)
  const [newTrialDate, setNewTrialDate] = useState<string>("")

  const handleUpdateTrialDate = async (userId: string, newDate: string) => {
    try {
      // Update the user's created_at to the new trial start date
      const { error } = await supabase
        .from('profiles')
        .update({ created_at: new Date(newDate).toISOString() })
        .eq('id', userId)

      if (error) throw error
      toast.success(`Tarikh mula percubaan dikemaskini`)
      fetchUsers() // Refresh the list
      setEditingTrialUser(null)
      setNewTrialDate("")
    } catch (e: any) {
      toast.error("Gagal mengemaskini: " + e.message)
    }
  }

  // Fetch users when tab becomes active (admin/superadmin/staff)
  useEffect(() => {
    if (role === 'superadmin' || role === 'admin' || role === 'staff') {
      fetchUsers()
    }
  }, [role])

  // Fetch logs for admin/superadmin
  useEffect(() => {
    if (role === 'admin' || role === 'superadmin') {
      supabase.from('action_logs').select('*, profiles(email, full_name, role)').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
        if (data) setLogs(data)
      })
    }
  }, [role])

  // --- TAMBAH PENGGUNA (ADMIN/ORGANIZER ONLY) ---
  const MAX_STAFF = 2
  const [canAddUsers, setCanAddUsers] = useState(false)
  const [checkingSubscription, setCheckingSubscription] = useState(true)
  const [staffCount, setStaffCount] = useState(0)
  const [userOrgCode, setUserOrgCode] = useState<string | null>(null)
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "staff" as "staff" | "tenant"
  })
  const [creatingUser, setCreatingUser] = useState(false)

  // Check subscription status and staff count
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setCheckingSubscription(false)
        return
      }

      // Fetch current staff count from staff table (not profiles)
      let staffQuery = supabase.from('staff').select('id', { count: 'exact' })

      if (role === 'organizer') {
        // Get organizer code
        const { data: org } = await supabase.from('organizers').select('organizer_code').eq('profile_id', user.id).maybeSingle()
        if (org?.organizer_code) {
          staffQuery = staffQuery.eq('organizer_code', org.organizer_code)
          setUserOrgCode(org.organizer_code)
        }
      } else if (role === 'admin') {
        // For admin, get organizer_code from admins table
        const { data: adminData } = await supabase.from('admins').select('organizer_code').eq('profile_id', user.id).single()
        if (adminData?.organizer_code) {
          staffQuery = staffQuery.eq('organizer_code', adminData.organizer_code)
          setUserOrgCode(adminData.organizer_code)
        }
      }

      const { count } = await staffQuery
      setStaffCount(count || 0)

      // Check if reached limit
      const hasReachedLimit = (count || 0) >= MAX_STAFF

      // Admins, superadmins, and staff can always add users IF they haven't reached limit
      if (role === 'admin' || role === 'superadmin' || role === 'staff') {
        setCanAddUsers(!hasReachedLimit)
        setCheckingSubscription(false)
        return
      }

      // Organizers need to check subscription AND limit
      if (role !== 'organizer') {
        setCanAddUsers(false)
        setCheckingSubscription(false)
        return
      }

      if (hasReachedLimit) {
        setCanAddUsers(false)
        setCheckingSubscription(false)
        return
      }

      // For organizers, check if they have Sdn Bhd or higher subscription
      try {
        const { data } = await supabase.from('organizers').select('id').eq('profile_id', user.id).maybeSingle()
        const entityId = data?.id

        if (!entityId) {
          setCanAddUsers(false)
          setCheckingSubscription(false)
          return
        }

        // Check for active Sdn Bhd or higher subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', entityId)
          .eq('status', 'active')
          .gt('end_date', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Allow if they have Standard (Sdn Bhd) or Premium (SdnBhd/Berhad) plan
        const allowedPlans = ['standard', 'sdn bhd', 'premium', 'sdnbhd/ berhad', 'sdnbhd', 'berhad']
        setCanAddUsers(subscription && allowedPlans.includes(subscription.plan_type?.toLowerCase()))
      } catch (e) {
        console.error("Subscription check error:", e)
        setCanAddUsers(false)
      } finally {
        setCheckingSubscription(false)
      }
    }

    checkAccess()
  }, [user, role, supabase])

  const handleCreateUser = async () => {
    if (!canAddUsers) {
      toast.error("Anda perlu melanggan pelan Sdn Bhd atau lebih tinggi untuk menambah pengguna.")
      return
    }

    if (!newUserForm.email || !newUserForm.password || !newUserForm.fullName) {
      toast.error("Sila isi semua medan wajib")
      return
    }

    if (newUserForm.password.length < 6) {
      toast.error("Kata laluan mesti sekurang-kurangnya 6 aksara")
      return
    }

    setCreatingUser(true)
    try {
      // Get organizer code if admin/organizer
      let organizerCode = null
      if (role === 'organizer') {
        const { data } = await supabase.from('organizers').select('organizer_code').eq('profile_id', user?.id).maybeSingle()
        organizerCode = data?.organizer_code
      }

      // Call the admin action to create user
      const { createStaffAccount } = await import('@/actions/admin')
      const formData = new FormData()
      formData.append('email', newUserForm.email)
      formData.append('password', newUserForm.password)
      formData.append('fullName', newUserForm.fullName)
      formData.append('role', newUserForm.role)
      if (organizerCode) formData.append('organizerCode', organizerCode)

      const result = await createStaffAccount(formData)

      if (result.error) {
        throw new Error(result.error)
      }

      toast.success("Pengguna berjaya ditambah!")
      setNewUserForm({ email: "", password: "", fullName: "", role: "staff" })
      fetchUsers() // Refresh user list
    } catch (e: any) {
      toast.error("Gagal menambah pengguna: " + e.message)
    } finally {
      setCreatingUser(false)
    }
  }

  // --- AUDIT LOGS (ADMIN/STAFF ONLY) ---
  const [loadingLogs, setLoadingLogs] = useState(false)

  const fetchLogs = async () => {
    setLoadingLogs(true)
    const { data, error } = await supabase
      .from('action_logs')
      .select('*, profiles(email, full_name, role)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setLogs(data)
    }
    setLoadingLogs(false)
  }

  const handleDeleteLog = async (id: number) => {
    if (role !== 'admin' && role !== 'superadmin') return
    if (!confirm("Padam log ini?")) return

    const { error } = await supabase.from('action_logs').delete().eq('id', id)
    if (error) {
      toast.error("Gagal padam log")
    } else {
      toast.success("Log dipadam")
      fetchLogs()
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <CheckCircle className="text-green-500 w-4 h-4" />
      case 'UPDATE': return <PencilIcon className="text-blue-500 w-4 h-4" />
      case 'DELETE': return <Trash2 className="text-red-500 w-4 h-4" />
      case 'APPROVE': return <CheckCircle className="text-green-600 w-4 h-4" />
      default: return <ScrollText className="text-gray-500 w-4 h-4" />
    }
  }

  // Fetch logs when tab becomes active
  useEffect(() => {
    if (role === 'superadmin' || role === 'admin' || role === 'staff') {
      fetchLogs()
    }
  }, [role])

  const handleFileUpload = async (file: File, prefix: string) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${prefix}-${user?.id}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('tenant-docs')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('tenant-docs')
      .getPublicUrl(fileName)

    return publicUrl
  }

  const handleSaveProfile = async () => {
    if (!user) return

    // Strict Validation: Alphabets, space, and slash only
    const nameRegex = /^[A-Za-z\s\/]+$/
    if (formData.fullName && !nameRegex.test(formData.fullName)) {
      toast.error("Nama Penuh hanya boleh mengandungi Huruf, Ruang (Space), dan Slash (/) sahaja.")
      return
    }

    setSaving(true)
    console.log('[SettingsModule] handleSaveProfile starting...', { role, entityId, userId: user.id })
    try {
      let newUrls = { ...urls }

      // 1. Common Update: Profiles Table (Primary source for Full Name)
      if (formData.fullName) {
        console.log('[SettingsModule] Updating profiles table...')
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: formData.fullName })
          .eq('id', user.id)

        if (profileError) {
          console.error('[SettingsModule] Profile update error:', profileError)
          throw profileError
        }
      }

      // 2. Role-Specific Updates
      console.log('[SettingsModule] Processing role-specific updates for:', role)

      if (role === 'tenant') {
        // Upload files (Tenants Only)
        if (files.profile) newUrls.profile = await handleFileUpload(files.profile, 'profile')
        if (files.ssm) newUrls.ssm = await handleFileUpload(files.ssm, 'ssm')
        if (files.food) newUrls.food = await handleFileUpload(files.food, 'food')
        if (files.other) newUrls.other = await handleFileUpload(files.other, 'other')

        const payload = {
          full_name: formData.fullName,
          business_name: formData.businessName || null,
          phone_number: formData.phone || null,
          ssm_number: formData.ssmNumber || null,
          ic_number: formData.icNumber || null,
          address: formData.address || null,
          profile_image_url: newUrls.profile || null,
          ssm_file_url: newUrls.ssm || null,
          food_handling_cert_url: newUrls.food || null,
          other_docs_url: newUrls.other || null
        }

        if (entityId) {
          console.log('[SettingsModule] Updating tenants table with entityId:', entityId)
          const { error } = await supabase.from('tenants').update(payload).eq('id', entityId)
          if (error) {
            console.error('[SettingsModule] Tenant update error:', error)
            throw error
          }
        } else {
          console.warn('[SettingsModule] No entityId for tenant - update skipped')
        }
      }
      else if (role === 'organizer') {
        const payload = {
          name: formData.businessName || formData.fullName, // Organizer name usually business name
          phone: formData.phone || null,
          email: formData.email
        }
        if (entityId) {
          console.log('[SettingsModule] Updating organizers table with entityId:', entityId)
          const { error } = await supabase.from('organizers').update(payload).eq('id', entityId)
          if (error) {
            console.error('[SettingsModule] Organizer update error:', error)
            throw error
          }
        }
      }
      else if (role === 'admin') {
        const payload = {
          full_name: formData.fullName,
          business_name: formData.businessName || null,
          phone_number: formData.phone || null,
          address: formData.address || null,
          ssm_number: formData.ssmNumber || null,
          bank_name: formData.bankName || null,
          bank_account_number: formData.bankAccountNumber || null,
          bank_account_holder: formData.bankAccountHolder || null
        }
        if (entityId) {
          console.log('[SettingsModule] Updating admins table with entityId:', entityId)
          const { error } = await supabase.from('admins').update(payload).eq('id', entityId)
          if (error) {
            console.error('[SettingsModule] Admin update error:', error)
            throw error
          }
        }
      }
      else if (role === 'staff') {
        if (entityId) {
          console.log('[SettingsModule] Updating staff table with entityId:', entityId)
          const { error } = await supabase.from('staff').update({ full_name: formData.fullName }).eq('id', entityId)
          if (error) {
            console.error('[SettingsModule] Staff update error:', error)
            throw error
          }
        }
      }

      setUrls(newUrls)
      setFiles({}) // Reset file inputs
      setIsEditing(false) // Switch back to read-only
      toast.success("Profil berjaya dikemaskini")

    } catch (err: any) {
      console.error('[SettingsModule] handleSaveProfile Error:', err)
      toast.error("Ralat Menyimpan Profil: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, val: string) => {
    setFormData(prev => ({ ...prev, [field]: val }))
  }

  if (!isMounted) return null
  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground leading-tight">Tetapan</h2>
          <p className="text-muted-foreground text-lg">Urus profil dan konfigurasi sistem</p>
        </div>
        <Link href="/dashboard/help">
          <Button variant="outline" className="rounded-xl">
            <BookOpen className="w-4 h-4 mr-2" /> Panduan
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-white border border-border/50 p-1 rounded-xl mb-6 flex-wrap">
          <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-2" /> Profil Saya
          </TabsTrigger>
          {(role === 'admin' || role === 'superadmin' || role === 'staff' || isAdminExempt) && (
            <TabsTrigger value="backup" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <Database className="w-4 h-4 mr-2" /> Backup & Sistem
            </TabsTrigger>
          )}
          {(role === 'admin' || role === 'superadmin' || role === 'staff' || isAdminExempt) && (
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" /> Pengurusan Pengguna
            </TabsTrigger>
          )}
          {(role === 'admin' || role === 'superadmin' || isAdminExempt) && (
            <TabsTrigger value="subscriptions" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-2" /> Langganan
            </TabsTrigger>
          )}
          {(role === 'organizer' || role === 'tenant') && !isAdminExempt && (
            <TabsTrigger value="subscription" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-2" /> Langganan
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="flex justify-between items-center max-w-5xl">
            <h3 className="text-xl font-bold">Maklumat Akaun</h3>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="rounded-xl shadow-sm">
                <Pencil className="w-4 h-4 mr-2" /> Edit Profil
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl">
                  <X className="w-4 h-4 mr-2" /> Batal
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-6 font-bold shadow-lg shadow-primary/20"
                >
                  {saving ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2 h-4 w-4" />}
                  Simpan
                </Button>
              </div>
            )}
          </div>


          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            {/* Status Card */}
            {myTrialStatus && (
              <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden lg:col-span-3 bg-gradient-to-r from-blue-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-primary font-serif flex items-center gap-2">
                    <Shield className="w-5 h-5" /> Status Akaun & Langganan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start md:items-center">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Tarikh Mula Percubaan</p>
                      <p className="font-mono text-lg font-medium">{myTrialStatus.startDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Status Akaun</p>
                      <div className="flex items-center gap-2">
                        {role === 'admin' || role === 'staff' || role === 'superadmin' ? (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200">
                            Full System Access
                          </span>
                        ) : isAdminExempt ? (
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                            Admin Access - No Subscription Required
                          </span>
                        ) : accountStatus === 'active' ? (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                            Akaun Aktif (Langganan)
                          </span>
                        ) : accountStatus === 'expired' ? (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">
                            Tamat Tempoh
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                            Percubaan Percuma ({myTrialStatus?.daysRemaining || 0} hari lagi)
                          </span>
                        )}
                      </div>
                    </div>
                    {(role === 'tenant' || role === 'organizer') && !isAdminExempt && (
                      <div className="md:ml-auto">
                        <div className="text-right">
                          {accountStatus === 'active' ? (
                            <>
                              <p className="text-sm font-medium text-green-600">Langganan Aktif</p>
                              {subscriptionEndDate && (
                                <p className="text-xs text-muted-foreground">Sehingga {subscriptionEndDate}</p>
                              )}
                            </>
                          ) : accountStatus === 'expired' ? (
                            <>
                              <p className="text-2xl font-bold text-red-600">0</p>
                              <p className="text-xs text-muted-foreground">Hari Baki</p>
                            </>
                          ) : (
                            <>
                              <p className="text-2xl font-bold text-primary">{myTrialStatus?.daysRemaining || 0}</p>
                              <p className="text-xs text-muted-foreground">Hari Baki</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Info */}
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-primary font-serif">Maklumat Perniagaan</CardTitle>
                <CardDescription>Butiran rasmi untuk rekod sewaan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DataField label="Nama Penuh (Seperti IC)" value={formData.fullName} field="fullName" isEditing={isEditing} onChange={handleInputChange} />
                  <DataField label="Emel" value={formData.email} field="email" placeholder="email@example.com" isEditing={isEditing} onChange={handleInputChange} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {role === 'organizer' && formData.organizerCode && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Kod Penganjur (Hanya Baca)</label>
                      <div className="font-medium text-lg text-primary">{formData.organizerCode}</div>
                      <p className="text-xs text-muted-foreground">Berikan kod ini kepada peniaga/penyewa anda.</p>
                    </div>
                  )}
                  {(role === 'tenant' || role === 'organizer' || role === 'admin') && (
                    <DataField label="No. Telefon" value={formData.phone} field="phone" isEditing={isEditing} onChange={handleInputChange} />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(role === 'tenant' || role === 'organizer' || role === 'admin') && (
                    <DataField label="Nama Perniagaan / Syarikat" value={formData.businessName} field="businessName" isEditing={isEditing} onChange={handleInputChange} />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(role === 'tenant' || role === 'admin') && (
                    <DataField label="No. Pendaftaran SSM" value={formData.ssmNumber} field="ssmNumber" placeholder="Contoh: 202401001234" isEditing={isEditing} onChange={handleInputChange} />
                  )}
                  {role === 'tenant' && (
                    <DataField label="No. Kad Pengenalan" value={formData.icNumber} field="icNumber" placeholder="Contoh: 880101-14-1234" isEditing={isEditing} onChange={handleInputChange} />
                  )}
                </div>

                {(role === 'tenant' || role === 'admin') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DataField label="Alamat Surat Menyurat" value={formData.address} field="address" isEditing={isEditing} onChange={handleInputChange} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bank Details Card (Admin Only) */}
            {role === 'admin' && (
              <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-primary font-serif flex items-center gap-2">
                    <CreditCard className="w-5 h-5" /> Maklumat Bank
                  </CardTitle>
                  <CardDescription>Butiran akaun bank untuk urusan rasmi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DataField label="Nama Bank" value={formData.bankName} field="bankName" placeholder="Contoh: Maybank, CIMB" isEditing={isEditing} onChange={handleInputChange} />
                    <DataField label="No. Akaun Bank" value={formData.bankAccountNumber} field="bankAccountNumber" placeholder="Contoh: 1234567890" isEditing={isEditing} onChange={handleInputChange} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DataField label="Nama Pemegang Akaun" value={formData.bankAccountHolder} field="bankAccountHolder" placeholder="Nama pada akaun bank" isEditing={isEditing} onChange={handleInputChange} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Change Password Card */}
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-primary font-serif flex items-center gap-2">
                  <Lock className="w-5 h-5" /> Keselamatan Akaun
                </CardTitle>
                <CardDescription>Tukar kata laluan akaun anda</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Kata Laluan Baru</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                      placeholder="••••••"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Sahkan Kata Laluan</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                      placeholder="••••••"
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleUpdatePassword}
                    disabled={updatingPassword || !passwordForm.new}
                    className="bg-slate-800 text-white hover:bg-slate-700 rounded-xl"
                  >
                    {updatingPassword ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Shield className="mr-2 h-4 w-4" />}
                    Tukar Kata Laluan
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Documents & Photo */}


            {/* Documents & Photo (Tenant Only) */}
            {role === 'tenant' && (
              <div className="space-y-6">
                {/* Profile Photo */}
                <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-primary font-serif text-lg">Gambar Profil</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center gap-4">
                      <div className={`relative w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-border bg-secondary/30 flex items-center justify-center group ${isEditing ? 'cursor-pointer hover:bg-secondary/50' : ''}`}>
                        {files.profile ? (
                          <Image src={URL.createObjectURL(files.profile)} alt="Preview" fill className="object-cover" />
                        ) : urls.profile ? (
                          <Image src={urls.profile} alt="Current" fill className="object-cover" />
                        ) : (
                          <Upload className="text-muted-foreground" />
                        )}
                        {isEditing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="text-white w-6 h-6" />
                          </div>
                        )}
                        {isEditing && (
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => e.target.files && setFiles({ ...files, profile: e.target.files[0] })}
                          />
                        )}
                      </div>
                      {isEditing && <p className="text-xs text-muted-foreground text-center">Klik untuk tukar gambar</p>}
                    </div>
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-primary font-serif text-lg">Dokumen Sokongan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* SSM */}
                    <div className="space-y-2">
                      <Label className="text-xs">Sijil SSM (PDF/Gambar)</Label>
                      <div className="flex gap-2 items-center">
                        {isEditing ? (
                          <Input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => e.target.files && setFiles({ ...files, ssm: e.target.files[0] })}
                            className="text-xs h-9 bg-white"
                          />
                        ) : (
                          <div className="flex-1 p-2 bg-secondary/10 rounded-lg text-xs italic text-muted-foreground border">
                            {urls.ssm ? "Fail dimuat naik" : "Tiada fail"}
                          </div>
                        )}
                        {urls.ssm && (
                          <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => window.open(urls.ssm, '_blank')}>
                            <FileText size={14} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Food Handling */}
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Utensils size={12} /> Sijil Pengendalian Makanan</Label>
                      <div className="flex gap-2 items-center">
                        {isEditing ? (
                          <Input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => e.target.files && setFiles({ ...files, food: e.target.files[0] })}
                            className="text-xs h-9 bg-white"
                          />
                        ) : (
                          <div className="flex-1 p-2 bg-secondary/10 rounded-lg text-xs italic text-muted-foreground border">
                            {urls.food ? "Fail dimuat naik" : "Tiada fail"}
                          </div>
                        )}
                        {urls.food && (
                          <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => window.open(urls.food, '_blank')}>
                            <FileText size={14} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Other Docs */}
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><FolderOpen size={12} /> Dokumen Sokongan Lain</Label>
                      <div className="flex gap-2 items-center">
                        {isEditing ? (
                          <Input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => e.target.files && setFiles({ ...files, other: e.target.files[0] })}
                            className="text-xs h-9 bg-white"
                          />
                        ) : (
                          <div className="flex-1 p-2 bg-secondary/10 rounded-lg text-xs italic text-muted-foreground border">
                            {urls.other ? "Fail dimuat naik" : "Tiada fail"}
                          </div>
                        )}
                        {urls.other && (
                          <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => window.open(urls.other, '_blank')}>
                            <FileText size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {(role === 'admin' || role === 'superadmin' || role === 'staff' || isAdminExempt) && (
          <TabsContent value="backup" className="space-y-6">
            {/* Payment Settings (Admin/Superadmin/AdminExempt Only) */}
            {(role === 'admin' || role === 'superadmin' || isAdminExempt) && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-serif font-semibold">Tetapan Pembayaran & Percubaan</h2>
                </div>
                <PaymentSettings />
              </div>
            )}

            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/30">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl flex items-center gap-2">
                      <HardDrive className="text-primary w-6 h-6" /> Pangkalan Data Backup
                    </CardTitle>
                    <CardDescription>Urus salinan backup database sistem</CardDescription>
                  </div>
                  <Button
                    onClick={handleCreateBackup}
                    disabled={creatingBackup}
                    className="rounded-xl shadow-md"
                  >
                    {creatingBackup ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Create Backup Now
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingBackups ? (
                  <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : (
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow>
                        <TableHead className="pl-6">File Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.length > 0 ? backups.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="pl-6 font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            {file.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {(file.metadata?.size / 1024).toFixed(2)} KB
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(file.created_at).toLocaleString('ms-MY')}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleDownloadBackup(file.name)}>
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteBackup(file.name)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                            Tiada backup dijumpai. Sila cipta backup baru.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {(role === 'admin' || role === 'superadmin' || role === 'staff') && (
              <Card className="bg-red-50 border-red-100 shadow-sm rounded-[1.5rem] overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-red-700 font-serif flex items-center gap-2">
                    <Trash2 className="w-6 h-6" /> Zon Bahaya
                  </CardTitle>
                  <CardDescription className="text-red-600/80">
                    Tindakan ini tidak boleh dikembalikan. Sila berhati-hati.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={handleClearData}
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    🗑️ Padam SEMUA Data (Reset Sistem)
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Audit Logs Section */}
            {(role === 'admin' || role === 'superadmin') && (
              <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden mt-6">
                <CardHeader className="bg-secondary/10 border-b border-border/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="font-serif text-2xl flex items-center gap-2">
                        <Activity className="text-primary w-6 h-6" /> Audit Logs
                      </CardTitle>
                      <CardDescription>Rekod aktiviti pengguna dan sistem.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={async () => {
                      const { data } = await supabase.from('action_logs').select('*, profiles(email, full_name, role)').order('created_at', { ascending: false }).limit(100)
                      setLogs(data || [])
                    }}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow>
                        <TableHead className="pl-6">Masa</TableHead>
                        <TableHead>Pengguna</TableHead>
                        <TableHead>Tindakan</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Butiran</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tiada rekod aktiviti.</TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log: any) => (
                          <TableRow key={log.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap pl-6">
                              {new Date(log.created_at).toLocaleString('ms-MY')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{log.profiles?.full_name || "Unknown"}</span>
                                <span className="text-[10px] text-muted-foreground">{log.profiles?.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize text-sm font-medium text-foreground/80">
                              {log.resource} <span className="text-xs text-muted-foreground ml-1">#{log.resource_id}</span>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs font-mono text-slate-500">
                              {JSON.stringify(log.details)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {(role === 'admin' || role === 'superadmin' || isAdminExempt) && (
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/30">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl flex items-center gap-2">
                      <Shield className="text-primary w-6 h-6" /> Pengurusan Pengguna (Staf)
                    </CardTitle>
                    <CardDescription>Urus akses dan akaun staf untuk organisasi anda.</CardDescription>
                  </div>
                  <AddStaffDialog organizerCode={userOrgCode} currentStaffCount={staffCount} maxStaff={MAX_STAFF} />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {usersList.filter((u: any) => u.role === 'staff').length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {usersList.filter((u: any) => u.role === 'staff').map((staff: any) => (
                      <div key={staff.id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold">
                            {staff.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{staff.full_name || staff.email}</p>
                            <p className="text-xs text-muted-foreground">{staff.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Aktif</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium">Tiada staf didaftarkan.</p>
                    <p className="text-sm">Klik "Tambah Staf" untuk mula mendaftar staf baru.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Show detailed user management for staff and superadmin (not admin/isAdminExempt which have their own simpler view above) */}
        {(role === 'superadmin' || role === 'staff') && !isAdminExempt && (
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/30">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl flex items-center gap-2">
                      <Users className="text-primary w-6 h-6" /> Pengurusan Staff
                    </CardTitle>
                    <CardDescription>Semakan dan urus peranan pengguna ({usersList.length} Pengguna)</CardDescription>
                  </div>
                  <Button onClick={fetchUsers} disabled={loadingUsers} variant="outline" size="sm">
                    <RefreshCw className={cn("w-4 h-4 mr-2", loadingUsers && "animate-spin")} /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="pl-6">Email</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Role Semasa</TableHead>
                      <TableHead>Trial / Tarikh Mula</TableHead>
                      {role === 'superadmin' && <TableHead className="text-right pr-6">Tukar Role</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersList.map((usr) => (
                      <TableRow key={usr.id}>
                        <TableCell className="pl-6 font-medium">{usr.email}</TableCell>
                        <TableCell>{usr.full_name || '-'}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-1 rounded-full border",
                            usr.role === 'admin' ? "bg-red-50 text-red-600 border-red-100" :
                              usr.role === 'staff' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                usr.role === 'organizer' ? "bg-purple-50 text-purple-600 border-purple-100" :
                                  usr.role === 'superadmin' ? "bg-zinc-800 text-white border-zinc-700" :
                                    "bg-green-50 text-green-600 border-green-100"
                          )}>
                            {usr.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {editingTrialUser === usr.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="date"
                                  value={newTrialDate}
                                  onChange={(e) => setNewTrialDate(e.target.value)}
                                  className="h-7 text-xs w-32"
                                />
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleUpdateTrialDate(usr.id, newTrialDate)}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    setEditingTrialUser(null)
                                    setNewTrialDate("")
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-mono text-muted-foreground">{new Date(usr.created_at).toLocaleDateString('ms-MY')}</span>
                                {(() => {
                                  const status = getTrialStatus(usr.created_at)
                                  if (['admin', 'superadmin', 'staff'].includes(usr.role)) return <span className="text-[10px] text-green-600 font-bold">Privileged</span>
                                  return status.isExpired
                                    ? <span className="text-[10px] text-red-600 font-bold">Expired ({Math.abs(status.daysRemaining)}d ago)</span>
                                    : <span className="text-[10px] text-blue-600 font-bold">{status.daysRemaining} days left</span>
                                })()}
                                {(role === 'admin' || role === 'superadmin') && !['admin', 'superadmin', 'staff'].includes(usr.role) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 w-fit"
                                    onClick={() => {
                                      setEditingTrialUser(usr.id)
                                      setNewTrialDate(new Date(usr.created_at).toISOString().split('T')[0])
                                    }}
                                  >
                                    <Pencil className="w-3 h-3 mr-1" /> Edit Tarikh
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        {role === 'superadmin' && (
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <select
                                className="text-xs border rounded p-1"
                                value={usr.role}
                                onChange={(e) => handleUpdateRole(usr.id, e.target.value)}
                                disabled={usr.email === 'admin@permit.com' || (usr.role === 'superadmin' && usr.email === 'rafisha92@gmail.com')}
                              >
                                <option value="tenant">Tenant</option>
                                <option value="organizer">Organizer</option>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                                <option value="superadmin">Superadmin</option>
                              </select>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Role Legend */}
                <div className="p-4 bg-slate-50 border-t border-border/30 text-xs text-muted-foreground">
                  <p className="font-bold mb-2">Panduan Peranan (Role):</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> <b>Tenant</b>: Peniaga/Penyewa. Akses terhad kepada dashboard sewa & akaun.</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span> <b>Organizer</b>: Penganjur tapak. Menguruskan peniaga di bawah mereka.</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> <b>Staff</b>: Membantu Admin. Akses membaca data, tidak boleh ubah tetapan kritikal.</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> <b>Admin</b>: Pentadbir Utama Sistem. Akses penuh kecuali module Superadmin.</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-800"></span> <b>Superadmin</b>: Developer/Owner. Akses ke database keys, user roles, dan server cache.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/30">
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <Database className="text-orange-500 w-5 h-5" /> System Health & Cache
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-orange-900">Clear System Cache</p>
                    <p className="text-xs text-orange-800/70">Force refresh all data keys and layout segments.</p>
                  </div>
                  <Button onClick={async () => {
                    const { clearCache } = await import('@/actions/system')
                    const res = await clearCache()
                    if (res.success) toast.success(res.message)
                    else toast.error(res.message)
                    window.location.reload()
                  }} variant="outline" className="border-orange-200 hover:bg-orange-100 text-orange-700">
                    <RefreshCw className="mr-2 h-4 w-4" /> Clear Cache
                  </Button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 font-mono text-xs text-slate-500">
                  <p className="font-bold mb-2">Debug Context:</p>
                  <p>User Email: {user?.email}</p>
                  <p>Resolved Role: {role}</p>
                  <p>User ID: {user?.id}</p>
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs Section */}
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/30">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl flex items-center gap-2">
                      <ScrollText className="text-primary w-6 h-6" /> Audit Logs
                    </CardTitle>
                    <CardDescription>Rekod aktiviti pengguna dan sistem</CardDescription>
                  </div>
                  <Button onClick={fetchLogs} disabled={loadingLogs} variant="outline" size="sm">
                    <RefreshCw className={cn("w-4 h-4 mr-2", loadingLogs && "animate-spin")} /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="pl-6">Masa</TableHead>
                      <TableHead>Pengguna</TableHead>
                      <TableHead>Tindakan</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="text-right pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLogs ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader2 className="animate-spin inline mr-2" /> Memuatkan log...
                        </TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Tiada rekod aktiviti.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap pl-6">
                            {new Date(log.created_at).toLocaleString('ms-MY')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">{log.profiles?.full_name || "Unknown"}</span>
                              <span className="text-[10px] text-muted-foreground">{log.profiles?.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(log.action)}
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                                {log.action}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize text-sm font-medium text-foreground/80">
                            {log.resource} <span className="text-xs text-muted-foreground ml-1">#{log.resource_id}</span>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {(role === 'admin' || role === 'superadmin') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                onClick={() => handleDeleteLog(log.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Subscription Tab for Organizers and Tenants (not admin exempt) */}
        {(role === 'organizer' || role === 'tenant') && !isAdminExempt && (
          <TabsContent value="subscription" className="space-y-6">
            <SubscriptionTab />
          </TabsContent>
        )}

        {/* Admin Subscriptions Tab - show for admin, superadmin, and admin exempt users */}
        {(role === 'admin' || role === 'superadmin' || isAdminExempt) && (
          <TabsContent value="subscriptions" className="space-y-6">
            <AdminSubscriptionsTab />
          </TabsContent>
        )}

      </Tabs>
    </div >
  )
}

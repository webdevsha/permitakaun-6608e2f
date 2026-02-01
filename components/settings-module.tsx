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
import { Loader2, Upload, FileText, Check, Database, Download, Trash2, RefreshCw, Shield, HardDrive, Pencil, X, Utensils, FolderOpen, Users, Lock } from "lucide-react"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PaymentSettings } from "@/components/settings-toggle"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { clearAllSetupData } from "@/app/setup/actions"

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

export function SettingsModule({ initialProfile, initialBackups, trialPeriodDays = 14, currentUser }: { initialProfile?: any, initialBackups?: any[], trialPeriodDays?: number, currentUser?: any }) {
  const { user, role } = useAuth() // Note: user from auth-provider might be slightly different context than currentUser passed from server, but IDs match. Using currentUser for creation date reliability.
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<number | null>(null)

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
    phone: initialProfile?.phone_number || "",
    ssmNumber: initialProfile?.ssm_number || "",
    icNumber: initialProfile?.ic_number || "",
    address: initialProfile?.address || ""
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
      setTenantId(initialProfile.id)
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

        const counts = res.counts || { transactions: 0, rentals: 0, tenants: 0, locations: 0, organizers: 0 }
        const totalDeleted = Object.values(counts).reduce((a, b) => a + b, 0)

        if (totalDeleted === 0 && !res.warning) {
          toast.info("Tiada data untuk dipadam.")
        } else {
          toast.success(`Berjaya memadam: ${counts.transactions} Transaksi, ${counts.organizers} Penganjur, ${counts.tenants} Peniaga, ${counts.locations} Lokasi, ${counts.rentals} Sewaan.`)
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

  const fetchUsers = async () => {
    setLoadingUsers(true)
    const { data, error } = await supabase.from('profiles').select('*').neq('role', 'superadmin').order('created_at', { ascending: false })
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

  // Fetch users when tab becomes active (admin/superadmin/staff)
  useEffect(() => {
    if (role === 'superadmin' || role === 'admin' || role === 'staff') {
      fetchUsers()
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

    setSaving(true)
    try {
      let newUrls = { ...urls }

      // Upload files if new ones selected
      if (files.profile) newUrls.profile = await handleFileUpload(files.profile, 'profile')
      if (files.ssm) newUrls.ssm = await handleFileUpload(files.ssm, 'ssm')
      if (files.food) newUrls.food = await handleFileUpload(files.food, 'food')
      if (files.other) newUrls.other = await handleFileUpload(files.other, 'other')

      // Update Profiles Table (Primary source for Full Name)
      if (formData.fullName) {
        await supabase
          .from('profiles')
          .update({ full_name: formData.fullName })
          .eq('id', user.id)
      }

      // Prepare Payload for Tenants Table
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

      let error;

      if (tenantId) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('tenants')
          .update(payload)
          .eq('id', tenantId)
        error = updateError
      } else {
        // Create new record
        const { data: newTenant, error: insertError } = await supabase
          .from('tenants')
          .insert({
            ...payload,
            profile_id: user.id,
            email: user.email
          })
          .select('id')
          .single()

        if (newTenant) {
          setTenantId(newTenant.id)
        }
        error = insertError
      }

      if (error) {
        console.error("Tenant update error:", error)
        if (error.code === '42501') {
          throw new Error("Anda tiada kebenaran untuk mencipta profil perniagaan. Sila hubungi Admin.")
        }
        throw error
      }

      setUrls(newUrls)
      setFiles({}) // Reset file inputs
      setIsEditing(false) // Switch back to read-only
      toast.success(tenantId ? "Profil berjaya dikemaskini" : "Profil berjaya dicipta")

    } catch (err: any) {
      console.error(err)
      toast.error("Ralat: " + err.message)
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
      <div>
        <h2 className="text-3xl font-serif font-bold text-foreground leading-tight">Tetapan</h2>
        <p className="text-muted-foreground text-lg">Urus profil dan konfigurasi sistem</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-white border border-border/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-2" /> Profil Saya
          </TabsTrigger>
          {(role === 'admin' || role === 'superadmin' || role === 'staff') && (
            <TabsTrigger value="backup" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <Database className="w-4 h-4 mr-2" /> Backup & Sistem
            </TabsTrigger>
          )}
          {role === 'superadmin' && (
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" /> Pengurusan Pengguna
            </TabsTrigger>
          )}
          {(role === 'admin') && (
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" /> Senarai Pengguna
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
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Status Semasa</p>
                      <div className="flex items-center gap-2">
                        {role === 'admin' || role === 'staff' || role === 'superadmin' ? (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200">
                            Full System Access
                          </span>
                        ) : myTrialStatus.isExpired ? (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">
                            Tamat Tempoh Percubaan ({trialPeriodDays} Hari)
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                            Aktif: Percubaan ({myTrialStatus.daysRemaining} hari lagi)
                          </span>
                        )}
                      </div>
                    </div>
                    {(role === 'tenant' || role === 'organizer') && !myTrialStatus.isExpired && (
                      <div className="md:ml-auto">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{myTrialStatus.daysRemaining}</p>
                          <p className="text-xs text-muted-foreground">Hari Baki</p>
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
                  <DataField label="No. Kad Pengenalan" value={formData.icNumber} field="icNumber" placeholder="Contoh: 880101-14-1234" isEditing={isEditing} onChange={handleInputChange} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DataField label="Nama Perniagaan / Syarikat" value={formData.businessName} field="businessName" isEditing={isEditing} onChange={handleInputChange} />
                  <DataField label="No. Pendaftaran SSM" value={formData.ssmNumber} field="ssmNumber" placeholder="Contoh: 202401001234" isEditing={isEditing} onChange={handleInputChange} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DataField label="No. Telefon" value={formData.phone} field="phone" isEditing={isEditing} onChange={handleInputChange} />
                  <DataField label="Alamat Surat Menyurat" value={formData.address} field="address" isEditing={isEditing} onChange={handleInputChange} />
                </div>
              </CardContent>
            </Card>

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
          </div>
        </TabsContent>

        {(role === 'admin' || role === 'superadmin' || role === 'staff') && (
          <TabsContent value="backup" className="space-y-6">
            {/* Payment Settings (Admin/Superadmin Only) */}
            {(role === 'admin' || role === 'superadmin') && (
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
          </TabsContent>
        )}

        {(role === 'superadmin' || role === 'admin') && (
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/30">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="font-serif text-2xl flex items-center gap-2">
                      <Users className="text-primary w-6 h-6" /> Pengurusan Pengguna
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
                          <div className="flex flex-col">
                            <span className="text-xs font-mono text-muted-foreground">{new Date(usr.created_at).toLocaleDateString('ms-MY')}</span>
                            {(() => {
                              const status = getTrialStatus(usr.created_at)
                              if (['admin', 'superadmin', 'staff'].includes(usr.role)) return <span className="text-[10px] text-green-600 font-bold">Privileged</span>
                              return status.isExpired
                                ? <span className="text-[10px] text-red-600 font-bold">Expired ({Math.abs(status.daysRemaining)}d ago)</span>
                                : <span className="text-[10px] text-blue-600 font-bold">{status.daysRemaining} days left</span>
                            })()}
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
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

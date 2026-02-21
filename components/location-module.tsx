"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Plus, MapPin, Loader2, Eye, Users, Store, Pencil, Save, Building, CheckCircle, Trash2, Upload, X, ImageIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import useSWR from "swr"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { initiatePayment } from "@/actions/payment"
import { logAction } from "@/utils/logging"

const fetcher = async () => {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  let query = supabase
    .from('locations')
    .select('*, organizers(name)')
    .order('created_at', { ascending: true })

  // --- ORGANIZER FILTER ---
  if (role === 'organizer') {
    const { data: org } = await supabase.from('organizers').select('id').eq('profile_id', user.id).single()
    if (org) {
      query = query.eq('organizer_id', org.id)
    } else {
      return [] // Organizer has no profile linked
    }
  } else if (role === 'tenant') {
    const { data: tenant } = await supabase.from('tenants').select('organizer_code').eq('profile_id', user.id).maybeSingle()
    if (tenant?.organizer_code) {
      const { data: org } = await supabase.from('organizers').select('id').eq('organizer_code', tenant.organizer_code).maybeSingle()
      if (org) query = query.eq('organizer_id', org.id)
      else return []
    } else {
      return [] // No organizer linked
    }
  }

  const { data: locations, error } = await query
  if (error) throw error

  // Fetch tenant counts for each location
  const locationsWithCounts = await Promise.all(locations.map(async (loc: any) => {
    const { count } = await supabase.from('tenant_locations').select('*', { count: 'exact', head: true }).eq('location_id', loc.id)

    let isRented = false
    if (role === 'tenant') {
      const userTenant = await supabase.from('tenants').select('id').eq('profile_id', user.id).single()
      if (userTenant.data) {
        const check = await supabase.from('tenant_locations').select('id').eq('location_id', loc.id).eq('tenant_id', userTenant.data.id).maybeSingle()
        if (check.data) isRented = true
      }
    }

    return { ...loc, tenant_count: count || 0, is_rented: isRented }
  }))

  return locationsWithCounts
}

export function LocationModule({ initialLocations }: { initialLocations?: any[] }) {
  const { role } = useAuth()
  const locations = initialLocations || []
  const mutate = () => window.location.reload()
  const isLoading = false
  const [selectedLocation, setSelectedLocation] = useState<any>(null)
  const [locationTenants, setLocationTenants] = useState<any[]>([])
  const [loadingTenants, setLoadingTenants] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const supabase = createClient()

  // Location Form State
  const [formData, setFormData] = useState({
    id: 0,
    name: "",
    program_name: "",
    type: "daily" as "daily" | "monthly" | "expo" | "bazar_ramadhan" | "bazar_raya", // updated types
    operating_days: "Sabtu & Ahad",
    days_per_week: "2",
    total_lots: "50",
    rate_khemah: "0",
    rate_cbs: "0",
    rate_foodtruck: "0", // New Foodtruck rate
    rate_monthly: "0",
    rate_monthly_khemah: "0",
    rate_monthly_cbs: "0",
    rate_monthly_foodtruck: "0",
    estimate_monthly_khemah: "0", // New Editable Estimate
    estimate_monthly_cbs: "0", // New Editable Estimate
    estimate_monthly_foodtruck: "0", // New Editable Estimate
    organizer_id: "", // Added organizer_id
    map_url: "",
    image_url: "",
    description: "",
    start_date: "",
    end_date: "",
  })

  // Admin: Fetch Organizers List
  const [organizersList, setOrganizersList] = useState<any[]>([])
  const [organizersLoading, setOrganizersLoading] = useState(false)

  // Fetch Organizers on mount (only once)
  useEffect(() => {
    async function fetchOrganizers() {
      if (role === 'admin' || role === 'superadmin' || role === 'staff') {
        setOrganizersLoading(true)
        try {
          const { data } = await supabase
            .from('organizers')
            .select('id, name, organizer_code')
            .eq('status', 'active')
            .order('name')
          setOrganizersList(data || [])
        } finally {
          setOrganizersLoading(false)
        }
      }
    }
    fetchOrganizers()
  }, [role, supabase])

  const resetForm = () => {
    setFormData({
      id: 0,
      name: "",
      program_name: "",
      type: "daily",
      operating_days: "Sabtu & Ahad",
      days_per_week: "2",
      total_lots: "50",
      rate_khemah: "0",
      rate_cbs: "0",
      rate_foodtruck: "0",
      rate_monthly: "0",
      rate_monthly_khemah: "0",
      rate_monthly_cbs: "0",
      rate_monthly_foodtruck: "0",
      estimate_monthly_khemah: "0",
      estimate_monthly_cbs: "0",
      estimate_monthly_foodtruck: "0",
      organizer_id: "",
      map_url: "",
      image_url: "",
      description: "",
      start_date: "",
      end_date: ""
    })
    setIsEditMode(false)
  }

  const handleOpenAdd = () => {
    resetForm()
    setIsEditMode(false)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (loc: any) => {
    setFormData({
      id: loc.id,
      name: loc.name || "",
      program_name: loc.program_name || "",
      type: loc.type || "daily",
      operating_days: loc.operating_days || "",
      days_per_week: loc.days_per_week?.toString() || "1",
      total_lots: loc.total_lots?.toString() || "0",
      rate_khemah: loc.rate_khemah?.toString() || "0",
      rate_cbs: loc.rate_cbs?.toString() || "0",
      rate_foodtruck: loc.rate_foodtruck?.toString() || "0",
      rate_monthly: loc.rate_monthly?.toString() || "0",
      rate_monthly_khemah: loc.rate_monthly_khemah?.toString() || "0",
      rate_monthly_cbs: loc.rate_monthly_cbs?.toString() || "0",
      rate_monthly_foodtruck: loc.rate_monthly_foodtruck?.toString() || "0",
      estimate_monthly_khemah: loc.estimate_monthly_khemah?.toString() || "0",
      estimate_monthly_cbs: loc.estimate_monthly_cbs?.toString() || "0",
      estimate_monthly_foodtruck: loc.estimate_monthly_foodtruck?.toString() || "0",
      organizer_id: loc.organizer_id?.toString() || "",
      map_url: loc.map_url || "",
      image_url: loc.image_url || "",
      description: loc.description || "",
      start_date: loc.start_date || "",
      end_date: loc.end_date || ""
    })
    setIsEditMode(true)
    setIsDialogOpen(true)
  }

  const handleSaveLocation = async () => {
    if (!formData.name) {
      toast.error("Sila masukkan nama lokasi")
      return
    }

    setIsSaving(true)
    try {
      const payload: any = {
        name: formData.name,
        program_name: formData.program_name,
        type: formData.type,
        operating_days: formData.operating_days,
        days_per_week: parseInt(formData.days_per_week) || 1,
        total_lots: parseInt(formData.total_lots) || 0,
        rate_khemah: parseFloat(formData.rate_khemah) || 0,
        rate_cbs: parseFloat(formData.rate_cbs) || 0,
        rate_foodtruck: parseFloat(formData.rate_foodtruck) || 0,
        rate_monthly: parseFloat(formData.rate_monthly) || 0,
        rate_monthly_khemah: parseFloat(formData.rate_monthly_khemah) || 0,
        rate_monthly_cbs: parseFloat(formData.rate_monthly_cbs) || 0,
        rate_monthly_foodtruck: parseFloat(formData.rate_monthly_foodtruck) || 0,
        estimate_monthly_khemah: parseFloat(formData.estimate_monthly_khemah) || 0,
        estimate_monthly_cbs: parseFloat(formData.estimate_monthly_cbs) || 0,
        estimate_monthly_foodtruck: parseFloat(formData.estimate_monthly_foodtruck) || 0,
        organizer_id: (role === 'admin' || role === 'superadmin' || role === 'staff') && formData.organizer_id ? formData.organizer_id : null,
        map_url: formData.map_url,
        image_url: formData.image_url,
        description: formData.description,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      }

      // Use server action to bypass RLS
      const { saveLocationAction } = await import("@/actions/location")
      const result = await saveLocationAction(payload, isEditMode && formData.id ? formData.id : undefined)

      if (!result.success) throw new Error(result.error)

      toast.success(
        isEditMode
          ? (role === 'staff' ? "Lokasi dikemaskini. Menunggu kelulusan." : "Lokasi berjaya dikemaskini")
          : (role === 'staff' ? "Lokasi ditambah. Menunggu kelulusan Admin." : "Lokasi baru berjaya ditambah")
      )

      setIsDialogOpen(false)
      mutate() // Refresh list
      resetForm()

    } catch (e: any) {
      console.error('Location save error:', e)
      const errorMsg = e.message || ''
      if (errorMsg.includes('row-level security') || errorMsg.includes('RLS') || errorMsg.includes('permission denied')) {
        toast.error("Akses ditolak: Anda tidak mempunyai kebenaran untuk tindakan ini. Sila pastikan anda log masuk sebagai Admin.")
      } else {
        toast.error("Gagal simpan: " + e.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteLocation = async (id: number) => {
    if (role === 'staff') return // Safety check

    if (!confirm("Adakah anda pasti?")) return

    try {
      const { error } = await supabase.from('locations').delete().eq('id', id)
      if (error) throw error

      await logAction('DELETE', 'location', id, {})
      toast.success("Lokasi dipadam")
      mutate()
    } catch (e: any) {
      toast.error("Gagal padam: " + e.message)
    }
  }

  const handleApproveLocation = async (id: number) => {
    try {
      const { error } = await supabase.from('locations').update({ status: 'active' }).eq('id', id)
      if (error) throw error

      await logAction('APPROVE', 'location', id, { status: 'active' })
      toast.success("Lokasi diluluskan")
      mutate()
    } catch (e: any) {
      toast.error("Gagal lulus: " + e.message)
    }
  }

  const handleViewTenants = async (location: any) => {
    setSelectedLocation(location)
    setLoadingTenants(true)

    const { data } = await supabase
      .from('tenant_locations')
      .select(`
        *,
        tenants:tenant_id (full_name, business_name, phone_number, status)
      `)
      .eq('location_id', location.id)

    setLocationTenants(data || [])
    setLoadingTenants(false)
  }

  // Handle Status Toggle (Active/Inactive)
  const handleRentalStatusChange = async (rentalId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const { error } = await supabase.from('tenant_locations').update({ status: newStatus }).eq('id', rentalId)
      if (error) throw error

      setLocationTenants(prev => prev.map(r => r.id === rentalId ? { ...r, status: newStatus } : r))
      toast.success("Status tapak dikemaskini")
    } catch (e: any) {
      toast.error("Gagal kemaskini: " + e.message)
    }
  }

  // Handle Stall Number Update
  const handleSaveStall = async (rentalId: number, stallNumber: string) => {
    try {
      const { error } = await supabase.from('tenant_locations').update({ stall_number: stallNumber }).eq('id', rentalId)
      if (error) throw error
      toast.success("No. Petak disimpan")
    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message)
    }
  }

  // --- RENTAL LOGIC FOR TENANT ---
  const [rentLocation, setRentLocation] = useState<any>(null)
  const [rentType, setRentType] = useState<"khemah" | "cbs" | "foodtruck" | "monthly" | "monthly_khemah" | "monthly_cbs" | "monthly_foodtruck">("monthly")
  const [isRenting, setIsRenting] = useState(false)

  const handleOpenRent = (loc: any) => {
    console.log("[Client] Opening Rent Dialog for:", loc)
    setRentLocation(loc)
    // Default type based on location type
    if (loc.type === 'monthly') setRentType('monthly')
    else setRentType('khemah')
  }

  const handleConfirmRent = async () => {
    console.log("[Client] Confirm Rent Clicked. Location:", rentLocation, "Type:", rentType)

    if (!rentLocation) {
      console.error("[Client] No rentLocation selected!")
      return
    }

    setIsRenting(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      console.log("[Client] Current User:", user)

      const { data: userTenant, error: tenantError } = await supabase.from('tenants').select('id').eq('profile_id', user?.id).single()

      if (tenantError || !userTenant) {
        console.error("[Client] Tenant profile error:", tenantError)
        throw new Error("Profil peniaga tidak dijumpai.")
      }

      // 1. Calculate Amount
      let amount = 0
      if (rentType === 'monthly') amount = rentLocation.rate_monthly || 0
      else if (rentType === 'monthly_khemah') amount = rentLocation.rate_monthly_khemah || rentLocation.rate_monthly || 0
      else if (rentType === 'monthly_cbs') amount = rentLocation.rate_monthly_cbs || rentLocation.rate_monthly || 0
      else if (rentType === 'monthly_foodtruck') amount = rentLocation.rate_monthly_foodtruck || rentLocation.rate_monthly || 0
      else if (rentType === 'khemah') amount = (rentLocation.rate_khemah || 0) * 4
      else if (rentType === 'cbs') amount = (rentLocation.rate_cbs || 0) * 4
      else if (rentType === 'foodtruck') amount = (rentLocation.rate_foodtruck || 0) * 4

      console.log("[Client] Calculated Amount:", amount)

      if (amount <= 0) throw new Error("Kadar sewa tidak sah.")

      // 2. Initiate Payment (Sandbox/Real switch handled in action)
      console.log("[Client] Calling initiatePayment action...")
      const result = await initiatePayment({
        amount: amount,
        description: `Sewa Tapak: ${rentLocation.name} (${rentType})`,
        redirectPath: '/dashboard/tenant', // Returning to dashboard
        locationId: rentLocation.id  // Pass location ID for proper organizer routing
      })

      console.log("[Client] Payment Result:", result)

      if (result.error) throw new Error(result.error)
      if (result.url) {
        // ... (existing logic)
        const { error } = await supabase.from('tenant_locations').insert({
          tenant_id: userTenant.id,
          location_id: rentLocation.id,
          organizer_id: rentLocation.organizer_id,  // Set organizer_id for proper routing
          rate_type: rentType,
          status: 'active'
        })
        if (error) {
          console.error("[Client] DB Insert Error:", error)
          throw error
        }

        toast.success("Mengarahkan ke gerbang pembayaran...")
        window.location.href = result.url
      }

    } catch (e: any) {
      console.error("[Client] Error in handleConfirmRent:", e)
      toast.error("Gagal: " + e.message)
    } finally {
      setIsRenting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Fetch Tenant Status for access control
  const { data: tenantProfile } = useSWR('tenant-profile', async () => {
    if (role === 'tenant') {
      const { data } = await supabase.from('tenants').select('status, organizer_code').eq('profile_id', (await supabase.auth.getUser()).data.user?.id).single()
      return data
    }
    return null
  })

  // Pending State for Tenant
  if (role === 'tenant' && tenantProfile?.status === 'pending') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Lokasi & Permit</h2>
          <p className="text-muted-foreground">Senarai lokasi tersedia</p>
        </div>
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-3xl text-yellow-800 space-y-4 text-center">
          <Loader2 className="animate-spin w-12 h-12 mx-auto opacity-50" />
          <div>
            <h3 className="text-xl font-bold">Akaun Sedang Disemak</h3>
            <p className="max-w-md mx-auto mt-2 text-sm">
              Permohonan anda untuk menyertai penganjur <strong>{tenantProfile.organizer_code}</strong> sedang dalam proses kelulusan.
              Anda akan dapat melihat senarai lokasi setelah diluluskan oleh penganjur.
            </p>
          </div>
          <Button variant="outline" className="bg-white hover:bg-yellow-100 border-yellow-300 text-yellow-900" onClick={() => window.location.reload()}>
            Semak Semula
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Lokasi & Permit</h2>
          <p className="text-muted-foreground">{role === 'organizer' ? 'Urus tapak pasar anda' : 'Senarai lokasi tersedia'}</p>
        </div>

        {role !== 'tenant' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-2xl h-12 px-6">
                <Plus className="mr-2 h-5 w-5" />
                Tambah Lokasi
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-border rounded-3xl w-[95vw] sm:w-full sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              {/* Dialog Content Omitted for Brevity - maintained by React composition if not replaced, 
                  but here I am replacing the block. Need to include DialogContent children? 
                  The tool replaces the WHOLE block from StartLine to EndLine.
                  I need to allow the existing DialogContent to remain or re-include it. 
                  Since I must replace the TargetContent, I should carefully target ONLY the trigger wrapper 
                  or include the whole dialog. 
                  Actually, I can just wrap the Button/Dialog in the condition.
               */}
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">{isEditMode ? "Kemaskini Lokasi" : "Lokasi Baru"}</DialogTitle>
                <DialogDescription>{isEditMode ? "Ubah butiran lokasi sedia ada" : "Konfigurasi tapak pasar baru"}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Admin: Organizer Selector */}
                {(role === 'admin' || role === 'superadmin' || role === 'staff') && (
                  <div className="grid gap-2">
                    <Label>Penganjur</Label>
                    <Select
                      value={formData.organizer_id}
                      onValueChange={(v) => setFormData({ ...formData, organizer_id: v })}
                      disabled={organizersLoading}
                    >
                      <SelectTrigger className="rounded-xl">
                        {organizersLoading ? (
                          <span className="text-muted-foreground">Memuat...</span>
                        ) : (
                          <SelectValue placeholder="Pilih Penganjur" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {organizersList.length === 0 && !organizersLoading && (
                          <SelectItem value="" disabled>Tiada penganjur aktif</SelectItem>
                        )}
                        {organizersList.map(org => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name} ({org.organizer_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="program_name">Nama Program</Label>
                    <Input
                      id="program_name"
                      value={formData.program_name}
                      onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
                      placeholder="Contoh: Karnival Mega"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nama Lokasi/Jalan</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: Jalan Tun Razak"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                {/* New Fields: Description & Maps */}
                <div className="grid gap-2">
                  <Label htmlFor="description">Maklumat Lanjut (Description)</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Penerangan ringkas mengenai lokasi atau permit ini..."
                    className="flex min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="map_url">Pautan Google Maps (URL)</Label>
                    <Input
                      id="map_url"
                      value={formData.map_url}
                      onChange={(e) => setFormData({ ...formData, map_url: e.target.value })}
                      placeholder="https://maps.google.com/..."
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="image_upload">Gambar Lokasi</Label>
                    
                    {/* Image Preview */}
                    {formData.image_url && (
                      <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border mb-2">
                        <img 
                          src={formData.image_url} 
                          alt="Location preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: "" })}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    {/* File Upload Input */}
                    <div className="relative">
                      <input
                        type="file"
                        id="image_upload"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          
                          // Validate file type
                          if (!file.type.startsWith('image/')) {
                            toast.error('Sila pilih fail gambar sahaja (JPG, PNG, GIF)')
                            return
                          }
                          
                          // Validate file size (max 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('Saiz gambar terlalu besar. Maksimum 5MB')
                            return
                          }
                          
                          setSelectedImageFile(file)
                          setUploadingImage(true)
                          
                          try {
                            // Generate unique filename
                            const fileExt = file.name.split('.').pop()
                            const fileName = `location-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
                            
                            // Upload to Supabase Storage
                            const { error: uploadError } = await supabase
                              .storage
                              .from('locations')
                              .upload(fileName, file)
                            
                            if (uploadError) {
                              console.error('Upload error:', uploadError)
                              toast.error('Gagal memuat naik gambar: ' + uploadError.message)
                              return
                            }
                            
                            // Get public URL
                            const { data: { publicUrl } } = supabase
                              .storage
                              .from('locations')
                              .getPublicUrl(fileName)
                            
                            setFormData({ ...formData, image_url: publicUrl })
                            toast.success('Gambar berjaya dimuat naik!')
                          } catch (err: any) {
                            console.error('Error uploading image:', err)
                            toast.error('Ralat memuat naik gambar')
                          } finally {
                            setUploadingImage(false)
                            setSelectedImageFile(null)
                            // Reset the input
                            e.target.value = ''
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="image_upload"
                        className={`
                          flex items-center justify-center gap-2 w-full px-4 py-3 
                          border-2 border-dashed border-border rounded-xl 
                          cursor-pointer transition-colors
                          ${uploadingImage ? 'bg-muted cursor-not-allowed' : 'hover:bg-muted/50 hover:border-primary/50'}
                        `}
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Memuat naik...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {formData.image_url ? 'Tukar Gambar' : 'Klik untuk muat naik gambar'}
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                    
                    {/* Or use URL option */}
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-border"></div>
                      <span className="text-xs text-muted-foreground">atau</span>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>
                    
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://example.com/image.jpg (URL gambar)"
                      className="rounded-xl text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format disokong: JPG, PNG, GIF. Maksimum 5MB.
                    </p>
                  </div>
                </div>

                {/* Date Selection for Events */}
                {['expo', 'bazar_ramadhan', 'bazar_raya'].includes(formData.type) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="grid gap-2">
                      <Label className="text-blue-700">Tarikh Mula</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-blue-700">Tarikh Tamat</Label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Jenis Operasi</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v: "daily" | "monthly") => setFormData({ ...formData, type: v })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Mingguan (Pasar Malam/Pagi)</SelectItem>
                        <SelectItem value="monthly">Bulanan (Kiosk/Uptown)</SelectItem>
                        <SelectItem value="expo">Expo / Karnival</SelectItem>
                        <SelectItem value="bazar_ramadhan">Bazar Ramadhan</SelectItem>
                        <SelectItem value="bazar_raya">Bazar Raya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Jumlah Lot/Tapak</Label>
                    <Input
                      type="number"
                      value={formData.total_lots}
                      onChange={(e) => setFormData({ ...formData, total_lots: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Hari/Waktu Operasi</Label>
                    <Input
                      value={formData.operating_days}
                      onChange={(e) => setFormData({ ...formData, operating_days: e.target.value })}
                      placeholder="Contoh: Sabtu & Ahad"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bil. Hari Seminggu</Label>
                    <Input
                      type="number"
                      min="1"
                      max="7"
                      value={formData.days_per_week}
                      onChange={(e) => setFormData({ ...formData, days_per_week: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="bg-secondary/20 p-4 rounded-xl space-y-3">
                  <Label className="font-bold text-primary">Tetapan Kadar Sewa (RM)</Label>
                  {formData.type === 'daily' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs">Kadar Seminggu (Khemah)</Label>
                          <Input type="number" value={formData.rate_khemah} onChange={(e) => setFormData({ ...formData, rate_khemah: e.target.value })} className="h-9 bg-white" />
                        </div>
                        <div>
                          <Label className="text-xs">Kadar Seminggu (CBS)</Label>
                          <Input type="number" value={formData.rate_cbs} onChange={(e) => setFormData({ ...formData, rate_cbs: e.target.value })} className="h-9 bg-white" />
                        </div>
                        <div>
                          <Label className="text-xs">Kadar Seminggu (Foodtruck)</Label>
                          <Input type="number" value={formData.rate_foodtruck} onChange={(e) => setFormData({ ...formData, rate_foodtruck: e.target.value })} className="h-9 bg-white" />
                        </div>
                      </div>
                      <div className="bg-secondary/10 p-3 rounded-lg border border-dashed border-secondary/30">
                        <Label className="text-xs font-bold text-muted-foreground mb-2 block">Anggaran Bulanan (Editable)</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Anggaran Khemah (4 Minggu)</Label>
                            <Input type="number" value={formData.estimate_monthly_khemah} onChange={(e) => setFormData({ ...formData, estimate_monthly_khemah: e.target.value })} placeholder={(parseFloat(formData.rate_khemah || '0') * 4).toString()} className="h-8 bg-white text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Anggaran CBS (4 Minggu)</Label>
                            <Input type="number" value={formData.estimate_monthly_cbs} onChange={(e) => setFormData({ ...formData, estimate_monthly_cbs: e.target.value })} placeholder={(parseFloat(formData.rate_cbs || '0') * 4).toString()} className="h-8 bg-white text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Anggaran Foodtruck (4 Minggu)</Label>
                            <Input type="number" value={formData.estimate_monthly_foodtruck} onChange={(e) => setFormData({ ...formData, estimate_monthly_foodtruck: e.target.value })} placeholder={(parseFloat(formData.rate_foodtruck || '0') * 4).toString()} className="h-8 bg-white text-xs" />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">* Masukkan nilai manual jika ingin override pengiraan automatik (Kadar x 4).</p>
                      </div>
                    </div>
                  ) : formData.type === 'monthly' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Kadar Bulanan (Khemah)</Label>
                          <Input type="number" value={formData.rate_monthly_khemah} onChange={(e) => setFormData({ ...formData, rate_monthly_khemah: e.target.value })} className="h-9 bg-white" />
                        </div>
                        <div>
                          <Label className="text-xs">Kadar Bulanan (CBS)</Label>
                          <Input type="number" value={formData.rate_monthly_cbs} onChange={(e) => setFormData({ ...formData, rate_monthly_cbs: e.target.value })} className="h-9 bg-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Kadar Sewa Bulanan (Standard)</Label>
                        <Input type="number" value={formData.rate_monthly} onChange={(e) => setFormData({ ...formData, rate_monthly: e.target.value })} className="bg-white" placeholder="Kadar umum jika tidak specify jenis" />
                      </div>
                    </div>
                  ) : (
                    /* expo, bazar_ramadhan, bazar_raya — single flat rate per event */
                    <div>
                      <Label className="text-xs">Kadar Sewa Per Sesi</Label>
                      <Input type="number" value={formData.rate_monthly} onChange={(e) => setFormData({ ...formData, rate_monthly: e.target.value })} className="bg-white" placeholder="Contoh: 150" />
                      <p className="text-[10px] text-muted-foreground mt-1">Kadar tetap untuk setiap penyertaan program ini.</p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button onClick={handleSaveLocation} disabled={isSaving} className="w-full rounded-xl h-11 bg-primary text-white">
                  {isSaving ? <Loader2 className="animate-spin" /> : (isEditMode ? "Simpan Perubahan" : "Simpan Lokasi")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* RENT DIALOG */}
      <Dialog open={!!rentLocation} onOpenChange={(open) => !open && setRentLocation(null)}>
        <DialogContent className="bg-white rounded-3xl w-[95vw] sm:w-full sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Sewa Tapak: {rentLocation?.name}</DialogTitle>
            <DialogDescription>Sahkan pilihan sewaan anda.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {rentLocation?.type === 'daily' && (
              <div className="space-y-2">
                <Label>Pilih Jenis Sewaan</Label>
                <Select value={rentType} onValueChange={(v: any) => setRentType(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="khemah">Khemah (RM {rentLocation.rate_khemah})</SelectItem>
                    <SelectItem value="cbs">CBS (RM {rentLocation.rate_cbs})</SelectItem>
                    <SelectItem value="foodtruck">Foodtruck (RM {rentLocation.rate_foodtruck})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {rentLocation?.type === 'monthly' && (
              <div className="space-y-2">
                <Label>Pilih Jenis Sewaan</Label>
                <Select value={rentType} onValueChange={(v: any) => setRentType(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly_khemah">Khemah (RM {rentLocation.rate_monthly_khemah || rentLocation.rate_monthly})</SelectItem>
                    <SelectItem value="monthly_cbs">CBS (RM {rentLocation.rate_monthly_cbs || rentLocation.rate_monthly})</SelectItem>
                    <SelectItem value="monthly">Standard (RM {rentLocation.rate_monthly})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRentLocation(null)}>Batal</Button>
            <Button onClick={handleConfirmRent} disabled={isRenting} className="bg-primary text-white">
              {isRenting ? <Loader2 className="animate-spin" /> : "Sahkan Sewaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {locations?.map((loc: any) => {
          return (
            <Card key={loc.id} className="border-border/50 shadow-sm bg-white overflow-hidden rounded-[2rem] hover:shadow-md transition-all relative group">
              {role !== 'tenant' && (
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                  {/* Admin Approval Button */}
                  {(role === 'admin' || role === 'superadmin') && loc.status === 'pending' && (
                    <Button size="icon" className="h-8 w-8 rounded-full shadow-sm bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveLocation(loc.id)} title="Luluskan">
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  )}

                  <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-sm" onClick={() => handleOpenEdit(loc)}>
                    <Pencil className="w-4 h-4 text-primary" />
                  </Button>

                  {/* Delete Button - Hide for Staff */}
                  {role !== 'staff' && (
                    <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full shadow-sm" onClick={() => handleDeleteLocation(loc.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Location Image */}
              {loc.image_url && (
                <div className="w-full h-48 overflow-hidden">
                  <img 
                    src={loc.image_url} 
                    alt={loc.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide image if it fails to load
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
              
              <CardHeader className="bg-secondary/10 border-b border-border/30 pb-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    {loc.program_name && <span className="text-xs font-bold text-primary uppercase tracking-wider">{loc.program_name}</span>}
                    {loc.status === 'pending' && <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Pending</Badge>}
                  </div>
                  <CardTitle className="text-xl font-serif">{loc.name}</CardTitle>
                  {/* Organizer Name */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Building className="w-3 h-3" />
                    <span className="font-medium text-xs">
                      {loc.organizers?.name ? loc.organizers.name : <span className="text-orange-500 italic">to be added</span>}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Jenis</span>
                    <Badge variant="outline" className="capitalize bg-white">
                      {loc.type === 'daily' ? 'Mingguan' : loc.type === 'monthly' ? 'Bulanan' : loc.type === 'expo' ? 'Expo / Karnival' : loc.type === 'bazar_ramadhan' ? 'Bazar Ramadhan' : loc.type === 'bazar_raya' ? 'Bazar Raya' : loc.type}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Operasi</span>
                    <span className="font-medium text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {loc.days_per_week || 1} Hari/Minggu
                    </span>
                  </div>
                </div>

                {/* Rates */}
                <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Store className="w-3 h-3" /> Kadar Sewa
                  </p>
                  {loc.type === 'daily' ? (
                    <div className="space-y-2">
                      {loc.rate_khemah > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground text-xs">Khemah</span>
                            <span className="font-bold">RM {loc.estimate_monthly_khemah > 0 ? loc.estimate_monthly_khemah : (loc.rate_khemah * 4).toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">/bulan</span></span>
                          </div>
                          <div className="h-px bg-border/50" />
                        </>
                      )}
                      {loc.rate_cbs > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground text-xs">CBS</span>
                            <span className="font-bold">RM {loc.estimate_monthly_cbs > 0 ? loc.estimate_monthly_cbs : (loc.rate_cbs * 4).toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">/bulan</span></span>
                          </div>
                          <div className="h-px bg-border/50" />
                        </>
                      )}
                      {loc.rate_foodtruck > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground text-xs">Foodtruck</span>
                          <span className="font-bold">RM {loc.estimate_monthly_foodtruck > 0 ? loc.estimate_monthly_foodtruck : (loc.rate_foodtruck * 4).toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">/bulan</span></span>
                        </div>
                      )}
                    </div>
                  ) : loc.type === 'monthly' ? (
                    <div className="space-y-2">
                      {loc.rate_monthly_khemah > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground text-xs">Khemah</span>
                          <span className="font-bold text-lg">RM {loc.rate_monthly_khemah} <span className="text-[10px] font-normal text-muted-foreground">/bulan</span></span>
                        </div>
                      )}
                      {loc.rate_monthly_khemah > 0 && loc.rate_monthly_cbs > 0 && <div className="h-px bg-border/50" />}
                      {loc.rate_monthly_cbs > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground text-xs">CBS</span>
                          <span className="font-bold text-lg">RM {loc.rate_monthly_cbs} <span className="text-[10px] font-normal text-muted-foreground">/bulan</span></span>
                        </div>
                      )}
                      {(!loc.rate_monthly_khemah || loc.rate_monthly_khemah <= 0) && (!loc.rate_monthly_cbs || loc.rate_monthly_cbs <= 0) && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Standard</span>
                          <span className="font-bold text-lg">RM {loc.rate_monthly} <span className="text-[10px] font-normal text-muted-foreground">/bulan</span></span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* expo, bazar_ramadhan, bazar_raya — single flat rate */
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground text-xs">Kadar Sewa</span>
                      <span className="font-bold text-lg">RM {loc.rate_monthly || 0} <span className="text-[10px] font-normal text-muted-foreground">/sesi</span></span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  {role === 'tenant' ? (
                    loc.is_rented ? (
                      <Button disabled className="w-full rounded-xl bg-green-100 text-green-700 hover:bg-green-100">
                        <span className="flex items-center gap-2">✔ Sudah Disewa</span>
                      </Button>
                    ) : (
                      <Button onClick={() => handleOpenRent(loc)} className="w-full rounded-xl bg-primary text-white hover:bg-primary/90">
                        Sewa Tapak Ini
                      </Button>
                    )
                  ) : (
                    <Dialog onOpenChange={(open) => open && handleViewTenants(loc)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary">
                          <Users className="mr-2 h-4 w-4" /> Senarai Peniaga ({loc.tenant_count})
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white rounded-3xl w-[95vw] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-serif">Peniaga di {loc.name}</DialogTitle>
                          <DialogDescription>
                            Penganjur: <span className="font-bold text-primary">{loc.organizers?.name || "-"}</span>
                          </DialogDescription>
                        </DialogHeader>

                        <div className="mt-4 max-h-[400px] overflow-y-auto">
                          {loadingTenants ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                          ) : locationTenants.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nama</TableHead>
                                  <TableHead>Bisnes</TableHead>
                                  <TableHead>No. Petak</TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {locationTenants.map((lt: any) => (
                                  <TableRow key={lt.id}>
                                    <TableCell className="font-medium">
                                      {lt.tenants?.full_name}
                                      <div className="text-xs text-muted-foreground">{lt.tenants?.phone_number}</div>
                                    </TableCell>
                                    <TableCell>{lt.tenants?.business_name}</TableCell>
                                    <TableCell>
                                      <Input
                                        className="h-8 w-24 bg-white text-xs border-primary/20"
                                        defaultValue={lt.stall_number || ""}
                                        placeholder="Petak..."
                                        onBlur={(e) => handleSaveStall(lt.id, e.target.value)}
                                      />
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <Switch
                                          checked={lt.status === 'active'}
                                          onCheckedChange={() => handleRentalStatusChange(lt.id, lt.status)}
                                        />
                                        <span className={cn("text-[10px] uppercase font-bold w-12 text-left", lt.status === 'active' ? "text-brand-green" : "text-muted-foreground")}>
                                          {lt.status === 'active' ? 'Aktif' : 'Pend.'}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-center py-12 bg-secondary/10 rounded-2xl text-muted-foreground">
                              <Store className="w-10 h-10 mx-auto mb-2 opacity-20" />
                              <p>Tiada peniaga didaftarkan di lokasi ini.</p>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setSelectedLocation(null)}>Tutup</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

              </CardContent>
            </Card>
          )
        })}
        {locations?.length === 0 && (
          <div className="col-span-full py-20 text-center text-muted-foreground bg-secondary/10 rounded-3xl border border-dashed border-border">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-bold">Tiada lokasi dijumpai.</p>
            <p className="text-sm">{role === 'organizer' ? 'Klik "Tambah Lokasi" untuk mula mendaftar tapak perniagaan.' : 'Sila hubungi penganjur anda untuk kod penganjur.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

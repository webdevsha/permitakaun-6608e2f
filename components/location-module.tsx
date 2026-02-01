"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Plus, MapPin, Loader2, Eye, Users, Store, Pencil, Save, Building } from "lucide-react"
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
  const supabase = createClient()

  // Location Form State
  const [formData, setFormData] = useState({
    id: 0,
    name: "",
    program_name: "",
    type: "daily" as "daily" | "monthly", // daily = mingguan now in UI
    operating_days: "Sabtu & Ahad",
    days_per_week: "2",
    total_lots: "50",
    rate_khemah: "0",
    rate_cbs: "0",
    rate_monthly: "0"
  })

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
      rate_monthly: "0"
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
      rate_monthly: loc.rate_monthly?.toString() || "0"
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
      const payload = {
        name: formData.name,
        program_name: formData.program_name,
        type: formData.type,
        operating_days: formData.operating_days,
        days_per_week: parseInt(formData.days_per_week) || 1,
        total_lots: parseInt(formData.total_lots) || 0,
        rate_khemah: parseFloat(formData.rate_khemah) || 0,
        rate_cbs: parseFloat(formData.rate_cbs) || 0,
        rate_monthly: parseFloat(formData.rate_monthly) || 0,
      }

      if (isEditMode && formData.id) {
        const { error } = await supabase.from('locations').update(payload).eq('id', formData.id)
        if (error) throw error
        toast.success("Lokasi berjaya dikemaskini")
      } else {
        let organizerId = null;
        // If user is organizer, get their ID
        if (role === 'organizer') {
          const { data: orgData } = await supabase.from('organizers').select('id').eq('profile_id', (await supabase.auth.getUser()).data.user?.id).single()
          organizerId = orgData?.id
        }

        const { error } = await supabase.from('locations').insert({
          ...payload,
          organizer_id: organizerId
        })
        if (error) throw error
        toast.success("Lokasi baru berjaya ditambah")
      }

      setIsDialogOpen(false)
      mutate() // Refresh list
      resetForm()

    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message)
    } finally {
      setIsSaving(false)
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
  const [rentType, setRentType] = useState<"khemah" | "cbs" | "monthly">("monthly")
  const [isRenting, setIsRenting] = useState(false)

  const handleOpenRent = (loc: any) => {
    setRentLocation(loc)
    // Default type based on location type
    if (loc.type === 'monthly') setRentType('monthly')
    else setRentType('khemah')
  }

  const handleConfirmRent = async () => {
    if (!rentLocation) return
    setIsRenting(true)
    try {
      const { data: userTenant } = await supabase.from('tenants').select('id').eq('profile_id', (await supabase.auth.getUser()).data.user?.id).single()

      if (!userTenant) throw new Error("Profil peniaga tidak dijumpai.")

      const { error } = await supabase.from('tenant_locations').insert({
        tenant_id: userTenant.id,
        location_id: rentLocation.id,
        rate_type: rentType,
        status: 'active' // Auto-active for now based on default
      })

      if (error) throw error
      toast.success("Berjaya menyewa tapak ini!")
      setRentLocation(null)
      mutate()
    } catch (e: any) {
      toast.error("Gagal menyewa: " + e.message)
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Pengurusan Lokasi</h2>
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
            <DialogContent className="bg-white border-border rounded-3xl sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Kadar Seminggu (Khemah)</Label>
                          <Input
                            type="number"
                            value={formData.rate_khemah}
                            onChange={(e) => setFormData({ ...formData, rate_khemah: e.target.value })}
                            className="h-9 bg-white"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Kadar Seminggu (CBS/Lori)</Label>
                          <Input
                            type="number"
                            value={formData.rate_cbs}
                            onChange={(e) => setFormData({ ...formData, rate_cbs: e.target.value })}
                            className="h-9 bg-white"
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg text-xs text-muted-foreground border border-dashed">
                        <p className="font-bold mb-1">Anggaran Bulanan (4 Minggu):</p>
                        <div className="flex justify-between">
                          <span>Khemah: RM {(parseFloat(formData.rate_khemah || '0') * 4).toFixed(2)}</span>
                          <span>CBS: RM {(parseFloat(formData.rate_cbs || '0') * 4).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Kadar Sewa Bulanan</Label>
                      <Input
                        type="number"
                        value={formData.rate_monthly}
                        onChange={(e) => setFormData({ ...formData, rate_monthly: e.target.value })}
                        className="bg-white"
                      />
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
        <DialogContent className="bg-white rounded-3xl">
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
                    <SelectItem value="cbs">CBS / Lori (RM {rentLocation.rate_cbs})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {rentLocation?.type === 'monthly' && (
              <div className="p-4 bg-secondary/20 rounded-xl">
                <p className="text-sm font-bold">Kadar Bulanan: RM {rentLocation.rate_monthly}</p>
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
                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-sm" onClick={() => handleOpenEdit(loc)}>
                    <Pencil className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              )}

              <CardHeader className="bg-secondary/10 border-b border-border/30 pb-4">
                <div className="flex flex-col gap-1">
                  {loc.program_name && <span className="text-xs font-bold text-primary uppercase tracking-wider">{loc.program_name}</span>}
                  <CardTitle className="text-xl font-serif">{loc.name}</CardTitle>
                  {loc.organizers?.name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Building className="w-3 h-3" />
                      <span className="font-medium">{loc.organizers.name}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Jenis</span>
                    <Badge variant="outline" className="capitalize bg-white">
                      {loc.type === 'daily' ? 'Mingguan' : 'Bulanan'}
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
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground text-xs">Khemah</span>
                        <div className="text-right">
                          <span className="font-bold block">RM {loc.rate_khemah} <span className="text-[10px] font-normal text-muted-foreground">/minggu</span></span>
                          <span className="text-[10px] text-muted-foreground block">~RM {(loc.rate_khemah * 4).toFixed(0)} /bulan</span>
                        </div>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground text-xs">CBS (Lori)</span>
                        <div className="text-right">
                          <span className="font-bold block">RM {loc.rate_cbs} <span className="text-[10px] font-normal text-muted-foreground">/minggu</span></span>
                          <span className="text-[10px] text-muted-foreground block">~RM {(loc.rate_cbs * 4).toFixed(0)} /bulan</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-muted-foreground">Bulanan</span>
                      <span className="font-bold text-lg">RM {loc.rate_monthly}</span>
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
                      <DialogContent className="max-w-4xl bg-white rounded-3xl">
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

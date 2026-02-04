"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MessageSquare, Eye, Phone, Loader2, AlertCircle, Calendar, FileText, Download, Building, MapPin, CheckCircle, XCircle, Store, Save, Utensils, FolderOpen, Plus, Trash2 } from "lucide-react"
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
   DialogFooter
} from "@/components/ui/dialog"
import useSWR from "swr"
import { createClient } from "@/utils/supabase/client"
import Image from "next/image"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Enhanced Fetcher for Role-based Access
const fetchTenants = async () => {
   const supabase = createClient()
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) return []

   const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
   const role = profile?.role

   let query = supabase.from('tenants').select('*').order('created_at', { ascending: false })

   // --- ORGANIZER FILTER ---
   if (role === 'organizer') {
      const { data: org } = await supabase.from('organizers').select('organizer_code').eq('profile_id', user.id).single()
      if (org && org.organizer_code) {
         query = query.eq('organizer_code', org.organizer_code)
      } else {
         return [] // No Tenants for unlinked organizer
      }
   }

   const { data: tenants, error } = await query
   if (error) throw error
   if (!tenants) return []

   const enrichedTenants = await Promise.all(tenants.map(async (tenant: any) => {
      const { data: locs } = await supabase.from('tenant_locations').select('*, locations(*)').eq('tenant_id', tenant.id)
      const { data: payments } = await supabase.from('tenant_payments').select('*').eq('tenant_id', tenant.id).eq('status', 'approved').order('payment_date', { ascending: false }).limit(1)

      const lastPayment = payments?.[0]
      let paymentStatus = 'active'
      let overdueLabel = ''
      const dateDisplay = lastPayment?.payment_date
         ? new Date(lastPayment.payment_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
         : "Tiada Rekod"

      if (!lastPayment) paymentStatus = 'new'
      else paymentStatus = 'paid'

      return {
         ...tenant,
         locations: locs?.map((l: any) => l.locations?.name) || [],
         lastPaymentDate: dateDisplay,
         lastPaymentAmount: lastPayment?.amount || 0,
         paymentStatus,
         overdueLabel
      }
   }))
   return enrichedTenants
}

// ... imports
import { useAuth } from "@/components/providers/auth-provider"
import { logAction } from "@/utils/logging"

// ... (fetchTenants remains same, or updated if needed, but sticking to client interactions)

export function TenantList({ initialTenants }: { initialTenants?: any[] }) {
   const { role } = useAuth() // Get Role
   const [filterStatus, setFilterStatus] = useState("all")
   const [searchQuery, setSearchQuery] = useState("")

   const tenants = useMemo(() => {
      return (initialTenants || [])
         .filter((t: any) => {
            if (filterStatus === "active" && t.status !== "active") return false
            if (filterStatus === "inactive" && t.status === "active") return false
            if (searchQuery && !t.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false
            return true
         })
         .sort((a: any, b: any) => {
            if (a.status === 'active' && b.status !== 'active') return -1
            if (a.status !== 'active' && b.status === 'active') return 1
            const nameA = a.full_name?.toLowerCase() || ""
            const nameB = b.full_name?.toLowerCase() || ""
            if (nameA < nameB) return -1
            if (nameA > nameB) return 1
            return 0
         })
   }, [initialTenants, filterStatus, searchQuery])

   const mutate = () => window.location.reload()

   const [selectedTenant, setSelectedTenant] = useState<any>(null)
   const [isDetailOpen, setIsDetailOpen] = useState(false)
   const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

   // Dialog Data States
   const [tenantTransactions, setTenantTransactions] = useState<any[]>([])
   const [tenantRentals, setTenantRentals] = useState<any[]>([])
   const [loadingDetails, setLoadingDetails] = useState(false)

   const [isUpdating, setIsUpdating] = useState(false)
   const supabase = createClient()

   // Add Tenant State
   const [isAddOpen, setIsAddOpen] = useState(false)
   const [newTenant, setNewTenant] = useState({
      name: '',
      business: '',
      phone: '',
      email: ''
   })
   const [addingTenant, setAddingTenant] = useState(false)
   // ...

   // ... (inside handleAddTenant)
   const handleAddTenant = async () => {
      if (!newTenant.name || !newTenant.business) {
         toast.error("Nama dan Nama Perniagaan wajib diisi")
         return
      }

      setAddingTenant(true)
      try {
         const payload: any = {
            full_name: newTenant.name,
            business_name: newTenant.business,
            phone_number: newTenant.phone,
            email: newTenant.email,
         }

         if (role === 'staff') {
            payload.status = 'pending'
         } else {
            payload.status = 'active'
         }

         const { data: newVal, error } = await supabase.from('tenants').insert(payload).select().single()

         if (error) throw error

         await logAction('CREATE', 'tenant', newVal.id, payload)
         toast.success(role === 'staff' ? "Peniaga didaftarkan. Menunggu kelulusan." : "Peniaga berjaya didaftarkan")

         setNewTenant({ name: '', business: '', phone: '', email: '' })
         setIsAddOpen(false)
         mutate()
      } catch (e: any) {
         toast.error("Gagal: " + e.message)
      } finally {
         setAddingTenant(false)
      }
   }

   // ... (handleDeleteTenant)
   const handleDeleteTenant = async (tenantId: number, tenantName: string) => {
      if (role === 'staff') return
      if (!confirm(`Adakah anda pasti mahu memadam peniaga "${tenantName}"? Tindakan ini tidak boleh dibatalkan.`)) {
         return
      }

      setIsUpdating(true)
      try {
         const { error } = await supabase.from('tenants').delete().eq('id', tenantId)

         if (error) throw error

         await logAction('DELETE', 'tenant', tenantId, {})
         toast.success(`Peniaga "${tenantName}" berjaya dipadam`)
         mutate()
      } catch (e: any) {
         toast.error("Gagal memadam: " + e.message)
      } finally {
         setIsUpdating(false)
      }
   }

   const handleTenantStatusChange = async (tenantId: number, newStatus: string) => {
      setIsUpdating(true)
      try {
         const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', tenantId)
         if (error) throw error
         toast.success(`Status peniaga dikemaskini ke ${newStatus}`)
         mutate()
      } catch (err: any) {
         toast.error(err.message)
      } finally {
         setIsUpdating(false)
      }
   }

   const handleViewTenant = async (tenant: any) => {
      setSelectedTenant(tenant)
      setIsDetailOpen(true)
      setLoadingDetails(true)

      const { data: txData } = await supabase
         .from('transactions')
         .select('*')
         .eq('tenant_id', tenant.id)
         .order('date', { ascending: false })
      setTenantTransactions(txData || [])

      const { data: rentalData } = await supabase
         .from('tenant_locations')
         .select('*, locations(*)')
         .eq('tenant_id', tenant.id)
         .order('created_at', { ascending: false })
      setTenantRentals(rentalData || [])

      setLoadingDetails(false)
   }

   const handleApproveTenant = async (tenantId: number) => {
      try {
         const { error } = await supabase.from('tenants').update({ status: 'active' }).eq('id', tenantId)
         if (error) throw error
         await logAction('APPROVE', 'tenant', tenantId, { status: 'active' })
         toast.success("Peniaga diluluskan")
         mutate()
      } catch (e: any) {
         toast.error("Gagal lulus: " + e.message)
      }
   }

   // ... (inside Table Loop)
   // <div className={cn("font-medium transition-colors", tenant.status === 'active' ? "text-brand-green font-bold" : "text-foreground")}>
   //    {tenant.full_name}
   //    {tenant.status === 'active' && <CheckCircle className="inline-block w-3 h-3 ml-1" />}
   //    {tenant.status === 'pending' && <Badge className="ml-2 bg-yellow-500 text-white text-[10px] h-4">Pending</Badge>}
   // </div>

   // ... (Tenant Status Switch)
   // <div className="flex justify-center items-center gap-2">
   //    {tenant.status === 'pending' && (role === 'admin' || role === 'superadmin') ? (
   //        <Button size="sm" className="h-6 bg-green-600 hover:bg-green-700 text-white text-[10px]" onClick={() => handleApproveTenant(tenant.id)}>
   //            <CheckCircle className="w-3 h-3 mr-1" /> Luluskan
   //        </Button>
   //    ) : (
   //      <>
   //        <Switch ... disabled={isUpdating || (role === 'staff' && tenant.status === 'pending')} />
   //      </>
   //    )}
   // </div>

   // ... (Delete Button)
   // {role !== 'staff' && (
   //    <Button ... onClick={() => handleDeleteTenant(tenant.id, tenant.full_name)}> <Trash2 size={16} /> </Button>
   // )}


   const handleAccountingStatusChange = async (tenantId: number, newAcctStatus: string) => {
      setIsUpdating(true)
      try {
         // Note: 'accounting_status' column must exist
         const { error } = await supabase.from('tenants').update({ accounting_status: newAcctStatus }).eq('id', tenantId)
         if (error) throw error
         toast.success(`Akses akaun dikemaskini ke ${newAcctStatus}`)
         mutate()
      } catch (err: any) {
         toast.error(err.message)
      } finally {
         setIsUpdating(false)
      }
   }

   const handleRentalStatusChange = async (rentalId: number, currentStatus: string) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      try {
         const { error } = await supabase.from('tenant_locations').update({ status: newStatus }).eq('id', rentalId)
         if (error) throw error
         setTenantRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: newStatus } : r))
         toast.success("Status tapak dikemaskini")
      } catch (e: any) {
         toast.error("Gagal kemaskini: " + e.message)
      }
   }

   const handleSaveStall = async (rentalId: number, stallNumber: string) => {
      try {
         const { error } = await supabase.from('tenant_locations').update({ stall_number: stallNumber }).eq('id', rentalId)
         if (error) throw error
         toast.success("No. Petak disimpan")
      } catch (e: any) {
         toast.error("Gagal simpan: " + e.message)
      }
   }

   const openWhatsApp = (phone: string | null) => {
      if (!phone) return
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, "_blank")
   }

   // Bulk Actions
   const toggleSelectAll = () => {
      if (selectedIds.size === tenants.length) {
         setSelectedIds(new Set())
      } else {
         setSelectedIds(new Set(tenants.map((t: any) => t.id)))
      }
   }

   const toggleSelection = (id: number) => {
      const newSet = new Set(selectedIds)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      setSelectedIds(newSet)
   }

   const handleBulkAction = async (action: 'general_active' | 'general_inactive' | 'accounting_active' | 'accounting_inactive') => {
      if (selectedIds.size === 0) return
      if (!confirm(`Anda pasti mahu mengemaskini ${selectedIds.size} peniaga?`)) return

      setIsUpdating(true)
      try {
         const ids = Array.from(selectedIds)
         let updateData = {}
         if (action === 'general_active') updateData = { status: 'active' }
         if (action === 'general_inactive') updateData = { status: 'inactive' }
         if (action === 'accounting_active') updateData = { accounting_status: 'active' }
         if (action === 'accounting_inactive') updateData = { accounting_status: 'inactive' }

         const { error } = await supabase.from('tenants').update(updateData).in('id', ids)
         if (error) throw error

         toast.success("Bulk update berjaya!")
         mutate()
         setSelectedIds(new Set())
      } catch (e: any) {
         toast.error("Bulk update gagal: " + e.message)
      } finally {
         setIsUpdating(false)
      }
   }

   return (
      <Card className="border-border/50 shadow-sm bg-white">
         <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <CardTitle className="font-serif text-2xl text-foreground">Pengurusan Peniaga & Sewa</CardTitle>
                  <CardDescription>Senarai peniaga aktif dan status pembayaran sewa terkini</CardDescription>
               </div>
               <div className="flex gap-2">
                  <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                     <DialogTrigger asChild>
                        <Button className="bg-primary text-white shadow-md rounded-xl"><Plus className="mr-2 w-4 h-4" /> Tambah Peniaga</Button>
                     </DialogTrigger>
                     <DialogContent>
                        <DialogHeader>
                           <DialogTitle>Daftar Peniaga Manual</DialogTitle>
                           <DialogDescription>Pendaftaran pantas untuk peniaga baru</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                           <div className="space-y-2">
                              <Label>Nama Penuh</Label>
                              <Input value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} />
                           </div>
                           <div className="space-y-2">
                              <Label>Nama Perniagaan</Label>
                              <Input value={newTenant.business} onChange={e => setNewTenant({ ...newTenant, business: e.target.value })} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <Label>No. Telefon</Label>
                                 <Input value={newTenant.phone} onChange={e => setNewTenant({ ...newTenant, phone: e.target.value })} placeholder="012..." />
                              </div>
                              <div className="space-y-2">
                                 <Label>Emel (Pilihan)</Label>
                                 <Input value={newTenant.email} onChange={e => setNewTenant({ ...newTenant, email: e.target.value })} />
                              </div>
                           </div>
                        </div>
                        <DialogFooter>
                           <Button onClick={handleAddTenant} disabled={addingTenant}>Simpan</Button>
                        </DialogFooter>
                     </DialogContent>
                  </Dialog>
               </div>
            </div>

            {/* Filters & Bulk Actions */}
            <div className="flex flex-col md:flex-row gap-4 mt-4 items-center justify-between bg-secondary/10 p-3 rounded-xl border border-border/50">
               <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input
                     placeholder="Cari nama..."
                     className="h-9 w-full md:w-[200px] bg-white"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <select
                     className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm md:w-[150px]"
                     value={filterStatus}
                     onChange={(e) => setFilterStatus(e.target.value)}
                  >
                     <option value="all">Semua Status</option>
                     <option value="active">Aktif Sahaja</option>
                     <option value="inactive">Tidak Aktif</option>
                  </select>
               </div>

               {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                     <span className="text-xs font-bold text-muted-foreground mr-2">{selectedIds.size} dipilih</span>
                     <Button size="sm" variant="outline" onClick={() => handleBulkAction('general_active')} disabled={isUpdating}>Set Aktif (Umum)</Button>
                     <Button size="sm" variant="outline" onClick={() => handleBulkAction('accounting_active')} disabled={isUpdating}>Set Akaun ON</Button>
                  </div>
               )}
            </div>
         </CardHeader>
         <CardContent>
            <div className="overflow-x-auto">
               <Table>
                  <TableHeader className="bg-secondary/20">
                     <TableRow className="border-border/50">
                        <TableHead className="w-[40px]">
                           <input
                              type="checkbox"
                              className="accent-primary w-4 h-4"
                              checked={tenants.length > 0 && selectedIds.size === tenants.length}
                              onChange={toggleSelectAll}
                           />
                        </TableHead>
                        <TableHead className="text-foreground font-bold">Nama Peniaga</TableHead>
                        <TableHead className="text-foreground font-bold">Lokasi Tapak</TableHead>
                        <TableHead className="text-foreground font-bold text-center">Status Umum</TableHead>
                        <TableHead className="text-foreground font-bold text-center">Module Akaun</TableHead>
                        <TableHead className="text-right text-foreground font-bold">Tindakan</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {tenants?.map((tenant: any) => (
                        <TableRow key={tenant.id} className="border-border/30 hover:bg-secondary/10 transition-colors">
                           <TableCell>
                              <input
                                 type="checkbox"
                                 className="accent-primary w-4 h-4"
                                 checked={selectedIds.has(tenant.id)}
                                 onChange={() => toggleSelection(tenant.id)}
                              />
                           </TableCell>
                           <TableCell>
                              <div className="flex items-center gap-3">
                                 {tenant.profile_image_url ? (
                                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-border">
                                       <Image src={tenant.profile_image_url} alt="Profile" fill className="object-cover" />
                                    </div>
                                 ) : (
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                                       {tenant.full_name?.charAt(0)}
                                    </div>
                                 )}
                                 <div>
                                    <div className={cn("font-medium transition-colors", tenant.status === 'active' ? "text-brand-green font-bold" : "text-foreground")}>
                                       {tenant.full_name}
                                       {tenant.status === 'active' && <CheckCircle className="inline-block w-3 h-3 ml-1" />}
                                       {tenant.status === 'pending' && <Badge className="ml-2 bg-yellow-500 text-white text-[10px] h-4">Pending</Badge>}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono">{tenant.business_name}</div>
                                 </div>
                              </div>
                           </TableCell>
                           <TableCell>
                              <div className="flex flex-wrap gap-1">
                                 {tenant.locations.map((loc: string, i: number) => (
                                    <span key={i} className="text-xs bg-secondary px-2 py-0.5 rounded-full border border-border/50">{loc}</span>
                                 ))}
                              </div>
                           </TableCell>
                           <TableCell className="text-center">
                              <div className="flex justify-center items-center gap-2">
                                 {tenant.status === 'pending' && (role === 'admin' || role === 'superadmin') ? (
                                    <Button size="sm" className="h-6 bg-green-600 hover:bg-green-700 text-white text-[10px]" onClick={() => handleApproveTenant(tenant.id)}>
                                       <CheckCircle className="w-3 h-3 mr-1" /> Luluskan
                                    </Button>
                                 ) : (
                                    <>
                                       <Switch
                                          checked={tenant.status === 'active'}
                                          onCheckedChange={() => handleTenantStatusChange(tenant.id, tenant.status === 'active' ? 'inactive' : 'active')}
                                          disabled={isUpdating || (role === 'staff' && tenant.status === 'pending')}
                                       />
                                       <span className="text-[10px] uppercase font-bold w-12 text-left text-muted-foreground">{tenant.status === 'active' ? 'Aktif' : 'Pasif'}</span>
                                    </>
                                 )}
                              </div>
                           </TableCell>
                           <TableCell className="text-center">
                              <div className="flex justify-center items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                 <Switch
                                    checked={tenant.accounting_status === 'active'}
                                    onCheckedChange={() => handleAccountingStatusChange(tenant.id, tenant.accounting_status === 'active' ? 'inactive' : 'active')}
                                    disabled={isUpdating}
                                    className="data-[state=checked]:bg-blue-600"
                                 />
                                 <span className={cn("text-[10px] uppercase font-bold w-10 text-left", tenant.accounting_status === 'active' ? "text-blue-600" : "text-slate-400")}>
                                    {tenant.accounting_status === 'active' ? 'ON' : 'OFF'}
                                 </span>
                              </div>
                           </TableCell>
                           <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => handleViewTenant(tenant)}>
                                    <Eye size={16} />
                                 </Button>
                                 {role !== 'staff' && (
                                    <Button
                                       variant="ghost"
                                       size="icon"
                                       className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                       onClick={() => handleDeleteTenant(tenant.id, tenant.full_name)}
                                    >
                                       <Trash2 size={16} />
                                    </Button>
                                 )}
                              </div>
                           </TableCell>
                        </TableRow>
                     ))}
                     {tenants?.length === 0 && (
                        <TableRow>
                           <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                              Tiada peniaga dijumpai.
                           </TableCell>
                        </TableRow>
                     )}
                  </TableBody>
               </Table>
            </div>
         </CardContent>

         {/* Global Detail Dialog */}
         <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent className="bg-white border-border sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
               <DialogHeader>
                  <DialogTitle className="text-2xl font-serif text-foreground">Maklumat Peniaga</DialogTitle>
               </DialogHeader>
               {selectedTenant && (
                  <div className="space-y-6 py-4">
                     {/* Header Profile */}
                     <div className="flex items-start gap-4 p-4 bg-secondary/10 rounded-2xl border border-border/50">
                        <div className="relative w-16 h-16 rounded-full overflow-hidden border border-border bg-white shrink-0">
                           {selectedTenant.profile_image_url ? <Image src={selectedTenant.profile_image_url} alt="Profile" fill className="object-cover" /> :
                              <div className="w-full h-full flex items-center justify-center font-bold text-xl">{selectedTenant.full_name?.charAt(0)}</div>}
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
                           <div>
                              <p className="text-xs text-muted-foreground font-bold uppercase">Nama Peniaga</p>
                              <p className="font-bold">{selectedTenant.full_name}</p>
                           </div>
                           <div>
                              <p className="text-xs text-muted-foreground font-bold uppercase">Perniagaan</p>
                              <p className="font-medium">{selectedTenant.business_name}</p>
                           </div>
                           <div>
                              <p className="text-xs text-muted-foreground font-bold uppercase">Telefon</p>
                              <p className="font-mono">{selectedTenant.phone_number}</p>
                           </div>
                           <div>
                              <p className="text-xs text-muted-foreground font-bold uppercase">Status Akaun (Gen)</p>
                              <p className="font-mono">{selectedTenant.status}</p>
                           </div>
                           <div>
                              <p className="text-xs text-muted-foreground font-bold uppercase">Status Module Akaun</p>
                              <Badge variant={selectedTenant.accounting_status === 'active' ? 'default' : 'secondary'}>{selectedTenant.accounting_status || 'inactive'}</Badge>
                           </div>
                        </div>
                     </div>

                     {/* Document Attachments */}
                     <div>
                        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2 text-sm">
                           <FileText className="w-4 h-4 text-primary" /> Dokumen Lampiran
                        </h3>
                        <div className="flex gap-2 flex-wrap">
                           {selectedTenant.ssm_file_url && (
                              <Badge variant="outline" className="cursor-pointer hover:bg-secondary p-2 flex gap-2" onClick={() => window.open(selectedTenant.ssm_file_url)}>
                                 <Building size={14} /> Sijil SSM
                              </Badge>
                           )}
                           {selectedTenant.food_handling_cert_url && (
                              <Badge variant="outline" className="cursor-pointer hover:bg-secondary p-2 flex gap-2" onClick={() => window.open(selectedTenant.food_handling_cert_url)}>
                                 <Utensils size={14} /> Sijil Makanan
                              </Badge>
                           )}
                           {selectedTenant.other_docs_url && (
                              <Badge variant="outline" className="cursor-pointer hover:bg-secondary p-2 flex gap-2" onClick={() => window.open(selectedTenant.other_docs_url)}>
                                 <FolderOpen size={14} /> Dokumen Lain
                              </Badge>
                           )}
                           {!selectedTenant.ssm_file_url && !selectedTenant.food_handling_cert_url && !selectedTenant.other_docs_url && (
                              <p className="text-xs text-muted-foreground italic">Tiada dokumen dilampirkan.</p>
                           )}
                        </div>
                     </div>

                     {/* Rental Management Section */}
                     <div>
                        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                           <Store className="w-4 h-4 text-primary" /> Pengurusan Tapak (Rentals)
                        </h3>
                        <div className="border border-border/50 rounded-xl overflow-hidden">
                           {loadingDetails ? <div className="p-4 text-center"><Loader2 className="animate-spin inline" /></div> :
                              tenantRentals.length > 0 ? (
                                 <Table>
                                    <TableHeader className="bg-secondary/20">
                                       <TableRow className="h-10">
                                          <TableHead>Lokasi</TableHead>
                                          <TableHead>Jenis</TableHead>
                                          <TableHead className="w-[140px]">No. Petak</TableHead>
                                          <TableHead className="text-center w-[120px]">Status</TableHead>
                                       </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                       {tenantRentals.map((rental) => (
                                          <TableRow key={rental.id}>
                                             <TableCell className="font-medium">
                                                {rental.locations?.name}
                                                <span className="block text-[10px] text-muted-foreground">{rental.locations?.operating_days}</span>
                                             </TableCell>
                                             <TableCell className="capitalize text-xs">{rental.rate_type}</TableCell>
                                             <TableCell>
                                                <div className="flex items-center gap-1">
                                                   <Input
                                                      className="h-8 text-xs w-20 bg-white"
                                                      defaultValue={rental.stall_number || ""}
                                                      onBlur={(e) => handleSaveStall(rental.id, e.target.value)}
                                                      placeholder="A-01"
                                                   />
                                                </div>
                                             </TableCell>
                                             <TableCell className="text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                   <Switch
                                                      checked={rental.status === 'active'}
                                                      onCheckedChange={() => handleRentalStatusChange(rental.id, rental.status)}
                                                   />
                                                   <span className={cn("text-[10px] font-bold w-10 text-left", rental.status === 'active' ? "text-brand-green" : "text-amber-600")}>
                                                      {rental.status === 'active' ? 'Aktif' : 'Pend.'}
                                                   </span>
                                                </div>
                                             </TableCell>
                                          </TableRow>
                                       ))}
                                    </TableBody>
                                 </Table>
                              ) : (
                                 <div className="p-4 text-center text-sm text-muted-foreground">Tiada tapak sewa.</div>
                              )}
                        </div>
                     </div>

                     <div className="flex gap-3 pt-2">
                        <Button className="flex-1 bg-brand-green hover:bg-brand-green/90 text-white font-bold" onClick={() => openWhatsApp(selectedTenant.phone_number)}>
                           <Phone className="mr-2 h-4 w-4" /> WhatsApp
                        </Button>
                     </div>
                  </div>
               )}
            </DialogContent>
         </Dialog>
      </Card>
   )
}

"use client"

import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  MessageSquare, Eye, Phone, Loader2, AlertCircle, Calendar, FileText, 
  Download, Building, MapPin, CheckCircle, XCircle, Store, Save, 
  Utensils, FolderOpen, Plus, Trash2, Clock, User, Ban
} from "lucide-react"
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
   DialogFooter
} from "@/components/ui/dialog"
import { createClient } from "@/utils/supabase/client"
import Image from "next/image"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { logAction } from "@/utils/logging"
import { toggleAccountingStatusAction } from "@/actions/tenant"
import { PendingApprovalsCombined } from "./pending-approvals-combined"
import { processTenantRequestAction } from "@/actions/tenant-organizer"

interface TenantListEnhancedProps {
   initialTenants?: any[]
   organizerId?: string
   isAdmin?: boolean
}

export function TenantListEnhanced({ initialTenants, organizerId, isAdmin = false }: TenantListEnhancedProps) {
   const { role, user } = useAuth()
   const router = useRouter()
   const supabase = createClient()
   
   const [activeTab, setActiveTab] = useState("active")
   const [filterStatus, setFilterStatus] = useState("all")
   const [searchQuery, setSearchQuery] = useState("")
   const [isRefreshing, setIsRefreshing] = useState(false)
   const [pendingRequestCount, setPendingRequestCount] = useState(0)

   // Detail dialog states
   const [selectedTenant, setSelectedTenant] = useState<any>(null)
   const [isDetailOpen, setIsDetailOpen] = useState(false)
   const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
   const [tenantTransactions, setTenantTransactions] = useState<any[]>([])
   const [tenantRentals, setTenantRentals] = useState<any[]>([])
   const [loadingDetails, setLoadingDetails] = useState(false)
   const [isUpdating, setIsUpdating] = useState(false)
   const [isApprovingLocation, setIsApprovingLocation] = useState(false)
   
   // Add tenant states
   const [isAddOpen, setIsAddOpen] = useState(false)
   const [newTenant, setNewTenant] = useState({
      name: '',
      business: '',
      phone: '',
      email: ''
   })
   const [addingTenant, setAddingTenant] = useState(false)

   // Fetch pending request count (organizer links, location requests, AND rental payments)
   useEffect(() => {
      const fetchPendingCount = async () => {
         // Count pending organizer links
         let orgQuery = supabase
            .from('tenant_organizers')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
         
         if (organizerId) {
            orgQuery = orgQuery.eq('organizer_id', organizerId)
         }
         
         const { count: orgCount, error: orgError } = await orgQuery
         
         // Count pending location requests
         let locQuery = supabase
            .from('tenant_locations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .eq('is_active', true)
         
         if (organizerId) {
            locQuery = locQuery.eq('organizer_id', organizerId)
         }
         
         const { count: locCount, error: locError } = await locQuery
         
         // Count pending rental payments
         // All users (including admins) should only see payments from their own organization
         let paymentCount = 0
         if (organizerId) {
            // For organizers, get payments from their tenants
            const { data: tenantLocs } = await supabase
               .from('tenant_locations')
               .select('tenant_id')
               .eq('organizer_id', organizerId)
               .eq('is_active', true)
            
            const tenantIds = tenantLocs?.map(tl => tl.tenant_id) || []
            
            if (tenantIds.length > 0) {
               const { count: pCount, error: pError } = await supabase
                  .from('tenant_payments')
                  .select('id', { count: 'exact', head: true })
                  .eq('status', 'pending')
                  .in('tenant_id', tenantIds)
               
               if (!pError) {
                  paymentCount = pCount || 0
               }
            }
         }
         
         if (!orgError && !locError) {
            setPendingRequestCount((orgCount || 0) + (locCount || 0) + paymentCount)
         }
      }
      
      fetchPendingCount()
   }, [supabase, organizerId, isRefreshing, isAdmin])

   // Calculate counts from initialTenants
   const activeCount = initialTenants?.filter(t => 
      (t.link_status === 'active' || (!t.link_status && t.status === 'active'))
   ).length || 0
   
   const inactiveCount = initialTenants?.filter(t => {
      const status = t.link_status || t.status
      return status === 'inactive' || status === 'rejected'
   }).length || 0

   const tenants = useMemo(() => {
      return (initialTenants || [])
         .filter((t: any) => {
            const status = t.link_status || t.status
            if (filterStatus === "active" && status !== "active") return false
            if (filterStatus === "inactive" && status !== "inactive") return false
            if (filterStatus === "pending" && status !== "pending") return false
            if (searchQuery && !t.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false
            return true
         })
         .sort((a: any, b: any) => {
            const statusA = a.link_status || a.status
            const statusB = b.link_status || b.status
            if (statusA === 'active' && statusB !== 'active') return -1
            if (statusA !== 'active' && statusB === 'active') return 1
            const nameA = a.full_name?.toLowerCase() || ""
            const nameB = b.full_name?.toLowerCase() || ""
            if (nameA < nameB) return -1
            if (nameA > nameB) return 1
            return 0
         })
   }, [initialTenants, filterStatus, searchQuery])

   const mutate = () => {
      router.refresh()
   }

   const handleRefresh = () => {
      setIsRefreshing(true)
      mutate()
      setTimeout(() => setIsRefreshing(false), 500)
   }

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
         console.error('Tenant save error:', e)
         toast.error("Gagal: " + e.message)
      } finally {
         setAddingTenant(false)
      }
   }

   const handleDeleteTenant = async (tenantId: number, tenantName: string) => {
      if (role === 'staff') return
      if (!confirm(`Adakah anda pasti mahu memadam peniaga "${tenantName}"?`)) return

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

   const handleTenantStatusChange = async (tenant: any, newStatus: string) => {
      setIsUpdating(true)
      try {
         if (tenant.link_id) {
            // Tenant linked via tenant_organizers table
            const { error } = await supabase.from('tenant_organizers').update({ status: newStatus }).eq('id', tenant.link_id)
            if (error) throw error
         } else if (tenant.locations?.length > 0 && organizerId) {
            // Tenant linked via tenant_locations - update all their locations for this organizer
            const { error } = await supabase
               .from('tenant_locations')
               .update({ status: newStatus, is_active: newStatus === 'active' })
               .eq('tenant_id', tenant.id)
               .eq('organizer_id', organizerId)
            if (error) throw error
         } else {
            // Fallback: update tenant's global status
            const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', tenant.id)
            if (error) throw error
         }
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
         .from('organizer_transactions')
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

   const handleApproveLocation = async (rentalId: number) => {
      setIsApprovingLocation(true)
      try {
         const { error } = await supabase
            .from('tenant_locations')
            .update({ status: 'approved' })
            .eq('id', rentalId)
         
         if (error) throw error
         
         toast.success("Tapak diluluskan. Peniaga perlu memilih kategori sewaan.")
         
         // Refresh the rentals list
         if (selectedTenant) {
            const { data: rentalData } = await supabase
               .from('tenant_locations')
               .select('*, locations(*)')
               .eq('tenant_id', selectedTenant.id)
               .order('created_at', { ascending: false })
            setTenantRentals(rentalData || [])
         }
         
         mutate()
      } catch (e: any) {
         toast.error("Gagal meluluskan: " + e.message)
      } finally {
         setIsApprovingLocation(false)
      }
   }

   const handleRejectLocation = async (rentalId: number) => {
      if (!confirm("Adakah anda pasti mahu menolak permohonan tapak ini?")) return
      
      setIsApprovingLocation(true)
      try {
         const { error } = await supabase
            .from('tenant_locations')
            .update({ status: 'rejected', is_active: false })
            .eq('id', rentalId)
         
         if (error) throw error
         
         toast.success("Permohonan tapak ditolak.")
         
         // Refresh the rentals list
         if (selectedTenant) {
            const { data: rentalData } = await supabase
               .from('tenant_locations')
               .select('*, locations(*)')
               .eq('tenant_id', selectedTenant.id)
               .order('created_at', { ascending: false })
            setTenantRentals(rentalData || [])
         }
         
         mutate()
      } catch (e: any) {
         toast.error("Gagal menolak: " + e.message)
      } finally {
         setIsApprovingLocation(false)
      }
   }

   const handleApproveTenant = async (tenant: any) => {
      try {
         if (tenant.link_id) {
            // Approve via tenant_organizers
            const { error } = await supabase.from('tenant_organizers').update({ status: 'active' }).eq('id', tenant.link_id)
            if (error) throw error
            await logAction('APPROVE', 'tenant_link', tenant.link_id, { status: 'active' })
         } else if (tenant.locations?.length > 0 && organizerId) {
            // Approve via tenant_locations for this organizer
            const { error } = await supabase
               .from('tenant_locations')
               .update({ status: 'active', is_active: true })
               .eq('tenant_id', tenant.id)
               .eq('organizer_id', organizerId)
            if (error) throw error
            await logAction('APPROVE', 'tenant_locations', tenant.id, { status: 'active', organizer_id: organizerId })
         } else {
            // Fallback: update tenant's global status
            const { error } = await supabase.from('tenants').update({ status: 'active' }).eq('id', tenant.id)
            if (error) throw error
            await logAction('APPROVE', 'tenant', tenant.id, { status: 'active' })
         }
         toast.success("Peniaga diluluskan")
         mutate()
      } catch (e: any) {
         toast.error("Gagal lulus: " + e.message)
      }
   }

   const handleAccountingStatusChange = async (tenantId: number, currentStatus: string) => {
      const newAcctStatus = currentStatus === 'active' ? 'inactive' : 'active'
      setIsUpdating(true)
      try {
         const result = await toggleAccountingStatusAction(tenantId, newAcctStatus)
         if (!result.success) throw new Error(result.error)
         toast.success(`Akses akaun dikemaskini ke ${newAcctStatus}`)
         mutate()
      } catch (err: any) {
         toast.error(err.message)
      } finally {
         setIsUpdating(false)
      }
   }

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

   const openWhatsApp = (phone: string | null) => {
      if (!phone) return
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, "_blank")
   }

   // Filter tenants for each tab
   const activeTenants = tenants.filter((t: any) => {
      const status = t.link_status || t.status
      return status === 'active'
   })
   
   const inactiveTenants = tenants.filter((t: any) => {
      const status = t.link_status || t.status
      return status === 'inactive' || status === 'rejected'
   })

   return (
      <Card className="border-border/50 shadow-sm bg-white">
         <CardHeader>
            <div className="flex flex-col gap-4">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                     <CardTitle className="font-serif text-2xl text-foreground">Pengurusan Peniaga & Sewa</CardTitle>
                     <CardDescription>Senarai peniaga aktif dan status pembayaran sewa terkini</CardDescription>
                  </div>
                  <div className="flex gap-2">
                     <Button 
                        variant="outline" 
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                     >
                        <Loader2 className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                     </Button>
                     <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                           <Button className="bg-primary text-white shadow-md rounded-xl">
                              <Plus className="mr-2 w-4 h-4" /> Tambah Peniaga
                           </Button>
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

               {/* Tabs */}
               <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="bg-muted/50 p-1 rounded-xl w-full md:w-auto">
                     <TabsTrigger value="active" className="rounded-lg flex gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Peniaga Aktif
                        <Badge variant="secondary" className="ml-1 text-xs">
                           {activeCount}
                        </Badge>
                     </TabsTrigger>
                     <TabsTrigger value="pending" className="rounded-lg flex gap-2">
                        <Clock className="w-4 h-4" />
                        Menunggu Kelulusan
                        {pendingRequestCount > 0 && (
                           <Badge variant="destructive" className="ml-1 text-xs animate-pulse">
                              {pendingRequestCount}
                           </Badge>
                        )}
                     </TabsTrigger>
                     <TabsTrigger value="inactive" className="rounded-lg flex gap-2">
                        <Ban className="w-4 h-4" />
                        Tidak Aktif
                        <Badge variant="secondary" className="ml-1 text-xs">
                           {inactiveCount}
                        </Badge>
                     </TabsTrigger>
                  </TabsList>

                  {/* Active Tenants Tab */}
                  <TabsContent value="active" className="mt-4 space-y-4">
                     {/* Filters */}
                     <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-secondary/10 p-3 rounded-xl border border-border/50">
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
                              <Button size="sm" variant="outline" onClick={() => handleBulkAction('general_active')} disabled={isUpdating}>Set Aktif</Button>
                              <Button size="sm" variant="outline" onClick={() => handleBulkAction('accounting_active')} disabled={isUpdating}>Set Akaun ON</Button>
                           </div>
                        )}
                     </div>

                     {/* Tenants Table */}
                     <div className="overflow-x-auto">
                        <Table>
                           <TableHeader className="bg-secondary/20">
                              <TableRow className="border-border/50">
                                 <TableHead className="w-[40px]">
                                    <input
                                       type="checkbox"
                                       className="accent-primary w-4 h-4"
                                       checked={activeTenants.length > 0 && selectedIds.size === activeTenants.length}
                                       onChange={toggleSelectAll}
                                    />
                                 </TableHead>
                                 <TableHead className="text-foreground font-bold">Nama Peniaga</TableHead>
                                 <TableHead className="text-foreground font-bold">Penganjur</TableHead>
                                 <TableHead className="text-foreground font-bold">Lokasi Tapak</TableHead>
                                 <TableHead className="text-foreground font-bold text-center">Status</TableHead>
                                 <TableHead className="text-foreground font-bold text-center">Module Akaun</TableHead>
                                 <TableHead className="text-right text-foreground font-bold">Tindakan</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {activeTenants.map((tenant: any) => (
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
                                             <div className="font-medium text-brand-green font-bold">
                                                {tenant.full_name}
                                                <CheckCircle className="inline-block w-3 h-3 ml-1" />
                                             </div>
                                             <div className="text-xs text-muted-foreground font-mono">{tenant.business_name}</div>
                                          </div>
                                       </div>
                                    </TableCell>
                                    <TableCell>
                                       <div className="text-xs font-medium text-muted-foreground">
                                          {tenant.organizerName || tenant.organizer_code || '-'}
                                       </div>
                                    </TableCell>
                                    <TableCell>
                                       <div className="flex flex-col justify-center min-h-[40px]">
                                          {tenant.locations?.length === 0 ? (
                                             <span className="text-muted-foreground text-xs text-center">-</span>
                                          ) : (
                                             <Badge variant="outline" className="text-[10px] px-2 h-5 font-normal bg-white text-muted-foreground">
                                                {tenant.locations.length} Tapak
                                             </Badge>
                                          )}
                                       </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                       <div className="flex justify-center items-center gap-2">
                                          <Switch
                                             checked={true}
                                             onCheckedChange={() => handleTenantStatusChange(tenant, 'inactive')}
                                             disabled={isUpdating}
                                          />
                                          <span className="text-[10px] uppercase font-bold w-12 text-left text-muted-foreground">
                                             Aktif
                                          </span>
                                       </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                       <div className="flex justify-center items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                          <Switch
                                             checked={tenant.accounting_status === 'active'}
                                             onCheckedChange={() => handleAccountingStatusChange(tenant.id, tenant.accounting_status)}
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
                              {activeTenants.length === 0 && (
                                 <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                       Tiada peniaga aktif dijumpai.
                                    </TableCell>
                                 </TableRow>
                              )}
                           </TableBody>
                        </Table>
                     </div>
                  </TabsContent>

                  {/* Pending Approval Tab */}
                  <TabsContent value="pending" className="mt-4">
                     <PendingApprovalsCombined 
                        organizerId={organizerId}
                        isAdmin={isAdmin}
                        onRefresh={handleRefresh}
                     />
                  </TabsContent>

                  {/* Inactive Tab */}
                  <TabsContent value="inactive" className="mt-4">
                     <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                           <CardTitle className="text-lg font-serif flex items-center gap-2">
                              <Ban className="w-5 h-5 text-muted-foreground" />
                              Akaun Tidak Aktif
                           </CardTitle>
                           <CardDescription>
                              Senarai peniaga dengan akaun tidak aktif atau ditolak
                           </CardDescription>
                        </CardHeader>
                        <CardContent>
                           <div className="overflow-x-auto">
                              <Table>
                                 <TableHeader className="bg-secondary/20">
                                    <TableRow className="border-border/50">
                                       <TableHead className="text-foreground font-bold">Nama Peniaga</TableHead>
                                       <TableHead className="text-foreground font-bold">Perniagaan</TableHead>
                                       <TableHead className="text-foreground font-bold">Status</TableHead>
                                       <TableHead className="text-right text-foreground font-bold">Tindakan</TableHead>
                                    </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                    {inactiveTenants.map((tenant: any) => (
                                       <TableRow key={tenant.id} className="border-border/30 hover:bg-secondary/10 transition-colors">
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
                                                   <div className="font-medium text-muted-foreground">
                                                      {tenant.full_name}
                                                   </div>
                                                   <div className="text-xs text-muted-foreground font-mono">{tenant.phone_number}</div>
                                                </div>
                                             </div>
                                          </TableCell>
                                          <TableCell>
                                             <div className="text-sm text-muted-foreground">{tenant.business_name || '-'}</div>
                                          </TableCell>
                                          <TableCell>
                                             <Badge variant="secondary" className={cn(
                                                "text-[10px] uppercase",
                                                tenant.status === 'rejected' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                                             )}>
                                                {tenant.status === 'rejected' ? 'Ditolak' : 'Tidak Aktif'}
                                             </Badge>
                                          </TableCell>
                                          <TableCell className="text-right">
                                             <div className="flex justify-end gap-2">
                                                <Button 
                                                   size="sm" 
                                                   variant="outline"
                                                   className="h-8 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                                   onClick={() => handleApproveTenant(tenant)}
                                                >
                                                   <CheckCircle className="w-4 h-4 mr-1" />
                                                   Aktifkan
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => handleViewTenant(tenant)}>
                                                   <Eye size={16} />
                                                </Button>
                                             </div>
                                          </TableCell>
                                       </TableRow>
                                    ))}
                                    {inactiveTenants.length === 0 && (
                                       <TableRow>
                                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                             Tiada akaun tidak aktif.
                                          </TableCell>
                                       </TableRow>
                                    )}
                                 </TableBody>
                              </Table>
                           </div>
                        </CardContent>
                     </Card>
                  </TabsContent>
               </Tabs>
            </div>
         </CardHeader>

         {/* Detail Dialog */}
         <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent className="bg-white border-border sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
               <DialogHeader>
                  <DialogTitle className="text-2xl font-serif text-foreground">Maklumat Peniaga</DialogTitle>
               </DialogHeader>
               {selectedTenant && (
                  <div className="space-y-6 py-4">
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
                              <p className="text-xs text-muted-foreground font-bold uppercase">Status</p>
                              <p className="font-mono">{selectedTenant.link_status || selectedTenant.status}</p>
                           </div>
                        </div>
                     </div>

                     {/* Rentals Section with Approve/Reject Buttons */}
                     <div>
                        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                           <Store className="w-4 h-4 text-primary" /> Pengurusan Tapak
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
                                          <TableHead className="text-center">Status</TableHead>
                                          <TableHead className="text-right">Tindakan</TableHead>
                                       </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                       {tenantRentals.map((rental) => (
                                          <TableRow key={rental.id}>
                                             <TableCell className="font-medium">
                                                {rental.locations?.name}
                                             </TableCell>
                                             <TableCell className="capitalize text-xs">{rental.rate_type}</TableCell>
                                             <TableCell>
                                                <Input
                                                   className="h-8 text-xs w-20 bg-white"
                                                   defaultValue={rental.stall_number || ""}
                                                   placeholder="A-01"
                                                />
                                             </TableCell>
                                             <TableCell className="text-center">
                                                <Badge variant={rental.status === 'pending' ? 'secondary' : rental.status === 'active' ? 'default' : 'outline'}
                                                   className={cn(
                                                      "text-[10px]",
                                                      rental.status === 'pending' && "bg-amber-100 text-amber-700 animate-pulse",
                                                      rental.status === 'active' && "bg-green-100 text-green-700"
                                                   )}
                                                >
                                                   {rental.status}
                                                </Badge>
                                             </TableCell>
                                             <TableCell className="text-right">
                                                {rental.status === 'pending' && (
                                                   <div className="flex justify-end gap-2">
                                                      <Button 
                                                         size="sm" 
                                                         className="h-7 bg-green-600 hover:bg-green-700 text-white text-[10px]"
                                                         onClick={() => handleApproveLocation(rental.id)}
                                                         disabled={isApprovingLocation}
                                                      >
                                                         <CheckCircle className="w-3 h-3 mr-1" />
                                                         Lulus
                                                      </Button>
                                                      <Button 
                                                         size="sm" 
                                                         variant="outline"
                                                         className="h-7 border-red-200 text-red-600 hover:bg-red-50 text-[10px]"
                                                         onClick={() => handleRejectLocation(rental.id)}
                                                         disabled={isApprovingLocation}
                                                      >
                                                         <XCircle className="w-3 h-3 mr-1" />
                                                         Tolak
                                                      </Button>
                                                   </div>
                                                )}
                                                {rental.status === 'active' && (
                                                   <span className="text-xs text-green-600 font-medium">Aktif</span>
                                                )}
                                                {rental.status === 'rejected' && (
                                                   <span className="text-xs text-red-600 font-medium">Ditolak</span>
                                                )}
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

"use client"

import { useRouter } from "next/navigation"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Search, Building, User, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useSWR from "swr"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ... imports
import { useAuth } from "@/components/providers/auth-provider"
import { logAction } from "@/utils/logging"

const fetchOrganizers = async () => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('organizers')
    .select('*, locations(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function OrganizerModule({ initialOrganizers }: { initialOrganizers?: any[] }) {
  const router = useRouter()
  const { role } = useAuth() // Get role
  
  // Use SWR for fresh data after mutations
  const { data: organizersData, mutate } = useSWR('organizers', fetchOrganizers, {
    fallbackData: initialOrganizers,
    revalidateOnMount: false
  })
  const organizers = organizersData || initialOrganizers || []

  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)

  const [newOrg, setNewOrg] = useState({ name: '', code: '', email: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Quick Add Location State
  const [isLocDialogOpen, setIsLocDialogOpen] = useState(false)
  const [selectedOrgForLoc, setSelectedOrgForLoc] = useState<any>(null)
  const [newLoc, setNewLoc] = useState({ name: '', type: 'daily' as 'daily' | 'monthly' })
  const [isAddingLoc, setIsAddingLoc] = useState(false)

  const supabase = createClient()

  const resetForm = () => {
    setNewOrg({ name: '', code: '', email: '' })
    setIsEditing(false)
    setCurrentId(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setIsOpen(true)
  }

  const handleOpenEdit = (org: any) => {
    setNewOrg({ name: org.name, code: org.organizer_code, email: org.email || '' })
    setIsEditing(true)
    setCurrentId(org.id)
    setIsOpen(true)
  }

  const handleSubmit = async () => {
    if (!newOrg.name || !newOrg.code) {
      toast.error("Nama dan Kod wajib diisi")
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing && currentId) {
        // Update
        const payload = {
          name: newOrg.name,
          email: newOrg.email
        }
        const { error } = await supabase.from('organizers').update(payload).eq('id', currentId)
        if (error) throw error

        await logAction('UPDATE', 'organizer', currentId, payload)
        toast.success(role === 'staff' ? "Penganjur dikemaskini (Log direkod)" : "Penganjur dikemaskini")
      } else {
        // Create
        const payload: any = {
          name: newOrg.name,
          organizer_code: newOrg.code.toUpperCase(),
          email: newOrg.email,
          accounting_status: 'inactive'
        }

        if (role === 'staff') {
          payload.status = 'pending'
        } else {
          payload.status = 'active'
        }

        const { data: newVal, error } = await supabase.from('organizers').insert(payload).select().single()
        if (error) throw error

        await logAction('CREATE', 'organizer', newVal.id, payload)
        toast.success(role === 'staff' ? "Penganjur ditambah. Menunggu kelulusan." : "Penganjur berjaya ditambah")
      }

      setIsOpen(false)
      resetForm()
      mutate()
    } catch (e: any) {
      console.error('Organizer save error:', e)
      const errorMsg = e.message || ''
      if (errorMsg.includes('row-level security') || errorMsg.includes('RLS') || errorMsg.includes('permission denied')) {
        toast.error("Akses ditolak: Anda tidak mempunyai kebenaran untuk tindakan ini. Sila pastikan anda log masuk sebagai Admin.")
      } else {
        toast.error("Gagal: " + e.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (id: number, field: string, currentValue: string) => {
    // Prevent Staff from toggling status freely if it's 'status' (Approval)
    if (role === 'staff' && field === 'status') {
      toast.error("Staf tidak boleh menukar status kelulusan.")
      return
    }

    setIsUpdating(true)
    const newValue = currentValue === 'active' ? 'inactive' : 'active'
    try {
      const { error } = await supabase.from('organizers').update({ [field]: newValue }).eq('id', id)
      if (error) throw error

      await logAction('UPDATE', 'organizer', id, { [field]: newValue })
      toast.success("Status dikemaskini")
      mutate()
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (role === 'staff') return

    if (!confirm("Adakah anda pasti? Tindakan ini tidak boleh diundur.")) return
    try {
      const { error } = await supabase.from('organizers').delete().eq('id', id)
      if (error) throw error

      await logAction('DELETE', 'organizer', id, {})
      toast.success("Penganjur dipadam")
      mutate()
    } catch (e: any) {
      toast.error("Gagal padam: " + e.message)
    }
  }

  const handleApprove = async (id: number) => {
    try {
      const { error } = await supabase.from('organizers').update({ status: 'active' }).eq('id', id)
      if (error) throw error
      await logAction('APPROVE', 'organizer', id, { status: 'active' })
      toast.success("Penganjur diluluskan")
      mutate()
    } catch (e: any) {
      toast.error("Gagal lulus: " + e.message)
    }
  }

  // --- LOCATION ADD LOGIC ---
  const handleOpenAddLoc = (org: any) => {
    setSelectedOrgForLoc(org)
    setNewLoc({ name: '', type: 'daily' })
    setIsLocDialogOpen(true)
  }

  const handleAddLocation = async () => {
    if (!newLoc.name) {
      toast.error("Nama lokasi wajib diisi")
      return
    }

    setIsAddingLoc(true)
    try {
      const payload: any = {
        name: newLoc.name,
        type: newLoc.type,
        organizer_id: selectedOrgForLoc.id,
        // Defaults
        operating_days: 'Sabtu & Ahad',
        days_per_week: 2,
        total_lots: 50,
        rate_khemah: 0,
        rate_cbs: 0,
        rate_monthly: 0
      }

      if (role === 'staff') {
        payload.status = 'pending'
      } else {
        payload.status = 'active'
      }

      const { data: newL, error } = await supabase.from('locations').insert(payload).select().single()

      if (error) throw error

      await logAction('CREATE', 'location', newL.id, payload)
      toast.success(role === 'staff' ? "Lokasi ditambah. Menunggu kelulusan." : `Lokasi ditambah ke ${selectedOrgForLoc.name}`)
      setIsLocDialogOpen(false)
      mutate()
    } catch (e: any) {
      toast.error("Gagal tambah lokasi: " + e.message)
    } finally {
      setIsAddingLoc(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Pengurusan Penganjur</h2>
          <p className="text-muted-foreground">Senarai penganjur pasar dan tapak niaga</p>
        </div>
        <Button onClick={handleOpenCreate} className="rounded-xl shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Tambah Penganjur
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Kemaskini Penganjur' : 'Tambah Penganjur Baru'}</DialogTitle>
              <DialogDescription>Masukkan butiran organisasi</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama Organisasi</Label>
                <Input value={newOrg.name} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} placeholder="Contoh: Persatuan Peniaga Gombak" />
              </div>
              <div className="space-y-2">
                <Label>Kod Penganjur (Unik)</Label>
                <Input
                  value={newOrg.code}
                  onChange={e => setNewOrg({ ...newOrg, code: e.target.value })}
                  placeholder="ORG001"
                  className="uppercase"
                  disabled={isEditing} // Lock code on edit
                />
              </div>
              <div className="space-y-2">
                <Label>Emel Admin (Pilihan)</Label>
                <Input value={newOrg.email} onChange={e => setNewOrg({ ...newOrg, email: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={isSubmitting}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ADD LOCATION DIALOG */}
      <Dialog open={isLocDialogOpen} onOpenChange={setIsLocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Lokasi Baru</DialogTitle>
            <DialogDescription>
              Menambah lokasi untuk penganjur: <span className="font-bold text-primary">{selectedOrgForLoc?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Lokasi/Jalan</Label>
              <Input
                value={newLoc.name}
                onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                placeholder="Contoh: Tapak Pasar Malam Gombak"
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis Operasi</Label>
              <Select value={newLoc.type} onValueChange={(v: any) => setNewLoc({ ...newLoc, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Mingguan (Pasar Malam/Pagi)</SelectItem>
                  <SelectItem value="monthly">Bulanan (Uptown/Kiosk)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddLocation} disabled={isAddingLoc}>
              {isAddingLoc ? "Sedang Tambah..." : "Tambah Lokasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="pl-6">Nama</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Emel</TableHead>
                <TableHead className="text-center">Status Umum</TableHead>
                <TableHead className="text-center">Module Akaun</TableHead>
                <TableHead className="text-right pr-6">Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizers?.map((org: any) => (
                <TableRow key={org.id}>
                  <TableCell className="pl-6 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Building size={16} />
                      </div>
                      <div>
                        {org.name}
                        {org.status === 'pending' && <Badge className="ml-2 bg-yellow-500 text-white text-[10px] h-5">Pending</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono">{org.organizer_code}</Badge></TableCell>
                  <TableCell>{org.email || '-'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center items-center gap-2">
                      {/* Only show switch if not pending, or if Admin */}
                      {org.status === 'pending' && (role === 'admin' || role === 'superadmin') ? (
                        <Button size="sm" className="h-6 bg-green-600 hover:bg-green-700 text-white text-[10px]" onClick={() => handleApprove(org.id)}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Luluskan
                        </Button>
                      ) : (
                        <>
                          <Switch
                            checked={org.status === 'active'}
                            onCheckedChange={() => handleStatusChange(org.id, 'status', org.status)}
                            disabled={isUpdating || (role === 'staff' && org.status === 'pending')}
                          />
                          <span className={cn("text-[10px] font-bold uppercase w-12 text-left", org.status === 'active' ? "text-green-600" : "text-muted-foreground")}>
                            {org.status}
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100 w-fit mx-auto">
                      <Switch
                        checked={org.accounting_status === 'active'}
                        onCheckedChange={() => handleStatusChange(org.id, 'accounting_status', org.accounting_status)}
                        disabled={isUpdating}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <span className={cn("text-[10px] font-bold uppercase w-8 text-left", org.accounting_status === 'active' ? "text-blue-600" : "text-slate-400")}>
                        {org.accounting_status === 'active' ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2 items-center">
                      {/* Location Count & List Display */}
                      <div className="mr-4 text-right">
                        {org.locations && org.locations.length > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="secondary" className="text-[10px] w-fit">
                              {org.locations.length} Lokasi
                            </Badge>
                            <div className="flex flex-wrap justify-end gap-1 max-w-[150px]">
                              {org.locations.map((l: any) => (
                                <span key={l.id} className="text-[9px] bg-slate-100 px-1 rounded border border-slate-200 text-slate-600 truncate max-w-full">
                                  {l.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Tiada Lokasi</span>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 border-dashed"
                        onClick={() => handleOpenAddLoc(org)}
                      >
                        <Plus size={12} /> Lokasi
                      </Button>

                      <div className="h-4 w-px bg-border mx-1"></div>

                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(org)} className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                        <Pencil size={15} />
                      </Button>

                      {role !== 'staff' && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(org.id)} className="h-8 w-8 text-red-600 hover:bg-red-50">
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {organizers?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tiada data.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

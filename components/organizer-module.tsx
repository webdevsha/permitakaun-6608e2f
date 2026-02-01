"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Building, User } from "lucide-react"
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
import { toast } from "sonner"

const fetchOrganizers = async () => {
  const supabase = createClient()
  const { data, error } = await supabase.from('organizers').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function OrganizerModule({ initialOrganizers }: { initialOrganizers?: any[] }) {
  const organizers = initialOrganizers || []
  const mutate = () => window.location.reload()
  const isLoading = false

  const [isOpen, setIsOpen] = useState(false)
  const [newOrg, setNewOrg] = useState({ name: '', code: '', email: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const handleCreate = async () => {
    if (!newOrg.name || !newOrg.code) {
      toast.error("Nama dan Kod wajib diisi")
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('organizers').insert({
        name: newOrg.name,
        organizer_code: newOrg.code.toUpperCase(),
        email: newOrg.email,
        status: 'active'
      })

      if (error) throw error

      toast.success("Penganjur berjaya ditambah")
      setIsOpen(false)
      setNewOrg({ name: '', code: '', email: '' })
      mutate()
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Pengurusan Penganjur</h2>
          <p className="text-muted-foreground">Senarai penganjur pasar dan tapak niaga</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-md">
              <Plus className="mr-2 h-4 w-4" /> Tambah Penganjur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Penganjur Baru</DialogTitle>
              <DialogDescription>Masukkan butiran organisasi</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama Organisasi</Label>
                <Input value={newOrg.name} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} placeholder="Contoh: Persatuan Peniaga Gombak" />
              </div>
              <div className="space-y-2">
                <Label>Kod Penganjur (Unik)</Label>
                <Input value={newOrg.code} onChange={e => setNewOrg({ ...newOrg, code: e.target.value })} placeholder="ORG001" className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Emel Admin (Pilihan)</Label>
                <Input value={newOrg.email} onChange={e => setNewOrg({ ...newOrg, email: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isSubmitting}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="pl-6">Nama</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Emel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin</TableHead>
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
                      {org.name}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono">{org.organizer_code}</Badge></TableCell>
                  <TableCell>{org.email || '-'}</TableCell>
                  <TableCell><Badge className="capitalize bg-brand-green/10 text-brand-green border-none">{org.status}</Badge></TableCell>
                  <TableCell>
                    {org.profile_id ? <span className="text-xs text-muted-foreground flex items-center gap-1"><User size={12} /> Assigned</span> : <span className="text-xs text-amber-600 italic">Unassigned</span>}
                  </TableCell>
                </TableRow>
              ))}
              {organizers?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tiada data.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

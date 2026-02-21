"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  Search, 
  CheckCircle, 
  XCircle, 
  Building2, 
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  validateOrganizerAction,
  requestOrganizerLinkAction,
  removeOrganizerLinkAction,
} from "@/actions/tenant-organizer"

interface LinkedOrganizer {
  id: number
  status: 'pending' | 'approved' | 'active' | 'rejected'
  requested_at: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
  organizers: {
    id: string
    name: string
    organizer_code: string
    email: string | null
  }
}

interface OrganizerValidationProps {
  tenantId: number
  linkedOrganizers: LinkedOrganizer[]
  onUpdate?: () => void
}

export function OrganizerValidation({ 
  tenantId, 
  linkedOrganizers: initialOrganizers,
  onUpdate 
}: OrganizerValidationProps) {
  const [linkedOrganizers, setLinkedOrganizers] = useState<LinkedOrganizer[]>(initialOrganizers)
  const [organizerCode, setOrganizerCode] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [pendingOrganizer, setPendingOrganizer] = useState<{
    id: string
    name: string
    email: string | null
    organizer_code: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleValidate = async () => {
    if (!organizerCode.trim()) {
      toast.error("Sila masukkan Kod Penganjur")
      return
    }

    setIsValidating(true)
    setPendingOrganizer(null)

    try {
      const result = await validateOrganizerAction(organizerCode)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      if (!result.data) return
      
      // Check if already linked
      const existingLink = linkedOrganizers.find(
        o => o.organizers.organizer_code === result.data.organizer_code
      )

      if (existingLink) {
        if (existingLink.status === 'pending') {
          toast.info("Anda telah menghantar permohonan kepada penganjur ini. Sila tunggu kelulusan.")
        } else if (existingLink.status === 'approved' || existingLink.status === 'active') {
          toast.info("Anda telah diluluskan oleh penganjur ini.")
        } else if (existingLink.status === 'rejected') {
          // Allow re-request, show confirmation
          if (result.data) {
        setPendingOrganizer(result.data)
      }
          setShowConfirmDialog(true)
        }
        return
      }

      setPendingOrganizer(result.data)
      setShowConfirmDialog(true)
    } catch (error: any) {
      toast.error("Ralat semakan: " + error.message)
    } finally {
      setIsValidating(false)
    }
  }

  const handleConfirmRequest = async () => {
    if (!pendingOrganizer) return

    setIsSubmitting(true)

    try {
      const result = await requestOrganizerLinkAction(
        tenantId,
        pendingOrganizer.organizer_code
      )

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)

      // Add to local state
      const newLink: LinkedOrganizer = {
        id: Date.now(), // Temporary ID
        status: 'pending',
        requested_at: new Date().toISOString(),
        organizers: {
          id: pendingOrganizer.id,
          name: pendingOrganizer.name,
          organizer_code: pendingOrganizer.organizer_code,
          email: pendingOrganizer.email
        }
      }

      setLinkedOrganizers(prev => [...prev, newLink])
      setPendingOrganizer(null)
      setOrganizerCode("")
      setShowConfirmDialog(false)

      onUpdate?.()
    } catch (error: any) {
      toast.error("Ralat: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveLink = async (linkId: number) => {
    if (!confirm("Adakah anda pasti mahu memadam pautan ini?")) return

    try {
      const result = await removeOrganizerLinkAction(linkId)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Pautan dipadam")
      setLinkedOrganizers(prev => prev.filter(o => o.id !== linkId))
      onUpdate?.()
    } catch (error: any) {
      toast.error("Ralat: " + error.message)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Diluluskan
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
            <Clock className="w-3 h-3 mr-1" /> Menunggu
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-200">
            <XCircle className="w-3 h-3 mr-1" /> Ditolak
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const approvedCount = linkedOrganizers.filter(
    o => o.status === 'approved' || o.status === 'active'
  ).length

  const hasPending = linkedOrganizers.some(o => o.status === 'pending')
  const hasRejected = linkedOrganizers.some(o => o.status === 'rejected')

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Penganjur Saya
              </CardTitle>
              <CardDescription>
                Pautkan dengan penganjur untuk melihat dan memohon lokasi
              </CardDescription>
            </div>
            {approvedCount > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                {approvedCount} Diluluskan
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Alerts */}
          {hasPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-800 text-sm">Menunggu Kelulusan</h4>
                <p className="text-xs text-amber-700 mt-1">
                  Permohonan anda sedang dalam semakan. Anda akan menerima notifikasi sebaik sahaja diluluskan.
                </p>
              </div>
            </div>
          )}

          {hasRejected && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-800 text-sm">Permohonan Ditolak</h4>
                <p className="text-xs text-red-700 mt-1">
                  Sesetengah permohonan anda telah ditolak. Anda boleh memohon semula atau hubungi penganjur.
                </p>
              </div>
            </div>
          )}

          {/* Linked Organizers List */}
          {linkedOrganizers.length > 0 ? (
            <div className="space-y-3">
              {linkedOrganizers.map((org) => (
                <div
                  key={org.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border",
                    org.status === 'approved' || org.status === 'active'
                      ? "bg-green-50/50 border-green-200"
                      : org.status === 'pending'
                      ? "bg-amber-50/50 border-amber-200"
                      : "bg-red-50/50 border-red-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      org.status === 'approved' || org.status === 'active'
                        ? "bg-green-100 text-green-600"
                        : org.status === 'pending'
                        ? "bg-amber-100 text-amber-600"
                        : "bg-red-100 text-red-600"
                    )}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{org.organizers.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {org.organizers.organizer_code}
                      </p>
                      {org.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">
                          Sebab: {org.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(org.status)}
                    {(org.status === 'rejected') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:bg-red-100"
                        onClick={() => handleRemoveLink(org.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Tiada penganjur dipautkan
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tambah penganjur untuk mula memohon lokasi
              </p>
            </div>
          )}

          {/* Add New Organizer Section */}
          <div className="pt-4 border-t border-border/50">
            <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
              Tambah Penganjur Baharu
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={organizerCode}
                  onChange={(e) => setOrganizerCode(e.target.value.toUpperCase())}
                  placeholder="Masukkan Kod Penganjur (cth: ORG001)"
                  className="pl-10 uppercase font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                />
              </div>
              <Button
                onClick={handleValidate}
                disabled={isValidating || !organizerCode.trim()}
                className="shrink-0"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Semak
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Sahkan Pautan Penganjur
            </DialogTitle>
            <DialogDescription>
              Sila semak maklumat penganjur sebelum menghantar permohonan
            </DialogDescription>
          </DialogHeader>

          {pendingOrganizer && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-xl space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nama Penganjur</Label>
                  <p className="font-bold text-lg">{pendingOrganizer.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Kod Penganjur</Label>
                  <p className="font-mono text-sm bg-white px-2 py-1 rounded inline-block">
                    {pendingOrganizer.organizer_code}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Emel</Label>
                  <p className="text-sm">{pendingOrganizer.email || "Tiada emel"}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm text-blue-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Permohonan anda akan dihantar kepada penganjur untuk kelulusan. 
                  Anda akan menerima notifikasi sebaik sahaja permohonan diluluskan.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmDialog(false)
                    setPendingOrganizer(null)
                  }}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleConfirmRequest}
                  disabled={isSubmitting}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Hantar Permohonan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

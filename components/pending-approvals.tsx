"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  MoreHorizontal
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

import {
  getPendingRequestsAction,
  processTenantRequestAction,
} from "@/actions/tenant-organizer"

interface Tenant {
  id: number
  full_name: string
  business_name: string | null
  phone_number: string | null
  email: string | null
  ic_number: string | null
  profile_image_url: string | null
}

interface Organizer {
  id: string
  name: string
  organizer_code: string
  email: string | null
}

interface PendingRequest {
  id: number
  tenant_id: number
  organizer_id: string
  status: string
  requested_at: string
  tenants: Tenant
  organizers: Organizer
}

interface PendingApprovalsProps {
  organizerId?: string // If provided, filter by this organizer
  isAdmin?: boolean
  onRefresh?: () => void
}

export function PendingApprovals({ 
  organizerId, 
  isAdmin = false,
  onRefresh 
}: PendingApprovalsProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<PendingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchRequests = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const result = await getPendingRequestsAction(organizerId)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      setRequests(result.data)
      setFilteredRequests(result.data)
    } catch (error: any) {
      toast.error("Gagal mengambil data: " + error.message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [organizerId])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRequests(requests)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredRequests(
        requests.filter(
          r =>
            r.tenants.full_name.toLowerCase().includes(query) ||
            r.tenants.business_name?.toLowerCase().includes(query) ||
            r.tenants.phone_number?.includes(query) ||
            r.organizers.name.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, requests])

  const handleApprove = async (requestId: number) => {
    setIsProcessing(true)

    try {
      const result = await processTenantRequestAction(requestId, 'approve')

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Permohonan diluluskan")
      
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== requestId))
      onRefresh?.()
    } catch (error: any) {
      toast.error("Gagal meluluskan: " + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    setIsProcessing(true)

    try {
      const result = await processTenantRequestAction(
        selectedRequest.id, 
        'reject',
        rejectionReason
      )

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Permohonan ditolak")
      
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== selectedRequest.id))
      setShowRejectDialog(false)
      setRejectionReason("")
      setSelectedRequest(null)
      onRefresh?.()
    } catch (error: any) {
      toast.error("Gagal menolak: " + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ms-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysPending = (requestedAt: string) => {
    const requested = new Date(requestedAt)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - requested.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Permohonan Menunggu Kelulusan
                {requests.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {requests.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Senarai peniaga yang memohon untuk dipautkan dengan penganjur
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari peniaga..."
                  className="pl-10 w-full md:w-[250px]"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => fetchRequests(false)}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <h4 className="font-medium text-foreground">Tiada Permohonan</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery 
                  ? "Tiada keputusan carian" 
                  : "Semua permohonan telah diproses"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => {
                const daysPending = getDaysPending(request.requested_at)
                const isUrgent = daysPending >= 3

                return (
                  <div
                    key={request.id}
                    className={cn(
                      "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border gap-4",
                      isUrgent 
                        ? "bg-amber-50/50 border-amber-200" 
                        : "bg-white border-border hover:border-primary/30"
                    )}
                  >
                    {/* Tenant Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full border-2 border-background shadow-sm bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {request.tenants.profile_image_url ? (
                          <img 
                            src={request.tenants.profile_image_url} 
                            alt={request.tenants.full_name}
                            className="object-cover w-full h-full rounded-full"
                          />
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-foreground">
                            {request.tenants.full_name}
                          </h4>
                          {isUrgent && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {daysPending} hari
                            </Badge>
                          )}
                        </div>
                        
                        {request.tenants.business_name && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {request.tenants.business_name}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {request.tenants.phone_number && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {request.tenants.phone_number}
                            </span>
                          )}
                          {request.tenants.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {request.tenants.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(request.requested_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Organizer & Actions */}
                    <div className="flex items-center gap-4">
                      {isAdmin && (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">Penganjur</p>
                          <p className="text-sm font-medium">{request.organizers.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {request.organizers.organizer_code}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(request.id)}
                          disabled={isProcessing}
                        >
                          <CheckCircle className="w-4 h-4 mr-1.5" />
                          Luluskan
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowRejectDialog(true)
                          }}
                          disabled={isProcessing}
                        >
                          <XCircle className="w-4 h-4 mr-1.5" />
                          Tolak
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => {
                            toast.info("Ciri paparan terperinci akan datang")
                          }}
                        >
                          <User className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Tolak Permohonan
            </DialogTitle>
            <DialogDescription>
              Adakah anda pasti mahu menolak permohonan daripada{" "}
              <strong>{selectedRequest?.tenants.full_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground">
                Sebab Penolakan (Pilihan)
              </label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Lokasi penuh, dokumentasi tidak lengkap"
                className="mt-1"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Peniaga akan dimaklumkan tentang penolakan ini dan boleh memohon semula pada masa hadapan.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setRejectionReason("")
                setSelectedRequest(null)
              }}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Sahkan Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

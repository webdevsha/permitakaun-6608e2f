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
  RefreshCw,
  AlertCircle,
  MapPin,
  Store,
  Ban,
  Banknote,
  Wallet
} from "lucide-react"

const MoneyIcon = Banknote || Wallet
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
import { createClient } from "@/utils/supabase/client"

interface PendingApprovalsCombinedProps {
  organizerId?: string
  isAdmin?: boolean
  onRefresh?: () => void
}

type RequestType = 'organizer_link' | 'location' | 'rental_payment'

interface PendingRequest {
  id: number | string
  type: RequestType
  status: string
  requested_at: string
  // For organizer link
  tenant_id?: number
  organizer_id?: string
  // For location
  location_id?: number
  // For rental payment
  payment_id?: string
  amount?: number
  payment_method?: string
  receipt_url?: string
  billplz_id?: string
  // Common tenant info
  tenant_name?: string
  tenant_business?: string
  tenant_phone?: string
  tenant_email?: string
  tenant_image?: string
  // Common organizer info
  organizer_name?: string
  organizer_code?: string
  // Location info
  location_name?: string
  location_type?: string
}

export function PendingApprovalsCombined({ 
  organizerId, 
  isAdmin = false,
  onRefresh 
}: PendingApprovalsCombinedProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<PendingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<RequestType | 'all'>('all')
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const supabase = createClient()

  const fetchRequests = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const allRequests: PendingRequest[] = []

      // 1. Fetch pending organizer linking requests
      let orgQuery = supabase
        .from('tenant_organizers')
        .select(`
          *,
          tenants(id, full_name, business_name, phone_number, email, profile_image_url),
          organizers(id, name, organizer_code, email)
        `)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })

      if (organizerId) {
        orgQuery = orgQuery.eq('organizer_id', organizerId)
      }

      const { data: orgData, error: orgError } = await orgQuery

      if (!orgError && orgData) {
        const orgRequests: PendingRequest[] = orgData.map((item: any) => ({
          id: item.id,
          type: 'organizer_link',
          status: item.status,
          requested_at: item.requested_at,
          tenant_id: item.tenant_id,
          organizer_id: item.organizer_id,
          tenant_name: item.tenants?.full_name,
          tenant_business: item.tenants?.business_name,
          tenant_phone: item.tenants?.phone_number,
          tenant_email: item.tenants?.email,
          tenant_image: item.tenants?.profile_image_url,
          organizer_name: item.organizers?.name,
          organizer_code: item.organizers?.organizer_code,
        }))
        allRequests.push(...orgRequests)
      }

      // 2. Fetch pending location requests
      let locQuery = supabase
        .from('tenant_locations')
        .select(`
          *,
          tenants(id, full_name, business_name, phone_number, email, profile_image_url),
          locations(id, name, type),
          organizers(id, name, organizer_code)
        `)
        .eq('status', 'pending')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (organizerId) {
        locQuery = locQuery.eq('organizer_id', organizerId)
      }

      const { data: locData, error: locError } = await locQuery

      if (!locError && locData) {
        const locRequests: PendingRequest[] = locData.map((item: any) => ({
          id: item.id,
          type: 'location',
          status: item.status,
          requested_at: item.created_at,
          tenant_id: item.tenant_id,
          location_id: item.location_id,
          tenant_name: item.tenants?.full_name,
          tenant_business: item.tenants?.business_name,
          tenant_phone: item.tenants?.phone_number,
          tenant_email: item.tenants?.email,
          tenant_image: item.tenants?.profile_image_url,
          organizer_name: item.organizers?.name,
          organizer_code: item.organizers?.organizer_code,
          location_name: item.locations?.name,
          location_type: item.locations?.type,
        }))
        allRequests.push(...locRequests)
      }

      // 3. Fetch pending rental payments
      let paymentQuery = supabase
        .from('tenant_payments')
        .select(`
          *,
          tenants(id, full_name, business_name, phone_number, email, profile_image_url)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      const { data: paymentData, error: paymentError } = await paymentQuery

      if (!paymentError && paymentData) {
        // For each payment, get the organizer info from tenant_locations or tenant_organizers
        const paymentRequests: PendingRequest[] = await Promise.all(
          paymentData.map(async (item: any) => {
            let orgId = null
            let orgName = null
            let orgCode = null
            let locId = null
            let locName = null
            let locType = null

            // First try tenant_locations
            const { data: tenantLoc } = await supabase
              .from('tenant_locations')
              .select(`
                organizer_id,
                location_id,
                locations(id, name, type),
                organizers(id, name, organizer_code)
              `)
              .eq('tenant_id', item.tenant_id)
              .eq('is_active', true)
              .maybeSingle()

            if (tenantLoc?.organizer_id) {
              orgId = tenantLoc.organizer_id
              orgName = tenantLoc.organizers?.name
              orgCode = tenantLoc.organizers?.organizer_code
              locId = tenantLoc.location_id
              locName = tenantLoc.locations?.name
              locType = tenantLoc.locations?.type
            } else {
              // Fallback to tenant_organizers
              const { data: tenantOrg } = await supabase
                .from('tenant_organizers')
                .select(`
                  organizer_id,
                  organizers(id, name, organizer_code)
                `)
                .eq('tenant_id', item.tenant_id)
                .eq('status', 'approved')
                .maybeSingle()

              if (tenantOrg?.organizer_id) {
                orgId = tenantOrg.organizer_id
                orgName = tenantOrg.organizers?.name
                orgCode = tenantOrg.organizers?.organizer_code
              }
            }

            // Skip if no organizer found (can't create transaction without it)
            if (!orgId) {
              return null
            }

            // Filter by organizer if specified
            if (organizerId && orgId !== organizerId) {
              return null
            }

            return {
              id: item.id,
              type: 'rental_payment' as RequestType,
              status: item.status,
              requested_at: item.created_at,
              payment_id: item.id,
              tenant_id: item.tenant_id,
              amount: item.amount,
              payment_method: item.payment_method,
              receipt_url: item.receipt_url,
              billplz_id: item.billplz_id,
              tenant_name: item.tenants?.full_name,
              tenant_business: item.tenants?.business_name,
              tenant_phone: item.tenants?.phone_number,
              tenant_email: item.tenants?.email,
              tenant_image: item.tenants?.profile_image_url,
              organizer_id: orgId,
              organizer_name: orgName,
              organizer_code: orgCode,
              location_id: locId,
              location_name: locName,
              location_type: locType,
            }
          })
        )
        
        // Filter out nulls (payments that don't match organizer filter or have no organizer)
        allRequests.push(...paymentRequests.filter((r): r is PendingRequest => r !== null))
      }

      // Sort by date (newest first)
      allRequests.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())

      setRequests(allRequests)
    } catch (error: any) {
      console.error("Error fetching pending requests:", error)
      toast.error("Gagal mengambil senarai permohonan")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [organizerId])

  useEffect(() => {
    let filtered = requests

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType)
    }

    // Filter by search
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.tenant_name?.toLowerCase().includes(query) ||
        r.tenant_business?.toLowerCase().includes(query) ||
        r.organizer_name?.toLowerCase().includes(query) ||
        r.location_name?.toLowerCase().includes(query)
      )
    }

    setFilteredRequests(filtered)
  }, [searchQuery, filterType, requests])

  const handleApprove = async (request: PendingRequest) => {
    setIsProcessing(true)

    try {
      if (request.type === 'organizer_link') {
        const { error } = await supabase
          .from('tenant_organizers')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id)

        if (error) throw error
        toast.success(`Pautan penganjur diluluskan`)

      } else if (request.type === 'location') {
        const { error } = await supabase
          .from('tenant_locations')
          .update({ status: 'approved' })
          .eq('id', request.id)

        if (error) throw error
        toast.success(`Lokasi diluluskan`)

      } else if (request.type === 'rental_payment') {
        console.log('[Approve] Rental payment request:', request)
        
        // Ensure we have organizer_id - refetch if missing
        let organizerId = request.organizer_id
        if (!organizerId && request.tenant_id) {
          console.log('[Approve] Organizer ID missing, fetching from tenant_organizers...')
          const { data: tenantOrg } = await supabase
            .from('tenant_organizers')
            .select('organizer_id')
            .eq('tenant_id', request.tenant_id)
            .eq('status', 'approved')
            .maybeSingle()
          
          if (tenantOrg?.organizer_id) {
            organizerId = tenantOrg.organizer_id
            console.log('[Approve] Found organizer_id:', organizerId)
          }
        }
        
        if (!organizerId) {
          throw new Error('Organizer ID not found for this payment')
        }

        // Update payment status to approved
        const { error: paymentError } = await supabase
          .from('tenant_payments')
          .update({ 
            status: 'approved'
          })
          .eq('id', request.id)

        if (paymentError) throw paymentError

        // Create organizer transaction record so it shows in their Senarai Transaksi
        console.log('[Approve] Creating organizer transaction:', { organizerId, amount: request.amount })
        const { error: txnError } = await supabase
          .from('organizer_transactions')
          .insert({
            organizer_id: organizerId,
            amount: request.amount,
            type: 'income',
            category: 'Sewa',
            description: `Bayaran sewa dari ${request.tenant_name || 'Peniaga'}`,
            date: new Date().toISOString().split('T')[0],
            status: 'approved',
            metadata: {
              tenant_id: request.tenant_id,
              tenant_name: request.tenant_name,
              payment_id: request.payment_id,
              billplz_id: request.billplz_id
            }
          })
        
        if (txnError) {
          console.error('Error creating organizer transaction:', txnError)
          // Don't throw - payment is approved even if transaction creation fails
        }

        toast.success(`Pembayaran sewa diluluskan - RM${request.amount}`)
      }

      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== request.id || r.type !== request.type))
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
      if (selectedRequest.type === 'organizer_link') {
        const { error } = await supabase
          .from('tenant_organizers')
          .update({ 
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: rejectionReason,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRequest.id)

        if (error) throw error
        toast.success("Pautan penganjur ditolak")

      } else if (selectedRequest.type === 'location') {
        const { error } = await supabase
          .from('tenant_locations')
          .update({ 
            status: 'rejected',
            is_active: false
          })
          .eq('id', selectedRequest.id)

        if (error) throw error
        toast.success("Permohonan lokasi ditolak")

      } else if (selectedRequest.type === 'rental_payment') {
        const { error } = await supabase
          .from('tenant_payments')
          .update({ 
            status: 'rejected'
          })
          .eq('id', selectedRequest.id)

        if (error) throw error
        toast.success(`Pembayaran sewa ditolak - RM${selectedRequest.amount}`)
      }

      setRequests(prev => prev.filter(r => r.id !== selectedRequest.id || r.type !== selectedRequest.type))
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

  const getRequestTypeLabel = (type: RequestType) => {
    switch (type) {
      case 'organizer_link': return 'Pautan Penganjur'
      case 'location': return 'Permohonan Lokasi'
      case 'rental_payment': return 'Bayaran Sewa'
      default: return type
    }
  }

  const getRequestTypeIcon = (type: RequestType) => {
    switch (type) {
      case 'organizer_link': return <Building2 className="w-4 h-4" />
      case 'location': return <MapPin className="w-4 h-4" />
      case 'rental_payment': return <MoneyIcon className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
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
                Senarai permohonan pautan penganjur dan lokasi yang memerlukan kelulusan
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Type Filter */}
              <select
                className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as RequestType | 'all')}
              >
                <option value="all">Semua Jenis</option>
                <option value="organizer_link">Pautan Penganjur</option>
                <option value="location">Lokasi</option>
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari..."
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

          {/* Summary Stats */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-muted-foreground">Pautan:</span>
              <Badge variant="secondary">
                {requests.filter(r => r.type === 'organizer_link').length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Lokasi:</span>
              <Badge variant="secondary">
                {requests.filter(r => r.type === 'location').length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Banknote className="w-4 h-4 text-amber-500" />
              <span className="text-muted-foreground">Bayaran:</span>
              <Badge variant="secondary">
                {requests.filter(r => r.type === 'rental_payment').length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <h4 className="font-medium text-foreground">Tiada Permohonan</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || filterType !== 'all'
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
                    key={`${request.type}-${request.id}`}
                    className={cn(
                      "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border gap-4",
                      isUrgent 
                        ? "bg-amber-50/50 border-amber-200" 
                        : "bg-white border-border hover:border-primary/30"
                    )}
                  >
                    {/* Left Side - Tenant Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full border-2 border-background shadow-sm bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {request.tenant_image ? (
                          <img 
                            src={request.tenant_image} 
                            alt={request.tenant_name}
                            className="object-cover w-full h-full rounded-full"
                          />
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Type Badge */}
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px]",
                              request.type === 'organizer_link' 
                                ? "border-blue-200 bg-blue-50 text-blue-700" 
                                : request.type === 'rental_payment'
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-green-200 bg-green-50 text-green-700"
                            )}
                          >
                            {getRequestTypeIcon(request.type)}
                            <span className="ml-1">{getRequestTypeLabel(request.type)}</span>
                          </Badge>
                          {isUrgent && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px]">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {daysPending} hari
                            </Badge>
                          )}
                        </div>

                        {/* Tenant Name */}
                        <h4 className="font-bold text-foreground">
                          {request.tenant_name}
                        </h4>
                        
                        {request.tenant_business && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {request.tenant_business}
                          </p>
                        )}

                        {/* Request Details */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {request.type === 'organizer_link' ? (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              Minta pautan dengan: <strong className="text-foreground">{request.organizer_name}</strong>
                              <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">{request.organizer_code}</span>
                            </span>
                          ) : request.type === 'rental_payment' ? (
                            <>
                              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                                <Banknote className="w-3 h-3" />
                                Jumlah: <strong className="text-foreground">RM{request.amount}</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {request.location_name || 'Lokasi'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {request.organizer_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Wallet className="w-3 h-3" />
                                {request.payment_method === 'billplz' ? 'Billplz/FPX' : request.payment_method}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Minta lokasi: <strong className="text-foreground">{request.location_name}</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {request.organizer_name}
                              </span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(request.requested_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApprove(request)}
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
              <strong>{selectedRequest?.tenant_name}</strong>?
              {selectedRequest?.type === 'organizer_link' 
                ? ` untuk pautan penganjur ${selectedRequest?.organizer_name}`
                : ` untuk lokasi ${selectedRequest?.location_name}`
              }
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
                Peniaga akan dimaklumkan tentang penolakan ini.
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

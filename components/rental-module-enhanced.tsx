"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Store,
  Building2,
  Plus,
  CreditCard,
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  MapPin,
  ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { OrganizerValidation } from "./organizer-validation"
import { initiatePayment } from "@/actions/payment"

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

interface EnhancedRentalModuleProps {
  initialTenant: any
  initialLocations: any[]
  initialHistory: any[]
  initialAvailable: any[]
  initialAllLocations?: any[]
  initialLinkedOrganizers?: LinkedOrganizer[]
}

export function EnhancedRentalModule({
  initialTenant,
  initialLocations,
  initialHistory,
  initialAvailable,
  initialAllLocations = [],
  initialLinkedOrganizers = []
}: EnhancedRentalModuleProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [tenant, setTenant] = useState(initialTenant)
  const [linkedOrganizers, setLinkedOrganizers] = useState<LinkedOrganizer[]>(initialLinkedOrganizers)
  const [myLocations, setMyLocations] = useState(initialLocations)
  const [availableLocations, setAvailableLocations] = useState(initialAvailable)
  const [allLocations, setAllLocations] = useState(initialAllLocations)
  const [history, setHistory] = useState(initialHistory)
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Payment states - now supporting multiple selections
  const [selectedRentals, setSelectedRentals] = useState<Record<number, { selected: boolean, amount: string }>>({})
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"manual" | "billplz">("billplz")

  // Tab state - now includes 'organizers' tab
  const viewParam = searchParams.get('view')
  const [activeTab, setActiveTab] = useState<string>(viewParam === 'history' ? 'history' : viewParam === 'payment' ? 'payment' : viewParam === 'organizers' ? 'organizers' : 'status')

  // Category selection state
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Record<number, string>>({})
  const [deletingLocation, setDeletingLocation] = useState<number | null>(null)

  // Fetch fresh data
  const refreshData = useCallback(async () => {
    if (!tenant?.id) return

    setIsLoading(true)
    try {
      // Fetch linked organizers
      const { data: orgData, error: orgError } = await supabase
        .from('tenant_organizers')
        .select(`
          *,
          organizers(id, name, organizer_code, email)
        `)
        .eq('tenant_id', tenant.id)
        .order('requested_at', { ascending: false })

      if (!orgError && orgData) {
        setLinkedOrganizers(orgData as LinkedOrganizer[])
      }

      // Get approved organizer IDs
      const approvedOrgIds = (orgData || [])
        .filter((link: any) => link.status === 'approved' || link.status === 'active')
        .map((link: any) => link.organizer_id)

      // Fetch ALL locations from approved organizers (including assigned ones)
      if (approvedOrgIds.length > 0) {
        // Get locations
        const { data: allLocData } = await supabase
          .from('locations')
          .select(`
            id,
            name,
            program_name,
            address,
            google_maps_url,
            rate_khemah,
            rate_cbs,
            rate_monthly,
            rate_monthly_khemah,
            rate_monthly_cbs,
            operating_days,
            type,
            organizer_id
          `)
          .in('organizer_id', approvedOrgIds)
          .eq('status', 'active')
          .order('program_name')

        // Get organizer names separately
        const { data: orgsData } = await supabase
          .from('organizers')
          .select('id, name')
          .in('id', approvedOrgIds)

        const orgMap = new Map((orgsData || []).map((o: any) => [o.id, o.name]))

        // Get assigned location IDs
        const { data: assignedLocs } = await supabase
          .from('tenant_locations')
          .select('location_id')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)

        const assignedIds = new Set((assignedLocs || []).map((l: any) => l.location_id))

        // Build allLocations with is_assigned flag
        const updatedAllLocations = (allLocData || []).map((l: any) => ({
          location_id: l.id,
          location_name: l.name,
          program_name: l.program_name,
          organizer_id: l.organizer_id,
          organizer_name: orgMap.get(l.organizer_id) || 'Unknown',
          rate_khemah: l.rate_khemah,
          rate_cbs: l.rate_cbs,
          rate_monthly: l.rate_monthly,
          rate_monthly_khemah: l.rate_monthly_khemah,
          rate_monthly_cbs: l.rate_monthly_cbs,
          operating_days: l.operating_days || 'Setiap Hari',
          type: l.type,
          display_price: l.rate_monthly || l.rate_khemah || 0,
          google_maps_url: l.google_maps_url,
          address: l.address,
          is_assigned: assignedIds.has(l.id)
        }))

        setAllLocations(updatedAllLocations)
        
        // Available locations are those NOT assigned
        setAvailableLocations(updatedAllLocations.filter((loc: any) => !loc.is_assigned))
      }

      // Refresh my locations
      const { data: myLocData } = await supabase
        .from('tenant_locations')
        .select(`*, locations:location_id (*)`)
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)

      if (myLocData) {
        const updatedLocs = myLocData.map((item: any) => ({
          ...item,
          display_price: item.locations?.rate_monthly || item.locations?.rate_khemah || 0,
          location_name: item.locations?.name
        }))
        setMyLocations(updatedLocs)
        
        // Initialize selectedRentals for active locations
        const initialSelections: Record<number, { selected: boolean, amount: string }> = {}
        updatedLocs.filter((l: any) => l.status === 'active').forEach((loc: any) => {
          initialSelections[loc.id] = { selected: false, amount: loc.display_price?.toString() || "0" }
        })
        setSelectedRentals(initialSelections)
      }

      // Refresh history
      await fetchHistory(tenant.id)

      router.refresh()
    } catch (error: any) {
      console.error("Error refreshing data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [tenant?.id, supabase, router])

  const fetchHistory = async (tenantId: number) => {
    const { data: paymentData } = await supabase
      .from('tenant_payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false })

    if (paymentData) {
      const mappedHistory = paymentData.map(payment => ({
        id: payment.id,
        payment_date: payment.payment_date,
        remarks: payment.remarks || `Bayaran sewa - ${payment.payment_method || 'Online'}`,
        amount: payment.amount,
        status: payment.status,
        receipt_url: payment.receipt_url,
        payment_method: payment.payment_method,
        billplz_id: payment.billplz_id,
        is_sandbox: payment.is_sandbox
      }))
      setHistory(mappedHistory)
    }
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (viewParam === 'history') setActiveTab('history')
    else if (viewParam === 'payment') setActiveTab('payment')
    else if (viewParam === 'organizers') setActiveTab('organizers')
    else if (viewParam === 'status') setActiveTab('status')
  }, [viewParam])

  // Initialize selectedRentals when myLocations changes
  useEffect(() => {
    const activeLocs = myLocations.filter((l: any) => l.status === 'active')
    const initialSelections: Record<number, { selected: boolean, amount: string }> = {}
    activeLocs.forEach((loc: any) => {
      initialSelections[loc.id] = { 
        selected: selectedRentals[loc.id]?.selected || false, 
        amount: loc.display_price?.toString() || "0" 
      }
    })
    setSelectedRentals(initialSelections)
  }, [myLocations])

  const handleUpdateCategory = async (rentalId: number) => {
    const category = selectedCategory[rentalId] || "monthly"
    setIsUpdatingCategory(true)
    try {
      const { error } = await supabase.from('tenant_locations').update({
        rate_type: category,
        status: 'active'
      }).eq('id', rentalId)
      if (error) throw error
      toast.success('Kategori berjaya dikemas kini, tapak kini aktif!')
      refreshData()
    } catch (e: any) {
      toast.error('Gagal kemas kini: ' + e.message)
    } finally {
      setIsUpdatingCategory(false)
    }
  }

  const handleDeleteLocation = async (rentalId: number) => {
    if (!confirm("Adakah anda pasti mahu memadam permohonan tapak ini?")) return

    setDeletingLocation(rentalId)
    try {
      const { error } = await supabase
        .from('tenant_locations')
        .update({ is_active: false, status: 'inactive' })
        .eq('id', rentalId)
      
      if (error) throw error
      toast.success('Permohonan tapak berjaya dipadam')
      refreshData()
    } catch (e: any) {
      toast.error('Gagal memadam: ' + e.message)
    } finally {
      setDeletingLocation(null)
    }
  }

  const handleRentalSelection = (rentalId: number, checked: boolean) => {
    setSelectedRentals(prev => ({
      ...prev,
      [rentalId]: { ...prev[rentalId], selected: checked }
    }))
  }

  const handleAmountChange = (rentalId: number, amount: string) => {
    setSelectedRentals(prev => ({
      ...prev,
      [rentalId]: { ...prev[rentalId], amount }
    }))
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tenant) {
      toast.error("Tiada maklumat penyewa")
      return
    }

    // Refresh session before payment to ensure it's valid
    try {
      const { error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.warn("[Payment] Session check warning:", sessionError)
      }
    } catch (e) {
      console.error("[Payment] Session check error:", e)
    }

    // Get selected rentals
    const selectedIds = Object.entries(selectedRentals)
      .filter(([_, data]) => data.selected)
      .map(([id, _]) => parseInt(id))

    if (selectedIds.length === 0) {
      toast.error("Sila pilih sekurang-kurangnya satu lokasi untuk dibayar")
      return
    }

    setIsProcessing(true)

    try {
      const payDate = new Date().toISOString().split('T')[0]
      let totalAmount = 0
      const selectedLocs = myLocations.filter((l: any) => selectedIds.includes(l.id))

      // Calculate total
      selectedIds.forEach(id => {
        const amount = parseFloat(selectedRentals[id]?.amount || '0')
        totalAmount += amount
      })

      const fee = paymentMethod === 'billplz' ? 2.00 * selectedIds.length : 0
      const finalAmount = totalAmount + fee

      if (paymentMethod === 'manual') {
        let receiptUrl = null
        
        if (receiptFile) {
          const fileExt = receiptFile.name.split('.').pop()
          const fileName = `${tenant.id}-${Date.now()}.${fileExt}`
          const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, receiptFile)
          if (uploadError) throw new Error(uploadError.message)
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
          receiptUrl = publicUrl
        }

        // Process each selected rental
        for (const rentalId of selectedIds) {
          const loc = selectedLocs.find((l: any) => l.id === rentalId)
          const amount = parseFloat(selectedRentals[rentalId]?.amount || '0')
          const billRef = `Bayaran Manual - ${loc?.location_name || 'Sewa'}`

          const { error: rpcError } = await supabase.rpc('process_rental_payment', {
            p_tenant_id: tenant.id,
            p_amount: amount,
            p_date: payDate,
            p_receipt_url: receiptUrl || "",
            p_description: `Sewa - ${loc?.location_name} (Manual)`,
            p_category: 'Servis',
            p_remarks: billRef
          })
          if (rpcError) throw new Error(rpcError.message)
        }

        toast.success(`Bayaran manual untuk ${selectedIds.length} lokasi direkodkan! Menunggu semakan.`)
        setIsProcessing(false)
        setActiveTab("history")
        await fetchHistory(tenant.id)

      } else if (paymentMethod === 'billplz') {
        // For multiple locations, we may need to handle differently or make multiple payments
        // For now, let's use the first selected location for the description
        const firstLoc = selectedLocs[0]
        const result = await initiatePayment({
          amount: finalAmount,
          description: `Bayaran Sewa: ${selectedIds.length} lokasi (${firstLoc?.location_name || 'Sewa'})`,
          redirectPath: '/dashboard/rentals'
        })

        if (result.error) throw new Error(result.error)
        if (result.url) {
          toast.success("Mengarahkan ke gerbang pembayaran...")
          window.location.href = result.url
        }
      }

    } catch (err: any) {
      toast.error(err.message)
      setIsProcessing(false)
    }
  }

  // Helper to determine display color and sign for Tenant
  const getTransactionDisplay = (tx: any) => {
    const isExpense = tx.type === 'expense' || tx.is_rent_payment

    if (isExpense) {
      return {
        amountPrefix: "-",
        amountClass: "text-red-500",
        amountValue: tx.amount
      }
    }

    return {
      amountPrefix: "+",
      amountClass: "text-brand-green",
      amountValue: tx.amount
    }
  }

  if (!isMounted) return null
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>

  if (!tenant) return (
    <div className="p-8 text-center bg-yellow-50 rounded-xl border border-yellow-200 text-yellow-800">
      <h3 className="font-bold text-lg">Akaun Belum Diaktifkan</h3>
      <p>Sila hubungi Admin untuk mengaktifkan akaun perniagaan anda.</p>
    </div>
  )

  const approvedOrganizers = linkedOrganizers.filter(
    o => o.status === 'approved' || o.status === 'active'
  )

  const hasApprovedOrganizer = approvedOrganizers.length > 0
  const hasPendingOrganizer = linkedOrganizers.some(o => o.status === 'pending')
  const activeLocations = myLocations.filter(l => l.status === 'active')
  const approvedLocations = myLocations.filter(l => l.status === 'approved')

  // Calculate totals for payment
  const selectedCount = Object.values(selectedRentals).filter(r => r.selected).length
  const totalAmount = Object.entries(selectedRentals)
    .filter(([_, data]) => data.selected)
    .reduce((sum, [_, data]) => sum + parseFloat(data.amount || '0'), 0)
  const feeTotal = paymentMethod === 'billplz' ? 2.00 * selectedCount : 0
  const grandTotal = totalAmount + feeTotal

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-serif font-bold text-foreground">Pengurusan Sewa</h2>
        <p className="text-muted-foreground">
          Urus status sewa dan pembayaran tapak untuk <strong>{tenant.business_name}</strong>
        </p>
      </div>

      {/* Main Tabs - 4 tabs as requested */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl w-full grid grid-cols-4">
          <TabsTrigger value="status" className="rounded-lg">
            <Store className="w-4 h-4 mr-2 hidden md:inline" />
            Status Tapak
          </TabsTrigger>
          <TabsTrigger value="payment" className="rounded-lg">
            <CreditCard className="w-4 h-4 mr-2 hidden md:inline" />
            Bayar Sewa
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            <FileText className="w-4 h-4 mr-2 hidden md:inline" />
            Sejarah Bayaran
          </TabsTrigger>
          <TabsTrigger value="organizers" className="rounded-lg">
            <Building2 className="w-4 h-4 mr-2 hidden md:inline" />
            Penganjur Saya
          </TabsTrigger>
        </TabsList>

        {/* Status Tab - Tapak Sewaan Saya + Lokasi Penganjur Saya */}
        <TabsContent value="status" className="mt-6 space-y-6">
          {/* Waiting for Approval State */}
          {!hasApprovedOrganizer && (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                {hasPendingOrganizer ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-2">
                      Menunggu Kelulusan Penganjur
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      Permohonan anda sedang dalam semakan. Anda akan dapat mengakses 
                      semua ciri sebaik sahaja diluluskan oleh penganjur.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <Building2 className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-2">
                      Pautkan Penganjur
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      Sila pautkan dengan sekurang-kurangnya satu penganjur untuk 
                      mengakses semua ciri pengurusan sewa.
                    </p>
                    <Button 
                      className="mt-4" 
                      onClick={() => setActiveTab('organizers')}
                    >
                      Pergi ke Penganjur Saya
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tapak Sewaan Saya Section */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                Tapak Sewaan Saya
                {myLocations.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {myLocations.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Senarai lokasi yang telah dipohon dan diluluskan
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myLocations.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
                  <Store className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Tiada tapak sewaan
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasApprovedOrganizer 
                      ? "Pilih lokasi dari bahagian bawah untuk memohon"
                      : "Pautkan penganjur terlebih dahulu untuk melihat lokasi"
                    }
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {myLocations.map((rental: any) => (
                    <RentalCard 
                      key={rental.id} 
                      rental={rental}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      isUpdatingCategory={isUpdatingCategory}
                      onUpdateCategory={handleUpdateCategory}
                      onDeleteLocation={handleDeleteLocation}
                      isDeleting={deletingLocation === rental.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lokasi Penganjur Saya Section - Only show if has approved organizer */}
          {hasApprovedOrganizer && (
            <LocationSelector
              tenantId={tenant.id}
              availableLocations={availableLocations}
              allLocations={allLocations}
              hasApprovedOrganizer={hasApprovedOrganizer}
              onUpdate={refreshData}
            />
          )}
        </TabsContent>

        {/* Payment Tab - Show ALL rentals */}
        <TabsContent value="payment" className="mt-6">
          <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground font-serif">
                <CreditCard className="text-primary" />
                Pembayaran Sewa
              </CardTitle>
              <CardDescription>
                Pilih satu atau lebih lokasi untuk dibayar. Anda boleh mengubah jumlah bayaran jika perlu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeLocations.length > 0 ? (
                <form onSubmit={handlePayment} className="space-y-6">
                  {/* Payment Method Selection */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div
                      onClick={() => setPaymentMethod('billplz')}
                      className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'billplz' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-white hover:bg-secondary/50'}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <CreditCard size={18} />
                      </div>
                      <span className="font-bold text-sm">FPX / Online</span>
                      <span className="text-xs text-muted-foreground">+RM2.00 Caj</span>
                    </div>
                    <div
                      onClick={() => setPaymentMethod('manual')}
                      className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'manual' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-white hover:bg-secondary/50'}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Upload size={18} />
                      </div>
                      <span className="font-bold text-sm">Resit Manual</span>
                      <span className="text-xs text-muted-foreground">Tiada Caj</span>
                    </div>
                  </div>

                  {/* Multi-Location Selection */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Pilih Lokasi untuk Dibayar</Label>
                    
                    <div className="space-y-3">
                      {activeLocations.map((rental: any) => (
                        <div 
                          key={rental.id}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-xl border transition-all",
                            selectedRentals[rental.id]?.selected 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRentals[rental.id]?.selected || false}
                            onChange={(e) => handleRentalSelection(rental.id, e.target.checked)}
                            className="w-5 h-5 accent-primary"
                          />
                          
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{rental.location_name}</p>
                            <p className="text-xs text-muted-foreground">
                              No. Petak: {rental.stall_number || "-"} • {rental.rate_type === 'monthly' ? 'Bulanan' : `Mingguan (${rental.rate_type})`}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <Label className="text-xs text-muted-foreground block mb-1">Jumlah (RM)</Label>
                            <Input
                              type="number"
                              value={selectedRentals[rental.id]?.amount || rental.display_price}
                              onChange={(e) => handleAmountChange(rental.id, e.target.value)}
                              disabled={!selectedRentals[rental.id]?.selected}
                              className="w-28 h-9 text-right font-bold"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  {selectedCount > 0 && (
                    <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{selectedCount} lokasi dipilih</span>
                        <span className="font-medium">RM {totalAmount.toFixed(2)}</span>
                      </div>
                      {paymentMethod === 'billplz' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Caj Transaksi (RM2 x {selectedCount})</span>
                          <span className="font-medium">RM {feeTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold pt-2 border-t">
                        <span>Jumlah Bayaran</span>
                        <span className="text-primary">RM {grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'manual' && (
                    <div className="space-y-2">
                      <Label>Muat Naik Resit</Label>
                      <Input 
                        type="file" 
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} 
                        className="h-12 pt-2 rounded-xl bg-secondary/20" 
                      />
                    </div>
                  )}

                  <Button 
                    disabled={isProcessing || selectedCount === 0} 
                    className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-primary/20"
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin mr-2" />
                    ) : (
                      <CreditCard className="w-5 h-5 mr-2" />
                    )}
                    {selectedCount > 0 ? `Bayar RM ${grandTotal.toFixed(2)}` : "Pilih Lokasi untuk Bayar"}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="w-10 h-10 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Tiada lokasi aktif untuk dibayar</p>
                  <p className="text-sm mt-1">Sila mohon tapak dahulu dalam tab Status Tapak</p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => setActiveTab('status')}
                  >
                    Pergi ke Status Tapak
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader><CardTitle className="text-foreground font-serif">Rekod Pembayaran</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="pl-6">Tarikh</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Resit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((pay: any) => (
                    <TableRow key={pay.id}>
                      <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                        {(() => {
                          const dateStr = pay.payment_date || pay.date
                          if (!dateStr) return '-'
                          const date = new Date(dateStr)
                          if (isNaN(date.getTime())) return '-'
                          return date.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                        })()}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {pay.location_name ? (
                          <div className="flex items-center gap-1">
                            <Store className="w-3 h-3 text-muted-foreground" />
                            {pay.location_name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{pay.remarks || "Bayaran Sewa"}</div>
                      </TableCell>
                      {(() => {
                        const display = getTransactionDisplay(pay)
                        return (
                          <TableCell className={cn("text-right font-bold", display.amountClass)}>
                            {display.amountPrefix} RM {Number(pay.amount).toFixed(2)}
                          </TableCell>
                        )
                      })()}
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            pay.status === "approved"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-amber-50 text-amber-600 border-amber-100",
                          )}
                        >
                          {pay.status === 'approved' ? 'Berjaya' : 'Menunggu'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {pay.receipt_url ? (
                          <a href={pay.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-primary">
                            <FileText size={16} />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6">Tiada rekod.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizers Tab - Separated as requested */}
        <TabsContent value="organizers" className="mt-6">
          <OrganizerValidation
            tenantId={tenant.id}
            linkedOrganizers={linkedOrganizers}
            onUpdate={refreshData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Sub-components

function RentalCard({ 
  rental, 
  selectedCategory,
  setSelectedCategory,
  isUpdatingCategory,
  onUpdateCategory,
  onDeleteLocation,
  isDeleting
}: { 
  rental: any
  selectedCategory: Record<number, string>
  setSelectedCategory: React.Dispatch<React.SetStateAction<Record<number, string>>>
  isUpdatingCategory: boolean
  onUpdateCategory: (rentalId: number) => void
  onDeleteLocation?: (rentalId: number) => void
  isDeleting?: boolean
}) {
  return (
    <Card className={cn(
      "border-border/50 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all",
      rental.status === 'active' ? "bg-white" : "bg-muted/30"
    )}>
      <CardHeader className="pb-4 bg-secondary/30 border-b border-border/30">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Program Name Badge */}
            {rental.program_name && (
              <Badge variant="outline" className="mb-2 text-[10px] bg-primary/5 border-primary/20 text-primary">
                {rental.program_name}
              </Badge>
            )}
            <CardTitle className="text-foreground font-serif text-xl">{rental.location_name}</CardTitle>
            {/* Organizer name for all statuses */}
            {rental.organizer_name && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {rental.organizer_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("capitalize border-none",
              rental.status === 'active' ? "bg-green-100 text-green-700" :
              rental.status === 'approved' ? "bg-blue-100 text-blue-700" :
              rental.status === 'pending' ? "bg-amber-100 text-amber-700" : 
              "bg-gray-100 text-gray-600"
            )}>
              {rental.status === 'approved' ? 'Tindakan Diperlukan' : rental.status}
            </Badge>
            {/* Delete button for approved/pending/active locations */}
            {onDeleteLocation && (rental.status === 'approved' || rental.status === 'pending' || rental.status === 'active') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onDeleteLocation(rental.id)}
                disabled={isDeleting}
                title="Padam permohonan tapak"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="font-mono">
          {rental.status === 'active' ? (
            <>No. Petak: <strong className="text-foreground">{rental.stall_number || "Belum Ditentukan"}</strong></>
          ) : rental.status === 'approved' ? (
            <span className="italic text-blue-600">Sila pilih kategori sewaan</span>
          ) : (
            <span className="italic">
              Menunggu Kelulusan{rental.organizer_name ? ` dari ${rental.organizer_name}` : ''}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {rental.status === 'approved' ? (
          <div className="space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="font-bold text-sm">Permohonan Diluluskan!</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Sila pilih kategori sewaan untuk mengaktifkan tapak ini.
            </p>
            <select
              value={selectedCategory[rental.id] || "monthly"}
              onChange={(e) => setSelectedCategory(prev => ({ ...prev, [rental.id]: e.target.value }))}
              className="w-full h-10 rounded-lg border border-input bg-white px-3 text-sm"
            >
              {/* Only show options with prices > 0 */}
              {(rental.rate_monthly > 0 || rental.rate_monthly_khemah > 0 || rental.rate_monthly_cbs > 0) && (
                <option value="monthly">Bulanan</option>
              )}
              {(rental.rate_khemah > 0 || rental.rate_monthly_khemah > 0) && (
                <option value="khemah">Mingguan (Khemah)</option>
              )}
              {(rental.rate_cbs > 0 || rental.rate_monthly_cbs > 0) && (
                <option value="cbs">Mingguan (CBS)</option>
              )}
            </select>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => onUpdateCategory(rental.id)}
              disabled={isUpdatingCategory}
            >
              {isUpdatingCategory ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sempurnakan & Aktifkan
            </Button>
          </div>
        ) : (
          <>
            {/* Google Maps Link */}
            {(rental.google_maps_url || rental.address) && (
              <div className="mb-4">
                {rental.google_maps_url ? (
                  <a 
                    href={rental.google_maps_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{rental.address || 'Lihat di Google Maps'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {rental.address}
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-muted-foreground font-medium">Jenis Sewa:</span>
              <Badge variant="outline" className="capitalize">
                {rental.rate_type === 'khemah' || rental.rate_type === 'cbs' 
                  ? `Mingguan (${rental.rate_type})` 
                  : 'Bulanan'}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Kadar Semasa:</span>
              <span className="text-2xl font-bold text-primary">RM {rental.display_price}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Define the 5 Jenis Operasi
const JENIS_OPERASI = [
  { value: "daily", label: "Mingguan (Pasar Malam/Pagi)", types: ["daily"] },
  { value: "monthly", label: "Bulanan (Kiosk/Uptown)", types: ["monthly"] },
  { value: "expo", label: "Expo / Karnival", types: ["expo"] },
  { value: "bazar_ramadhan", label: "Bazar Ramadhan", types: ["bazar_ramadhan"] },
  { value: "bazar_raya", label: "Bazar Raya", types: ["bazar_raya"] },
]

function LocationSelector({ 
  tenantId, 
  availableLocations,
  allLocations,
  hasApprovedOrganizer,
  onUpdate 
}: { 
  tenantId: number
  availableLocations: any[]
  allLocations: any[]
  hasApprovedOrganizer: boolean
  onUpdate: () => void 
}) {
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // UI Flow: Programs & Jenis Operasi Selection
  const [selectedProgram, setSelectedProgram] = useState<string>("")
  const [selectedJenisOperasi, setSelectedJenisOperasi] = useState<string>("")

  const handleToggleLocation = (locationId: number) => {
    setSelectedLocationIds(prev => 
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    )
  }

  const handleSubmit = async () => {
    if (selectedLocationIds.length === 0) {
      toast.error("Sila pilih sekurang-kurangnya satu lokasi")
      return
    }

    setIsSubmitting(true)
    try {
      const { addTenantLocationsAction } = await import("@/actions/tenant-organizer")
      const result = await addTenantLocationsAction(tenantId, selectedLocationIds)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setSelectedLocationIds([])
      setSelectedProgram("")
      setSelectedJenisOperasi("")
      onUpdate()
    } catch (error: any) {
      toast.error("Gagal menambah lokasi: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Use allLocations to show all programs (even if tenant has some locations in them)
  const uniquePrograms = [...new Set(allLocations.map((loc: any) => loc.program_name).filter(Boolean))]
  
  // Filter locations based on selected program and jenis operasi
  // Use allLocations to show all, but mark assigned ones
  const filteredLocations = allLocations.filter((loc: any) => {
    if (selectedProgram && loc.program_name !== selectedProgram) return false
    if (selectedJenisOperasi) {
      const jenis = JENIS_OPERASI.find(j => j.value === selectedJenisOperasi)
      if (jenis && !jenis.types.includes(loc.type)) return false
    }
    return true
  })

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Mohon Program Baru
        </CardTitle>
        <CardDescription>
          Pilih program dan jenis operasi untuk memohon tapak perniagaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {allLocations.length === 0 ? (
          <div className="space-y-4">
            {/* Step 1: Select Program - Show even when empty */}
            <div className="space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <span className="bg-primary text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">1</span>
                Pilih Program
              </Label>
              <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Tiada program tersedia
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasApprovedOrganizer 
                    ? "Penganjur anda tidak mempunyai lokasi aktif" 
                    : "Sila tunggu kelulusan penganjur terlebih dahulu"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Step 1: Select Program */}
            <div className="space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <span className="bg-primary text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">1</span>
                Pilih Program
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {uniquePrograms.map((program: string) => (
                  <button
                    key={program}
                    onClick={() => {
                      setSelectedProgram(program)
                      setSelectedJenisOperasi("")
                      setSelectedLocationIds([])
                    }}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      selectedProgram === program
                        ? "bg-primary/10 border-primary ring-1 ring-primary"
                        : "bg-white border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {selectedProgram === program ? (
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className="font-medium text-sm">{program}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Jenis Operasi */}
            {selectedProgram && (
              <div className="space-y-3 pt-4 border-t border-border/50">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <span className="bg-primary text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">2</span>
                  Pilih Jenis Operasi
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {JENIS_OPERASI.map((jenis) => {
                    // Check if this jenis operasi has any locations for selected program
                    // Use allLocations to show option even if all locations are assigned
                    const hasLocations = allLocations.some((loc: any) => 
                      loc.program_name === selectedProgram && 
                      jenis.types.includes(loc.type)
                    )
                    return (
                      <button
                        key={jenis.value}
                        onClick={() => {
                          if (hasLocations) {
                            setSelectedJenisOperasi(jenis.value)
                            setSelectedLocationIds([])
                          }
                        }}
                        disabled={!hasLocations}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all",
                          selectedJenisOperasi === jenis.value
                            ? "bg-green-100 border-green-500 ring-1 ring-green-500"
                            : hasLocations
                              ? "bg-white border-border hover:border-green-400"
                              : "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {selectedJenisOperasi === jenis.value ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2",
                                hasLocations ? "border-muted-foreground/30" : "border-gray-300"
                              )} />
                            )}
                            <span className="font-medium text-sm">{jenis.label}</span>
                          </div>
                          {!hasLocations && (
                            <span className="text-[10px] text-muted-foreground">Tiada</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Select Specific Locations */}
            {selectedProgram && selectedJenisOperasi && (
              <div className="space-y-3 pt-4 border-t border-border/50">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <span className="bg-primary text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">3</span>
                  Pilih Lokasi
                </Label>
                
                {filteredLocations.length > 0 ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      {filteredLocations.map((loc: any) => {
                        const isAssigned = loc.is_assigned
                        return (
                          <label
                            key={loc.location_id}
                            className={cn(
                              "flex flex-col gap-2 p-3 rounded-xl border transition-all",
                              isAssigned 
                                ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                                : selectedLocationIds.includes(loc.location_id)
                                  ? "border-primary bg-primary/5 cursor-pointer"
                                  : "border-border hover:border-primary/50 cursor-pointer"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedLocationIds.includes(loc.location_id)}
                                onChange={() => !isAssigned && handleToggleLocation(loc.location_id)}
                                disabled={isAssigned}
                                className="w-4 h-4 accent-primary mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {/* Program Name Badge */}
                                  {loc.program_name && (
                                    <Badge variant="outline" className="text-[10px] bg-primary/5">
                                      {loc.program_name}
                                    </Badge>
                                  )}
                                  {/* Assigned Badge */}
                                  {isAssigned && (
                                    <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Sudah Dipohon
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium text-sm truncate">{loc.location_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {loc.operating_days}
                                </p>
                                {/* Show available rates */}
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {loc.rate_khemah > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">Khemah RM{loc.rate_khemah}</Badge>
                                  )}
                                  {loc.rate_cbs > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">CBS RM{loc.rate_cbs}</Badge>
                                  )}
                                  {loc.rate_monthly > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">Bulanan RM{loc.rate_monthly}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Google Maps Link */}
                            {(loc.google_maps_url || loc.address) && (
                              <div className="pl-7">
                                {loc.google_maps_url ? (
                                  <a 
                                    href={loc.google_maps_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                  >
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{loc.address || 'Lihat di Google Maps'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {loc.address}
                                  </p>
                                )}
                              </div>
                            )}
                          </label>
                        )
                      })}
                    </div>
                    
                    {/* Show selection count */}
                    {selectedLocationIds.length > 0 && (
                      <div className="flex items-center justify-between pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          {selectedLocationIds.length} lokasi dipilih
                        </p>
                        <Button
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          Hantar Permohonan
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 text-center bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">
                    <p>Tiada lokasi tersedia untuk pilihan ini.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

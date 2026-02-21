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
  CheckCircle2
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
  initialLinkedOrganizers?: LinkedOrganizer[]
}

export function EnhancedRentalModule({
  initialTenant,
  initialLocations,
  initialHistory,
  initialAvailable,
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

      // Fetch available locations
      const { data: locData, error: locError } = await supabase
        .rpc('get_available_locations_for_tenant', {
          p_tenant_id: tenant.id
        })

      if (!locError && locData) {
        setAvailableLocations(locData.map((l: any) => ({
          ...l,
          display_price: l.rate_monthly || l.rate_khemah || 0,
          operating_days: l.operating_days || 'Setiap Hari',
          organizer_name: l.organizer_name
        })))
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

        {/* Status Tab - Tapak Sewaan Saya + Pilih Lokasi Baharu */}
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
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pilih Lokasi Baharu Section - Only show if has approved organizer */}
          {hasApprovedOrganizer && (
            <LocationSelector
              tenantId={tenant.id}
              availableLocations={availableLocations}
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
  onUpdateCategory
}: { 
  rental: any
  selectedCategory: Record<number, string>
  setSelectedCategory: React.Dispatch<React.SetStateAction<Record<number, string>>>
  isUpdatingCategory: boolean
  onUpdateCategory: (rentalId: number) => void
}) {
  return (
    <Card className={cn(
      "border-border/50 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all",
      rental.status === 'active' ? "bg-white" : "bg-muted/30"
    )}>
      <CardHeader className="pb-4 bg-secondary/30 border-b border-border/30">
        <div className="flex justify-between items-start">
          <CardTitle className="text-foreground font-serif text-xl">{rental.location_name}</CardTitle>
          <Badge className={cn("capitalize border-none",
            rental.status === 'active' ? "bg-green-100 text-green-700" :
            rental.status === 'approved' ? "bg-blue-100 text-blue-700" :
            rental.status === 'pending' ? "bg-amber-100 text-amber-700" : 
            "bg-gray-100 text-gray-600"
          )}>
            {rental.status === 'approved' ? 'Tindakan Diperlukan' : rental.status}
          </Badge>
        </div>
        <CardDescription className="font-mono">
          {rental.status === 'active' ? (
            <>No. Petak: <strong className="text-foreground">{rental.stall_number || "Belum Ditentukan"}</strong></>
          ) : rental.status === 'approved' ? (
            <span className="italic text-blue-600">Sila pilih kategori sewaan</span>
          ) : (
            <span className="italic">Menunggu Kelulusan</span>
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
              <option value="monthly">Bulanan</option>
              <option value="khemah">Mingguan (Khemah)</option>
              <option value="cbs">Mingguan (CBS)</option>
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

function LocationSelector({ 
  tenantId, 
  availableLocations,
  onUpdate 
}: { 
  tenantId: number
  availableLocations: any[]
  onUpdate: () => void 
}) {
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      onUpdate()
    } catch (error: any) {
      toast.error("Gagal menambah lokasi: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Group by organizer
  const groupedByOrganizer = availableLocations.reduce((acc: Record<string, any[]>, loc: any) => {
    const orgName = loc.organizer_name || 'Lain-lain'
    if (!acc[orgName]) acc[orgName] = []
    acc[orgName].push(loc)
    return acc
  }, {})

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Pilih Lokasi Baharu
        </CardTitle>
        <CardDescription>
          Pilih satu atau lebih lokasi untuk dipohon
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedByOrganizer).map(([orgName, locations]) => (
          <div key={orgName} className="space-y-2">
            <h4 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {orgName}
            </h4>
            <div className="grid gap-2 md:grid-cols-2">
              {(locations as any[]).map((loc: any) => (
                <label
                  key={loc.location_id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                    selectedLocationIds.includes(loc.location_id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedLocationIds.includes(loc.location_id)}
                    onChange={() => handleToggleLocation(loc.location_id)}
                    className="w-4 h-4 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{loc.location_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {loc.operating_days} • RM{loc.rate_monthly || loc.rate_khemah || '-'}/bulan
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}

        {selectedLocationIds.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {selectedLocationIds.length} lokasi dipilih
            </p>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Mohon Lokasi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

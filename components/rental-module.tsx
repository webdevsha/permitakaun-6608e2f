"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreditCard, Loader2, Upload, FileText, CheckCircle2, AlertCircle, Plus, Store, ExternalLink, Building } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import { Tenant } from "@/types/supabase-types"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { initiatePayment } from "@/actions/payment"

export function RentalModule({ initialTenant, initialLocations, initialHistory, initialAvailable }: any) {
  const { user } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialize state from Props
  const [loading, setLoading] = useState(false)
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant || null)
  const [myLocations, setMyLocations] = useState<any[]>(initialLocations || [])
  const [availableLocations, setAvailableLocations] = useState<any[]>(initialAvailable || [])
  const [history, setHistory] = useState<any[]>(initialHistory || [])

  // Tab State Management
  const viewParam = searchParams.get('view')
  const [activeTab, setActiveTab] = useState<string>(viewParam === 'history' ? 'history' : 'status')

  const [isMounted, setIsMounted] = useState(false)

  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"manual" | "billplz">("billplz")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // New Rental Application State
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false)
  const [applyLocationId, setApplyLocationId] = useState("")
  const [applyRateType, setApplyRateType] = useState("monthly")
  const [isApplying, setIsApplying] = useState(false)

  // Organizer Code Management
  const [organizerCodeInput, setOrganizerCodeInput] = useState("")
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  // Sync tab with URL param
  useEffect(() => {
    if (viewParam === 'history') setActiveTab('history')
    else if (viewParam === 'payment') setActiveTab('payment')
    else if (viewParam === 'status') setActiveTab('status')
  }, [viewParam])

  // Auto-select first active location
  useEffect(() => {
    const active = (initialLocations || []).filter((l: any) => l.status === 'active')
    if (active.length > 0 && !selectedLocationId) {
      console.log("[Client] Auto-selecting active location:", active[0].id)
      setSelectedLocationId(active[0].id.toString())
      setPaymentAmount(active[0].display_price?.toString() || "")
    }
  }, [initialLocations, selectedLocationId])

  // Handle Billplz Return (Still needs client side check if param exists)
  useEffect(() => {
    const billplzId = searchParams.get('billplz[id]')
    if (billplzId && tenant) {
      verifyBillplzPayment(billplzId, tenant.id)
    }
  }, [searchParams, tenant])

  // Refetch location data when page becomes visible (to get latest rates)
  useEffect(() => {
    if (!tenant) return

    const handleVisibilityChange = () => {
      if (!document.hidden && tenant.id) {
        refetchMyLocations(tenant.id)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [tenant])


  const fetchHistory = async (tenantId: number) => {
    // UPDATED: Fetch from 'transactions' table to include all records (including seeded data)
    // tenant_payments is only for specific payment flow, transactions is the master ledger
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })

    if (txData) {
      // Map transaction data to the history structure used in UI
      const mappedHistory = txData.map(tx => ({
        id: tx.id,
        payment_date: tx.date,
        remarks: tx.description,
        amount: tx.amount,
        status: tx.status,
        receipt_url: tx.receipt_url,
        category: tx.category,
        type: tx.type
      }))
      setHistory(mappedHistory)
    }
  }

  // Refetch myLocations to get latest rental rates
  const refetchMyLocations = async (tenantId: number) => {
    const { data: locData } = await supabase
      .from('tenant_locations')
      .select(`*, locations:location_id (*)`)
      .eq('tenant_id', tenantId)

    if (locData) {
      const updatedLocations = locData.map((item: any) => {
        let price = 0
        if (item.rate_type === 'khemah') price = item.locations.rate_khemah
        else if (item.rate_type === 'cbs') price = item.locations.rate_cbs
        else if (item.rate_type === 'monthly') price = item.locations.rate_monthly

        return {
          ...item,
          display_price: price,
          location_name: item.locations.name
        }
      })
      setMyLocations(updatedLocations)

      // Update payment amount if current selection exists
      if (selectedLocationId) {
        const currentLoc = updatedLocations.find((l: any) => l.id.toString() === selectedLocationId)
        if (currentLoc) {
          setPaymentAmount(currentLoc.display_price.toString())
        }
      }
    }
  }

  // Helper to determine display color and sign for Tenant
  const getTransactionDisplay = (tx: any) => {
    // If it's a payment (Income for Admin), it's Expense for Tenant
    // categories: 'Sewa', 'Deposit', 'Lain-lain' (if paid to admin)

    // Default: use DB type. 
    // BUT for 'Sewa' (Rent), it is usually recorded as Income by Admin.
    // So for Tenant, if category is 'Sewa', it should be Negative.

    const isExpenseForTenant = tx.category === 'Sewa' || tx.category === 'Deposit' || tx.category === 'Caj Lewat' // Add more categories if needed

    if (isExpenseForTenant) {
      return {
        amountPrefix: "-",
        amountClass: "text-red-500",
        amountValue: tx.amount
      }
    }

    // Valid "Income" for tenant? Maybe refunds?
    return {
      amountPrefix: "+",
      amountClass: "text-brand-green",
      amountValue: tx.amount
    }
  }

  const verifyBillplzPayment = async (billId: string, tenantId: number) => {
    try {
      const toastId = toast.loading("Mengsahihkan pembayaran...")

      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('payment-gateway', {
        body: { action: 'verify_bill', bill_id: billId }
      })

      if (verifyError) throw new Error(verifyError.message || "Ralat gateway")
      if (!verifyData) throw new Error("Tiada data dari gateway")

      if (verifyData.paid) {
        const billRef = `Billplz Ref: ${billId}`

        const { data: existing } = await supabase
          .from('tenant_payments')
          .select('*')
          .eq('remarks', billRef)
          .eq('status', 'approved')
          .maybeSingle()

        if (existing) {
          toast.dismiss(toastId)
          toast.success("Pembayaran telah direkodkan.")
          router.replace('/dashboard?module=rentals&view=history')
          return
        }

        const { data: pendingRecord } = await supabase
          .from('tenant_payments')
          .select('*')
          .eq('remarks', billRef)
          .maybeSingle()

        if (pendingRecord) {
          await supabase.from('tenant_payments').update({ status: 'approved' }).eq('id', pendingRecord.id)
          if (pendingRecord.transaction_id) {
            await supabase.from('transactions').update({ status: 'approved' }).eq('id', pendingRecord.transaction_id)
          }

          toast.dismiss(toastId)
          toast.success("Pembayaran berjaya disahkan!")
          await fetchHistory(tenantId)
          router.replace('/dashboard?module=rentals&view=history')
        }
      } else {
        toast.dismiss(toastId)
        toast.error("Pembayaran tidak berjaya atau dibatalkan.")
        router.replace('/dashboard?module=rentals&view=payment')
      }
    } catch (e: any) {
      toast.dismiss()
      toast.error("Ralat pengesahan: " + e.message)
      router.replace('/dashboard?module=rentals&view=payment')
    }
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locId = e.target.value
    setSelectedLocationId(locId)
    const loc = myLocations.find(l => l.id.toString() === locId)
    if (loc) {
      setPaymentAmount(loc.display_price.toString())
    }
  }

  const handleUpdateOrganizer = async () => {
    if (!organizerCodeInput || !tenant) return
    setIsVerifyingCode(true)
    try {
      // 1. Check if code exists
      const { data: org, error: orgError } = await supabase
        .from('organizers')
        .select('id, name')
        .eq('organizer_code', organizerCodeInput.toUpperCase())
        .maybeSingle()

      if (orgError || !org) {
        toast.error("Kod Penganjur tidak sah atau tidak dijumpai.")
        setIsVerifyingCode(false)
        return
      }

      // 2. Update Tenant Record
      const { error: updateError } = await supabase
        .from('tenants')
        .update({ organizer_code: organizerCodeInput.toUpperCase() })
        .eq('id', tenant.id)

      if (updateError) throw updateError

      toast.success(`Berjaya dipautkan ke ${org.name}`)

      // 3. Refresh Page to reload data completely
      window.location.reload()

    } catch (e: any) {
      toast.error(e.message)
      setIsVerifyingCode(false)
    }
  }

  const handleApplyRental = async () => {
    if (!tenant || !applyLocationId) return

    setIsApplying(true)
    try {
      const { error } = await supabase.from('tenant_locations').insert({
        tenant_id: tenant.id,
        location_id: parseInt(applyLocationId),
        rate_type: applyRateType,
        status: 'pending', // Require Admin Activation
        stall_number: null // Unfillable by tenant
      })

      if (error) throw error

      toast.success("Permohonan dihantar! Menunggu kelulusan Admin.")
      setIsApplyDialogOpen(false)
      setApplyLocationId("")

      // Refresh list
      window.location.reload()
    } catch (e: any) {
      toast.error("Gagal memohon: " + e.message)
    } finally {
      setIsApplying(false)
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[Client] Handle Payment Clicked")
    console.log("[Client] Tenant:", tenant?.id)
    console.log("[Client] Selected Location ID:", selectedLocationId)

    if (!tenant || !selectedLocationId) {
      console.warn("[Client] Missing tenant or location ID. Aborting.")
      toast.error("Sila pilih lokasi dahulu.")
      return
    }

    setIsProcessing(true)

    try {
      const selectedLoc = myLocations.find(l => l.id.toString() === selectedLocationId)
      const payDate = new Date().toISOString().split('T')[0]
      let receiptUrl = null
      let billRef = ""

      // Fee Calculation
      const baseAmount = parseFloat(paymentAmount)
      const fee = paymentMethod === 'billplz' ? 2.00 : 0
      const finalAmount = baseAmount + fee

      if (paymentMethod === 'manual') {
        if (receiptFile) {
          const fileExt = receiptFile.name.split('.').pop()
          const fileName = `${tenant.id}-${Date.now()}.${fileExt}`
          const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, receiptFile)
          if (uploadError) throw new Error(uploadError.message)
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
          receiptUrl = publicUrl
        }
        billRef = `Bayaran Manual - ${selectedLoc?.location_name || 'Sewa'}`

        // Manual Flow: Direct Insert as 'pending'
        const { error: rpcError } = await supabase.rpc('process_rental_payment', {
          p_tenant_id: tenant.id,
          p_amount: finalAmount,
          p_date: payDate,
          p_receipt_url: receiptUrl || "",
          p_description: `Sewa - ${selectedLoc?.location_name} (Manual)`,
          p_category: 'Servis',
          p_remarks: billRef
        })
        if (rpcError) throw new Error(rpcError.message)

        toast.success("Bayaran manual direkodkan! Menunggu semakan.")
        setIsProcessing(false)
        setActiveTab("history")
        await fetchHistory(tenant.id)

      } else if (paymentMethod === 'billplz') {
        // Gateway Flow: Use initiatePayment action
        const result = await initiatePayment({
          amount: finalAmount,
          description: `Bayaran Sewa: ${selectedLoc?.location_name || 'Uptown'}`,
          redirectPath: '/dashboard?module=rentals&view=history'
        })

        if (result.error) throw new Error(result.error)
        if (result.url) {
          // We can optionally record a pending transaction here if needed, 
          // but let's rely on the gateway call first.
          // Ideally: Insert 'pending' tx into DB, then redirect.
          // For now, redirecting.
          toast.success("Mengarahkan ke gerbang pembayaran...")
          window.location.href = result.url
        }
      }

    } catch (err: any) {
      toast.error(err.message)
      setIsProcessing(false)
    }
  }

  if (!isMounted) return null // Prevent hydration mismatch
  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>

  if (!tenant) return (
    <div className="p-8 text-center bg-yellow-50 rounded-xl border border-yellow-200 text-yellow-800">
      <h3 className="font-bold text-lg">Akaun Belum Diaktifkan</h3>
      <p>Sila hubungi Admin untuk mengaktifkan akaun perniagaan anda.</p>
    </div>
  )

  const activeLocations = myLocations.filter(l => l.status === 'active')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-serif font-bold text-foreground">Pengurusan Sewa</h2>
        <p className="text-muted-foreground">Urus status sewa dan pembayaran tapak untuk <strong>{tenant.business_name}</strong></p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="status" className="rounded-lg">Status Tapak</TabsTrigger>
          <TabsTrigger value="payment" className="rounded-lg">Bayar Sewa</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">Sejarah Bayaran</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-primary/20">
                  <Plus className="mr-2 h-4 w-4" /> Mohon Tapak Baru
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Permohonan Sewa Tapak</DialogTitle>
                  <DialogDescription>
                    Pilih lokasi penganjur dan jenis sewaan.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* Organizer Code Section */}
                  <div className="p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/20 space-y-3">
                    <Label className="text-xs font-bold text-brand-blue uppercase flex items-center gap-2">
                      <Building className="w-3 h-3" /> Kod Penganjur
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={organizerCodeInput}
                        onChange={(e) => setOrganizerCodeInput(e.target.value.toUpperCase())}
                        placeholder={tenant.organizer_code || "Masukkan Kod (Cth: ORG001)"}
                        className="bg-white uppercase font-mono"
                      />
                      <Button size="sm" onClick={handleUpdateOrganizer} disabled={isVerifyingCode} className="shrink-0 bg-brand-blue hover:bg-brand-blue/90 text-white">
                        {isVerifyingCode ? <Loader2 className="animate-spin" /> : (tenant.organizer_code ? "Tukar" : "Simpan")}
                      </Button>
                    </div>
                    {tenant.organizer_code ? (
                      <p className="text-[10px] text-green-600 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Penganjur aktif: {tenant.organizer_code}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Masukkan kod penganjur anda untuk melihat lokasi yang tersedia.
                      </p>
                    )}
                  </div>

                  {availableLocations.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        <Label>Lokasi Pasar</Label>
                        <Select value={applyLocationId} onValueChange={setApplyLocationId}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Pilih lokasi..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLocations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id.toString()}>
                                {loc.name} ({loc.operating_days})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Jenis Sewaan</Label>
                        <Select value={applyRateType} onValueChange={setApplyRateType}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                            <SelectItem value="khemah">Mingguan (Khemah)</SelectItem>
                            <SelectItem value="cbs">Mingguan (CBS/Lori)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-3 bg-secondary/20 rounded-xl text-xs text-muted-foreground flex gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>Status permohonan akan menjadi "Pending" sehingga diluluskan oleh Admin. No. Petak akan diberikan selepas kelulusan.</p>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">
                      <p className="mb-2 font-medium">Tiada lokasi tersedia.</p>
                      <p className="text-xs">Sila pastikan anda telah memasukkan <strong>Kod Penganjur</strong> yang betul di atas.</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={handleApplyRental} disabled={isApplying || !applyLocationId || availableLocations.length === 0} className="w-full rounded-xl">
                    {isApplying ? <Loader2 className="animate-spin" /> : "Hantar Permohonan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {myLocations.map((rental) => (
              <Card key={rental.id} className="bg-white border-border/50 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="pb-4 bg-secondary/30 border-b border-border/30">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-foreground font-serif text-xl">{rental.location_name}</CardTitle>
                    <Badge className={cn("capitalize border-none",
                      rental.status === 'active' ? "bg-brand-green/10 text-brand-green" :
                        rental.status === 'pending' ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                    )}>
                      {rental.status}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono">
                    {rental.status === 'active' ? (
                      <>No. Petak: <strong className="text-foreground">{rental.stall_number || "Belum Ditentukan"}</strong></>
                    ) : (
                      <span className="italic">Menunggu Kelulusan</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground font-medium">Jenis Sewa:</span>
                    <Badge variant="outline" className="capitalize">{rental.rate_type === 'khemah' || rental.rate_type === 'cbs' ? 'Mingguan (' + rental.rate_type + ')' : 'Bulanan'}</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">Kadar Semasa:</span>
                    <span className="text-2xl font-bold text-primary">RM {rental.display_price}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {myLocations.length === 0 && (
              <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-border text-muted-foreground">
                <Store className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>Anda belum mempunyai sebarang tapak sewa.</p>
                <Button variant="link" onClick={() => setIsApplyDialogOpen(true)}>Mohon Sekarang</Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payment" className="mt-6">
          <Card className="max-w-xl mx-auto bg-white border-border/50 shadow-sm rounded-[2rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground font-serif">
                <CreditCard className="text-primary" />
                Pembayaran Sewa
              </CardTitle>
              <CardDescription>Hanya untuk lokasi berstatus Aktif</CardDescription>
            </CardHeader>
            <CardContent>
              {activeLocations.length > 0 ? (
                <form onSubmit={handlePayment} className="space-y-6">
                  {/* ... Payment Form (Same as before) ... */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div
                      onClick={() => setPaymentMethod('billplz')}
                      className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'billplz' ? 'bg-brand-blue/5 border-brand-blue ring-1 ring-brand-blue' : 'bg-white hover:bg-secondary/50'}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                        <CreditCard size={18} />
                      </div>
                      <span className="font-bold text-sm">FPX / Online</span>
                    </div>
                    <div
                      onClick={() => setPaymentMethod('manual')}
                      className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'manual' ? 'bg-brand-blue/5 border-brand-blue ring-1 ring-brand-blue' : 'bg-white hover:bg-secondary/50'}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                        <Upload size={18} />
                      </div>
                      <span className="font-bold text-sm">Resit Manual</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Pilih Lokasi</Label>
                    <select
                      className="w-full h-12 px-3 rounded-xl border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      value={selectedLocationId}
                      onChange={handleLocationChange}
                    >
                      {activeLocations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.location_name} ({r.stall_number}) - RM{r.display_price}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Jumlah Bayaran (RM)</Label>
                    <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="h-12 text-lg font-bold rounded-xl" />
                    {paymentMethod === 'billplz' && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        + RM 2.00 Caj Transaksi (Billplz). Jumlah: <span className="font-bold text-primary">RM {(parseFloat(paymentAmount || '0') + 2).toFixed(2)}</span>
                      </p>
                    )}
                  </div>

                  {paymentMethod === 'manual' && (
                    <div className="space-y-2">
                      <Label>Muat Naik Resit</Label>
                      <Input type="file" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} className="h-12 pt-2 rounded-xl bg-secondary/20" />
                    </div>
                  )}

                  <Button disabled={isProcessing} className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-primary/20">
                    {isProcessing ? <Loader2 className="animate-spin" /> : "Bayar Sekarang"}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>Tiada lokasi aktif untuk dibayar. Sila mohon tapak dahulu.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader><CardTitle className="text-foreground font-serif">Rekod Pembayaran</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="pl-6">Tarikh</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Resit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((pay) => (
                    <TableRow key={pay.id}>
                      <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                        {new Date(pay.payment_date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>{pay.remarks || "Bayaran Sewa"}</TableCell>
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
                              ? "bg-brand-green/10 text-brand-green border-brand-green/20"
                              : "bg-orange-50 text-orange-600 border-orange-100",
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
                  {history.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6">Tiada rekod.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div >
  )
}

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
import { CreditCard, Loader2, Upload, FileText, CheckCircle2, AlertCircle, Plus, Store, ExternalLink, Building, Search } from "lucide-react"
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

export function RentalModule({ initialTenant, initialLocations, initialHistory, initialAvailable, initialLinkedOrganizers }: any) {
  const { user } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialize state from Props
  const [loading, setLoading] = useState(false)
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant || null)
  const [myLocations, setMyLocations] = useState<any[]>(initialLocations || [])
  const [availableLocations, setAvailableLocations] = useState<any[]>(initialAvailable || [])
  const [linkedOrganizers, setLinkedOrganizers] = useState<any[]>(initialLinkedOrganizers || [])
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

  // Sync state with props when data is re-fetched
  useEffect(() => {
    if (initialTenant) {
      setTenant(initialTenant)
    }
  }, [initialTenant])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // New Rental Application State
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false)
  const [applyLocationId, setApplyLocationId] = useState("")
  const [isApplying, setIsApplying] = useState(false)

  // Category Selection State
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Record<number, string>>({})

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
      window.location.reload()
    } catch (e: any) {
      toast.error('Gagal kemas kini: ' + e.message)
    } finally {
      setIsUpdatingCategory(false)
    }
  }

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
    // Fetch from tenant_transactions table for tenant's Akaun view
    const { data: txData } = await supabase
      .from('tenant_transactions')
      .select('*, locations:location_id(name)')
      .eq('tenant_id', tenantId)
      .eq('is_rent_payment', true)
      .not('location_id', 'is', null) // Ensure location exists
      .order('date', { ascending: false })

    if (txData) {
      // Map transaction data to the history structure used in UI
      // tenant_transactions stores type as 'expense' for rent payments (tenant's perspective)
      const mappedHistory = txData.map(tx => ({
        id: tx.id,
        payment_date: tx.date,
        remarks: tx.description,
        amount: tx.amount,
        status: tx.status,
        receipt_url: tx.receipt_url,
        category: tx.category,
        type: tx.type, // 'expense' for rent payments
        is_rent_payment: tx.is_rent_payment,
        location_name: tx.locations?.name // Map location name
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
        const loc = item.locations

        // Try to get price based on rate_type
        if (item.rate_type === 'khemah' && loc.rate_khemah > 0) {
          price = loc.rate_khemah
        } else if (item.rate_type === 'cbs' && loc.rate_cbs > 0) {
          price = loc.rate_cbs
        } else if (item.rate_type === 'monthly' && loc.rate_monthly > 0) {
          price = loc.rate_monthly
        } else {
          // Fallback: Use any available rate (prefer monthly > khemah > cbs)
          price = (loc.rate_monthly > 0 ? loc.rate_monthly : 0) ||
            (loc.rate_khemah > 0 ? loc.rate_khemah : 0) ||
            (loc.rate_cbs > 0 ? loc.rate_cbs : 0) || 0
        }

        return {
          ...item,
          display_price: price,
          location_name: loc.name
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
    // tenant_transactions table stores type as 'expense' for rent payments
    // This is already from the tenant's perspective - rent payments are expenses (Cash Out)

    const isExpense = tx.type === 'expense' || tx.is_rent_payment

    if (isExpense) {
      return {
        amountPrefix: "-",
        amountClass: "text-red-500",
        amountValue: tx.amount
      }
    }

    // Income for tenant (e.g., refunds)
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
          // Update status in BOTH transaction tables
          if (pendingRecord.transaction_id) {
            // Try tenant_transactions first (for tenant view)
            const { error: ttError } = await supabase
              .from('tenant_transactions')
              .update({ status: 'approved' })
              .eq('id', pendingRecord.transaction_id)

            // Also try organizer_transactions (for organizer view)
            const { error: otError } = await supabase
              .from('organizer_transactions')
              .update({ status: 'approved' })
              .eq('id', pendingRecord.transaction_id)
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

  // Organizer Confirmation State
  const [pendingOrganizer, setPendingOrganizer] = useState<{ id: number, name: string, email: string, code: string } | null>(null)

  const handleVerifyOrganizer = async () => {
    if (!organizerCodeInput) return
    setIsVerifyingCode(true)
    setPendingOrganizer(null)

    try {
      // 1. Check if code exists
      // Select email as well since user wants to see it
      const { data: org, error: orgError } = await supabase
        .from('organizers')
        .select('id, name, email, organizer_code')
        .eq('organizer_code', organizerCodeInput.toUpperCase())
        .maybeSingle()

      if (orgError || !org) {
        toast.error("Kod Penganjur tidak sah atau tidak dijumpai.")
        setIsVerifyingCode(false)
        return
      }

      // 2. Set pending organizer for confirmation
      setPendingOrganizer({
        id: org.id,
        name: org.name,
        email: org.email || "Tiada Emel",
        code: org.organizer_code
      })
      setIsVerifyingCode(false)

    } catch (e: any) {
      toast.error(e.message)
      setIsVerifyingCode(false)
    }
  }

  const handleConfirmOrganizer = async () => {
    if (!pendingOrganizer || !tenant) return
    setIsVerifyingCode(true)

    try {
      // Use RPC to link (Insert or Update)
      const { data, error: rpcError } = await supabase.rpc('link_tenant_to_organizer', {
        p_tenant_id: tenant.id,
        p_organizer_code: pendingOrganizer.code
      })

      if (rpcError) throw rpcError

      toast.success(`Berjaya dipautkan ke ${pendingOrganizer.name}. Menunggu kelulusan.`)

      // Update local state
      const newLink = {
        link_id: Date.now(), // Temporary ID until refresh
        status: 'pending',
        id: pendingOrganizer.id,
        name: pendingOrganizer.name,
        email: pendingOrganizer.email,
        organizer_code: pendingOrganizer.code
      }

      setLinkedOrganizers(prev => [...prev.filter(o => o.id !== pendingOrganizer.id), newLink])
      setPendingOrganizer(null)
      setOrganizerCodeInput("")

      // Use router.refresh() for a server-side data re-fetch without full reload
      router.refresh()

    } catch (e: any) {
      console.error("Error linking organizer:", e)
      toast.error(e.message || "Gagal memautkan penganjur")
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleApplyRental = async () => {
    // Check if tenant is pending
    if (tenant?.status === 'pending') {
      toast.error("Akaun anda masih dalam semakan Penganjur.")
      return
    }

    if (!tenant || !applyLocationId) return

    setIsApplying(true)
    try {
      const { error } = await supabase.from('tenant_locations').insert({
        tenant_id: tenant.id,
        location_id: parseInt(applyLocationId),
        rate_type: 'monthly', // Placeholder, tenant will choose this later upon approval
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
      setIsApplying(false)
    }
  }

  // Location Search Logic
  const [searchLocationId, setSearchLocationId] = useState("")
  const [searchedLocation, setSearchedLocation] = useState<any>(null)
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)

  const handleSearchLocation = async () => {
    if (!searchLocationId) return
    setIsSearchingLocation(true)
    setSearchedLocation(null)

    try {
      const { data: loc, error } = await supabase
        .from('locations')
        .select('*, organizers(name, organizer_code)')
        .eq('id', searchLocationId)
        .maybeSingle()

      if (error) throw error

      if (loc) {
        setSearchedLocation(loc)
      } else {
        toast.error("Lokasi tidak dijumpai.")
      }

    } catch (e: any) {
      toast.error("Ralat carian: " + e.message)
    } finally {
      setIsSearchingLocation(false)
    }
  }

  const handleApplySearchedLocation = () => {
    // Logic for searched location application
    if (searchedLocation) {
      setApplyLocationId(searchedLocation.id.toString())
      setIsApplyDialogOpen(true)
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tenant || !selectedLocationId) {
      toast.error("Sila pilih lokasi dahulu.")
      return
    }

    setIsProcessing(true)

    try {
      const selectedLoc = myLocations.find(l => l.id.toString() === selectedLocationId)
      const payDate = new Date().toISOString().split('T')[0]
      let receiptUrl = null
      let billRef = ""

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
        const result = await initiatePayment({
          amount: finalAmount,
          description: `Bayaran Sewa: ${selectedLoc?.location_name || 'Uptown'}`,
          redirectPath: '/dashboard?module=rentals&view=history'
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

  if (!isMounted) return null
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
          {/* Main Pending Alert for Tenant Status (Multi-Org aware) */}
          {linkedOrganizers.some(o => o.status === 'pending') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
              <Loader2 className="w-5 h-5 text-amber-600 animate-spin shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-800 text-sm">Menunggu Kelulusan Penganjur</h4>
                <div className="text-xs text-amber-700 mt-1">
                  Anda mempunyai pautan penganjur yang masih dalam semakan.
                  <ul className="list-disc list-inside mt-1 ml-1">
                    {linkedOrganizers.filter(o => o.status === 'pending').map(o => (
                      <li key={o.id}><strong>{o.name}</strong> ({o.organizer_code})</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

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
                  {/* Multi-Organizer Management Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-brand-blue uppercase flex items-center gap-2">
                        <Building className="w-3 h-3" /> Penganjur Saya
                      </Label>
                      {!pendingOrganizer && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => setOrganizerCodeInput(prev => prev ? "" : " ")}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Tambah
                        </Button>
                      )}
                    </div>

                    {/* List Linked Organizers */}
                    {linkedOrganizers.length > 0 && (
                      <div className="space-y-2">
                        {linkedOrganizers.map((org: any) => (
                          <div key={org.id} className="bg-white border rounded-lg p-3 flex justify-between items-center text-sm shadow-sm">
                            <div>
                              <p className="font-bold text-foreground">{org.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{org.organizer_code}</p>
                            </div>
                            <Badge variant={org.status === 'active' || org.status === 'approved' ? 'default' : 'secondary'}
                              className={cn(
                                "text-[10px] uppercase",
                                (org.status === 'active' || org.status === 'approved') ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                              )}
                            >
                              {org.status === 'approved' ? 'Active' : org.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Organizer Input */}
                    {(linkedOrganizers.length === 0 || pendingOrganizer || organizerCodeInput !== "") && (
                      <div className="p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/20 space-y-3 animate-in fade-in slide-in-from-top-2">
                        {pendingOrganizer ? (
                          <div className="bg-white p-3 rounded-lg border border-brand-blue/30 space-y-2 animate-in fade-in zoom-in-95">
                            <div className="text-sm">
                              <p className="font-bold text-foreground">{pendingOrganizer.name}</p>
                              <p className="text-xs text-muted-foreground">{pendingOrganizer.email}</p>
                              <p className="text-xs font-mono bg-slate-100 inline-block px-1 rounded mt-1">{pendingOrganizer.code}</p>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button size="sm" onClick={handleConfirmOrganizer} disabled={isVerifyingCode} className="w-full bg-green-600 hover:bg-green-700 text-white h-8">
                                {isVerifyingCode ? <Loader2 className="animate-spin w-3 h-3" /> : "Sahkan & Pautkan"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setPendingOrganizer(null); setOrganizerCodeInput("") }} disabled={isVerifyingCode} className="h-8">
                                Batal
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label className="text-[10px] text-muted-foreground">Masukkan Kod Penganjur Baru</Label>
                            <div className="flex gap-2">
                              <Input
                                value={organizerCodeInput === " " ? "" : organizerCodeInput}
                                onChange={(e) => setOrganizerCodeInput(e.target.value.toUpperCase())}
                                placeholder="Cth: ORG001"
                                className="bg-white uppercase font-mono"
                              />
                              <Button size="sm" onClick={handleVerifyOrganizer} disabled={isVerifyingCode} className="shrink-0 bg-brand-blue hover:bg-brand-blue/90 text-white">
                                {isVerifyingCode ? <Loader2 className="animate-spin" /> : "Semak"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {availableLocations.length > 0 ? (
                    <>
                      {/* PENDING CHECK - Show if user has pending organizers but NO active ones, or just show informative banner */}
                      {linkedOrganizers.some(o => o.status === 'pending') && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 space-y-2">
                          <div className="flex items-center gap-2 font-bold">
                            <Loader2 className="animate-spin w-4 h-4" />
                            Menunggu Kelulusan
                          </div>
                          <p className="text-sm">
                            Permohonan untuk sesetengah penganjur masih dalam semakan.
                            Anda hanya boleh melihat lokasi dari penganjur yang telah <strong>Aktif</strong>.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Lokasi Pasar</Label>
                        <Select value={applyLocationId} onValueChange={setApplyLocationId}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Pilih lokasi..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLocations.map((loc: any) => (
                              <SelectItem key={loc.id} value={loc.id.toString()}>
                                {loc.name} ({loc.operating_days})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-3 bg-secondary/20 rounded-xl text-xs text-muted-foreground flex gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>Status permohonan akan menjadi "Pending" sehingga diluluskan oleh Admin. Selepas diluluskan, anda boleh memilih kategori sewaan.</p>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">
                      <p className="mb-2 font-medium">Tiada lokasi tersedia.</p>
                      <p className="text-xs">Sila pastikan anda telah memasukkan <strong>Kod Penganjur</strong> yang betul di atas.</p>
                    </div>
                  )}

                  {/* Location Search by ID */}
                  <div className="pt-4 border-t border-border/50 space-y-3">
                    <Label className="text-xs font-bold uppercase flex items-center gap-2">
                      <Search className="w-3 h-3" /> Carian Lokasi (ID)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Masukkan ID Lokasi"
                        value={searchLocationId}
                        onChange={(e) => setSearchLocationId(e.target.value)}
                        className="bg-white"
                      />
                      <Button size="sm" variant="secondary" onClick={handleSearchLocation} disabled={isSearchingLocation}>
                        {isSearchingLocation ? <Loader2 className="animate-spin" /> : "Cari"}
                      </Button>
                    </div>

                    {searchedLocation && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm space-y-1">
                        <p className="font-bold flex justify-between">
                          {searchedLocation.name}
                          <Badge variant="outline">{searchedLocation.status || 'Active'}</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">Penganjur: {searchedLocation.organizers?.name} ({searchedLocation.organizers?.organizer_code})</p>
                        <p className="text-xs">Harga: RM{searchedLocation.rate_monthly || searchedLocation.rate_khemah || '-'}</p>

                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => {
                            setApplyLocationId(searchedLocation.id.toString())
                          }}
                        >
                          Pilih Lokasi Ini
                        </Button>
                      </div>
                    )}
                  </div>
                </div >
                <DialogFooter>
                  <Button onClick={handleApplyRental} disabled={isApplying || !applyLocationId || availableLocations.length === 0} className="w-full rounded-xl">
                    {isApplying ? <Loader2 className="animate-spin" /> : "Hantar Permohonan"}
                  </Button>
                </DialogFooter>
              </DialogContent >
            </Dialog >
          </div >

          <div className="grid gap-6 md:grid-cols-2">
            {myLocations.map((rental) => (
              <Card key={rental.id} className="bg-white border-border/50 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="pb-4 bg-secondary/30 border-b border-border/30">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-foreground font-serif text-xl">{rental.location_name}</CardTitle>
                    <Badge className={cn("capitalize border-none",
                      rental.status === 'active' ? "bg-brand-green/10 text-brand-green" :
                        rental.status === 'approved' ? "bg-brand-green hover:bg-brand-green/90 text-white" :
                          rental.status === 'pending' ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                    )}>
                      {rental.status === 'approved' ? 'Tindakan Diperlukan' : rental.status}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono">
                    {rental.status === 'active' ? (
                      <>No. Petak: <strong className="text-foreground">{rental.stall_number || "Belum Ditentukan"}</strong></>
                    ) : rental.status === 'approved' ? (
                      <span className="italic text-brand-green">Sila pilih kategori</span>
                    ) : (
                      <span className="italic">Menunggu Kelulusan</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {rental.status === 'approved' ? (
                    <div className="space-y-3 bg-brand-green/5 p-4 rounded-xl border border-brand-green/20">
                      <div className="flex items-center gap-2 text-brand-green">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <p className="font-bold text-sm">Permohonan Diluluskan!</p>
                      </div>
                      <p className="text-xs text-muted-foreground pb-1">Sila pilih kategori sewaan untuk meneruskan dan mengaktifkan tapak ini.</p>

                      <div className="flex flex-col gap-2">
                        <Select
                          value={selectedCategory[rental.id] || "monthly"}
                          onValueChange={(val) => setSelectedCategory(prev => ({ ...prev, [rental.id]: val }))}
                        >
                          <SelectTrigger className="w-full h-10 bg-white">
                            <SelectValue placeholder="Pilih Kategori" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                            <SelectItem value="khemah">Mingguan (Khemah)</SelectItem>
                            <SelectItem value="cbs">Mingguan (CBS/Lori)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button className="w-full bg-brand-green hover:bg-brand-green/90 text-white shadow-sm" onClick={() => handleUpdateCategory(rental.id)} disabled={isUpdatingCategory}>
                          {isUpdatingCategory ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Sempurnakan & Aktifkan"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-sm mb-2 mt-2">
                        <span className="text-muted-foreground font-medium">Jenis Sewa:</span>
                        <Badge variant="outline" className="capitalize">{rental.rate_type === 'khemah' || rental.rate_type === 'cbs' ? 'Mingguan (' + rental.rate_type + ')' : 'Bulanan'}</Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Kadar Semasa:</span>
                        <span className="text-2xl font-bold text-primary">RM {rental.display_price}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
            {myLocations.length === 0 && availableLocations.length > 0 && (
              <div className="col-span-2 space-y-4">
                <div className="bg-blue-50 border-blue-100 border p-4 rounded-2xl flex gap-3 items-start">
                  <Store className="w-5 h-5 text-brand-blue mt-1 shrink-0" />
                  <div>
                    <h4 className="font-bold text-brand-blue text-sm">Lokasi Tersedia</h4>
                    <p className="text-xs text-muted-foreground">Senarai tapak yang boleh dipohon dari penganjur anda.</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {availableLocations.map((loc) => (
                    <Card key={loc.id} className="bg-white border-border/50 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all">
                      <CardHeader className="pb-3 bg-secondary/10">
                        <CardTitle className="text-base font-bold">{loc.name}</CardTitle>
                        <CardDescription className="text-xs">{loc.program_name}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4 text-sm space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Operasi:</span>
                          <span className="font-medium">{loc.operating_days}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Kadar Bermula:</span>
                          <span className="text-lg font-bold text-primary">RM {loc.display_price}</span>
                        </div>
                        <Button className="w-full rounded-xl mt-2" size="sm" onClick={() => {
                          setApplyLocationId(loc.id.toString())
                          setIsApplyDialogOpen(true)
                        }}>
                          Mohon Tapak Ini
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {myLocations.length === 0 && availableLocations.length === 0 && (
              <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-border text-muted-foreground">
                <Store className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>Anda belum mempunyai sebarang tapak sewa.</p>
                {tenant?.organizer_code ? (
                  <p className="text-sm mt-1">Tiada lokasi tersedia dari penganjur ini.</p>
                ) : (
                  <Button variant="link" onClick={() => setIsApplyDialogOpen(true)}>Mohon Sekarang</Button>
                )}
              </div>
            )}
          </div>
        </TabsContent >

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
                    <TableHead>Lokasi</TableHead>
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
      </Tabs >
    </div >
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, MapPin, User, Store, CreditCard, ArrowRight, Building, Calendar, CheckCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { initiatePayment } from "@/actions/payment"
import { createPublicPaymentTransaction } from "@/actions/public-payment"
import { cn } from "@/lib/utils"

interface LocationWithOrganizer {
    id: number
    name: string
    type: 'daily' | 'monthly'
    program_name: string
    operating_days: string
    days_per_week: number
    total_lots: number
    rate_khemah: number
    rate_cbs: number
    rate_monthly: number
    rate_monthly_khemah: number
    rate_monthly_cbs: number
    organizer_id: string
    organizer_name: string
    organizer_code: string
}

// Cache locations data to avoid repeated fetching
let cachedLocations: LocationWithOrganizer[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

// Helper to add timeout to Supabase queries
async function withTimeout<T>(
    queryFn: () => any,
    ms: number,
    context: string
): Promise<T> {
    return Promise.race([
        Promise.resolve(queryFn()),
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${context} exceeded ${ms}ms`)), ms)
        )
    ])
}

export default function PublicPaymentPage() {
    const supabase = createClient()

    // Form states
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [loading, setLoading] = useState(false)
    const [fetchingLocations, setFetchingLocations] = useState(true)
    const [locationsError, setLocationsError] = useState<string | null>(null)
    const [locations, setLocations] = useState<LocationWithOrganizer[]>([])

    // Selected values
    const [selectedLocation, setSelectedLocation] = useState<LocationWithOrganizer | null>(null)
    const [selectedRateType, setSelectedRateType] = useState<"khemah" | "cbs" | "monthly_khemah" | "monthly_cbs" | "monthly">("khemah")

    // User details
    const [fullName, setFullName] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [email, setEmail] = useState("")
    const [businessName, setBusinessName] = useState("")
    const [stallNumber, setStallNumber] = useState("")

    // Fetch all locations with organizer details on mount
    const fetchLocations = useCallback(async (forceRefresh = false) => {
        // Check cache first
        const now = Date.now();
        if (!forceRefresh && cachedLocations && (now - cacheTimestamp) < CACHE_TTL) {
            setLocations(cachedLocations)
            setFetchingLocations(false)
            return
        }

        setFetchingLocations(true)
        setLocationsError(null)

        try {
            // Get all active organizers first (excluding ORG001) - with 3 second timeout
            const orgResult: any = await withTimeout(
                () => supabase
                    .from('organizers')
                    .select('id, name, organizer_code')
                    .eq('status', 'active')
                    .neq('organizer_code', 'ORG001'),
                3000,
                'fetchOrganizers'
            )

            if (orgResult.error) throw orgResult.error

            const organizers = orgResult.data || []

            if (organizers.length === 0) {
                setLocations([])
                cachedLocations = []
                cacheTimestamp = Date.now()
                return
            }

            // Get all active locations for these organizers - with 3 second timeout
            const organizerIds = organizers.map((o: any) => o.id)
            const locResult: any = await withTimeout(
                () => supabase
                    .from('locations')
                    .select('*')
                    .in('organizer_id', organizerIds)
                    .eq('status', 'active')
                    .order('name'),
                3000,
                'fetchLocations'
            )

            if (locResult.error) throw locResult.error

            const locationsData = locResult.data || []

            // Combine location with organizer info
            const combined: LocationWithOrganizer[] = locationsData.map((loc: any) => {
                const org = organizers.find((o: any) => o.id === loc.organizer_id)
                return {
                    ...loc,
                    organizer_name: org?.name || 'Unknown',
                    organizer_code: org?.organizer_code || '-'
                }
            })

            // Update cache
            cachedLocations = combined
            cacheTimestamp = Date.now()

            setLocations(combined)
        } catch (error: any) {
            console.error('Error fetching locations:', error)
            const errorMsg = error.message?.includes('Timeout')
                ? 'Sambungan lambat. Sila cuba lagi.'
                : 'Gagal memuatkan senarai lokasi'
            setLocationsError(errorMsg)
            // Use cached data if available even if expired
            if (cachedLocations) {
                setLocations(cachedLocations)
                toast.info('Menggunakan data cache')
            }
        } finally {
            setFetchingLocations(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchLocations()
    }, [fetchLocations])

    const calculateAmount = () => {
        if (!selectedLocation) return 0

        switch (selectedRateType) {
            case 'khemah':
                return (selectedLocation.rate_khemah || 0) * 4
            case 'cbs':
                return (selectedLocation.rate_cbs || 0) * 4
            case 'monthly_khemah':
                return selectedLocation.rate_monthly_khemah || selectedLocation.rate_monthly || 0
            case 'monthly_cbs':
                return selectedLocation.rate_monthly_cbs || selectedLocation.rate_monthly || 0
            case 'monthly':
                return selectedLocation.rate_monthly || 0
            default:
                return 0
        }
    }

    const handleLocationSelect = (location: LocationWithOrganizer) => {
        setSelectedLocation(location)
        // Reset rate type based on location type
        if (location.type === 'daily') {
            setSelectedRateType('khemah')
        } else {
            setSelectedRateType('monthly')
        }
    }

    const handleProceedToPayment = () => {
        if (!fullName || !phoneNumber || !selectedLocation) {
            toast.error("Sila lengkapkan semua maklumat wajib")
            return
        }
        setStep(3)
    }

    const handlePayment = async () => {
        if (!selectedLocation) return

        setLoading(true)
        try {
            const amount = calculateAmount()
            if (amount <= 0) {
                throw new Error("Amaun tidak sah")
            }

            // Create pending transaction via server action (bypasses RLS)
            const txResult = await createPublicPaymentTransaction({
                description: `Bayaran Sewa - ${selectedLocation.name} (${selectedRateType})`,
                amount: amount,
                organizer_id: selectedLocation.organizer_id,
                location_id: selectedLocation.id,
                metadata: {
                    payer_name: fullName,
                    payer_phone: phoneNumber,
                    payer_email: email,
                    business_name: businessName,
                    stall_number: stallNumber,
                    organizer_id: selectedLocation.organizer_id,
                    organizer_code: selectedLocation.organizer_code,
                    location_id: selectedLocation.id,
                    location_name: selectedLocation.name,
                    rate_type: selectedRateType,
                    is_public_payment: true,
                    payment_method: 'online'
                }
            })

            if (!txResult.success || !txResult.transaction) {
                throw new Error(txResult.error || 'Transaksi tidak dapat dicipta')
            }

            const transaction = txResult.transaction

            // Initiate payment - with timeout
            // Pass transaction details for public payment flow
            const result: any = await withTimeout(
                () => initiatePayment({
                    amount,
                    description: `Bayaran Sewa - ${selectedLocation.name} (${selectedRateType})`,
                    redirectPath: `/bayar/status?tx=${transaction.id}`,
                    transactionId: transaction.id,
                    payerEmail: email,
                    payerName: fullName
                }),
                10000,
                'initiatePayment'
            )

            if (result.error) {
                throw new Error(result.error)
            }

            if (result.url) {
                // Redirect to payment gateway
                window.location.href = result.url
            }
        } catch (error: any) {
            const errorMsg = error.message?.includes('Timeout')
                ? 'Sambungan lambat. Sila cuba lagi.'
                : error.message
            toast.error("Ralat pembayaran: " + errorMsg)
            setLoading(false)
        }
    }

    // Render step 1: Select Location (with organizer info shown)
    const renderStep1 = () => {
        if (fetchingLocations) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Memuatkan senarai lokasi...</p>
                    <p className="text-xs text-muted-foreground mt-2">(Ini mungkin mengambil masa beberapa saat)</p>
                </div>
            )
        }

        // Show error with retry button
        if (locationsError && locations.length === 0) {
            return (
                <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-600 font-medium mb-4">{locationsError}</p>
                    <Button
                        onClick={() => fetchLocations(true)}
                        variant="outline"
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Cuba Lagi
                    </Button>
                </div>
            )
        }

        if (locations.length === 0) {
            return (
                <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Tiada lokasi tersedia buat masa ini.</p>
                    <Button
                        onClick={() => fetchLocations(true)}
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Muat Semula
                    </Button>
                </div>
            )
        }

        return (
            <div className="space-y-6">
                {/* If location selected, show details */}
                {selectedLocation && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-bold">{selectedLocation.name}</h3>
                                {selectedLocation.program_name && (
                                    <p className="text-sm text-primary font-medium">{selectedLocation.program_name}</p>
                                )}
                            </div>
                            <Badge variant={selectedLocation.type === 'daily' ? 'secondary' : 'default'}>
                                {selectedLocation.type === 'daily' ? 'Mingguan' : 'Bulanan'}
                            </Badge>
                        </div>

                        {/* Organizer Info */}
                        <div className="flex items-center gap-2 text-sm bg-white p-3 rounded-lg">
                            <Building className="w-4 h-4 text-primary" />
                            <span className="font-medium">{selectedLocation.organizer_name}</span>
                            <span className="text-muted-foreground">({selectedLocation.organizer_code})</span>
                        </div>

                        {/* Location Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>{selectedLocation.operating_days || 'Tiada maklumat'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span>{selectedLocation.days_per_week} hari/minggu</span>
                            </div>
                        </div>

                        {/* Rate Selection */}
                        <div className="pt-4 border-t">
                            <Label className="mb-3 block">Pilih Jenis Sewaan <span className="text-red-500">*</span></Label>
                            {selectedLocation.type === 'daily' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        type="button"
                                        variant={selectedRateType === 'khemah' ? 'default' : 'outline'}
                                        onClick={() => setSelectedRateType('khemah')}
                                        className="h-auto py-3 flex flex-col items-center"
                                    >
                                        <span className="font-bold">Khemah</span>
                                        <span className="text-xs opacity-80">RM {selectedLocation.rate_khemah}/minggu</span>
                                        <span className="text-[10px]">~RM {(selectedLocation.rate_khemah * 4).toFixed(0)}/bulan</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={selectedRateType === 'cbs' ? 'default' : 'outline'}
                                        onClick={() => setSelectedRateType('cbs')}
                                        className="h-auto py-3 flex flex-col items-center"
                                    >
                                        <span className="font-bold">CBS</span>
                                        <span className="text-xs opacity-80">RM {selectedLocation.rate_cbs}/minggu</span>
                                        <span className="text-[10px]">~RM {(selectedLocation.rate_cbs * 4).toFixed(0)}/bulan</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    <Button
                                        type="button"
                                        variant={selectedRateType === 'monthly_khemah' ? 'default' : 'outline'}
                                        onClick={() => setSelectedRateType('monthly_khemah')}
                                        className="h-auto py-3 flex flex-col items-center"
                                    >
                                        <span className="font-bold">Khemah</span>
                                        <span className="text-xs">RM {selectedLocation.rate_monthly_khemah || selectedLocation.rate_monthly}/bln</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={selectedRateType === 'monthly_cbs' ? 'default' : 'outline'}
                                        onClick={() => setSelectedRateType('monthly_cbs')}
                                        className="h-auto py-3 flex flex-col items-center"
                                    >
                                        <span className="font-bold">CBS</span>
                                        <span className="text-xs">RM {selectedLocation.rate_monthly_cbs || selectedLocation.rate_monthly}/bln</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={selectedRateType === 'monthly' ? 'default' : 'outline'}
                                        onClick={() => setSelectedRateType('monthly')}
                                        className="h-auto py-3 flex flex-col items-center"
                                    >
                                        <span className="font-bold">Standard</span>
                                        <span className="text-xs">RM {selectedLocation.rate_monthly}/bln</span>
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Change Selection Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLocation(null)}
                            className="w-full"
                        >
                            Pilih Lokasi Lain
                        </Button>
                    </div>
                )}

                {/* Location Grid - only show if no location selected */}
                {!selectedLocation && (
                    <>
                        <p className="text-sm text-muted-foreground mb-4">
                            Sila pilih lokasi tapak yang anda ingin sewa:
                        </p>
                        <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
                            {locations.map((loc: LocationWithOrganizer) => (
                                <Card
                                    key={loc.id}
                                    className="cursor-pointer hover:border-primary transition-all"
                                    onClick={() => handleLocationSelect(loc)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                {loc.program_name && (
                                                    <p className="text-sm font-medium text-primary mb-1 uppercase tracking-wider">{loc.program_name}</p>
                                                )}
                                                <CardTitle className="text-lg">{loc.name}</CardTitle>
                                            </div>
                                            <Badge variant={loc.type === 'daily' ? 'secondary' : 'default'}>
                                                {loc.type === 'daily' ? 'Mingguan' : 'Bulanan'}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="flex items-center gap-2 text-sm mb-3">
                                            <Building className="w-4 h-4 text-primary" />
                                            <span className="font-medium">{loc.organizer_name}</span>
                                            <span className="text-muted-foreground">({loc.organizer_code})</span>
                                        </div>

                                        {/* Quick rate preview */}
                                        <div className="flex gap-2 text-xs">
                                            {loc.type === 'daily' ? (
                                                <>
                                                    <span className="bg-secondary px-2 py-1 rounded">
                                                        Khemah: RM {loc.rate_khemah}/minggu
                                                    </span>
                                                    <span className="bg-secondary px-2 py-1 rounded">
                                                        CBS: RM {loc.rate_cbs}/minggu
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    {loc.rate_monthly_khemah > 0 && (
                                                        <span className="bg-secondary px-2 py-1 rounded">
                                                            Khemah: RM {loc.rate_monthly_khemah}
                                                        </span>
                                                    )}
                                                    {loc.rate_monthly_cbs > 0 && (
                                                        <span className="bg-secondary px-2 py-1 rounded">
                                                            CBS: RM {loc.rate_monthly_cbs}
                                                        </span>
                                                    )}
                                                    {(!loc.rate_monthly_khemah || loc.rate_monthly_khemah <= 0) && (!loc.rate_monthly_cbs || loc.rate_monthly_cbs <= 0) && (
                                                        <span className="bg-secondary px-2 py-1 rounded">
                                                            Bulanan (Standard): RM {loc.rate_monthly}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full text-primary"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleLocationSelect(loc)
                                            }}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Pilih Lokasi Ini
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </>
                )}

                {/* Next Button */}
                <Button
                    onClick={() => setStep(2)}
                    disabled={!selectedLocation}
                    className="w-full h-12"
                >
                    Seterusnya <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        )
    }

    // Render step 2: Personal Details
    const renderStep2 = () => (
        <div className="space-y-6">
            {/* Summary of selected location */}
            {selectedLocation && (
                <div className="bg-muted p-4 rounded-lg text-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-medium">{selectedLocation.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Building className="w-4 h-4" />
                        <span>{selectedLocation.organizer_name}</span>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <Label>Nama Penuh <span className="text-red-500">*</span></Label>
                <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Ahmad bin Abdullah"
                    className="h-12"
                />
            </div>

            <div className="space-y-2">
                <Label>Nombor Telefon <span className="text-red-500">*</span></Label>
                <Input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Contoh: 012-3456789"
                    className="h-12"
                />
            </div>

            <div className="space-y-2">
                <Label>Email (pilihan)</Label>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: ahmad@email.com"
                    className="h-12"
                />
            </div>

            <div className="space-y-2">
                <Label>Nama Perniagaan</Label>
                <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Contoh: Kedai Runcit Ahmad"
                    className="h-12"
                />
            </div>

            <div className="space-y-2">
                <Label>Nombor Petak/Gerai</Label>
                <Input
                    value={stallNumber}
                    onChange={(e) => setStallNumber(e.target.value)}
                    placeholder="Contoh: A12"
                    className="h-12"
                />
            </div>

            <div className="flex gap-4">
                <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 h-12"
                >
                    Kembali
                </Button>
                <Button
                    onClick={handleProceedToPayment}
                    disabled={!fullName || !phoneNumber}
                    className="flex-1 h-12"
                >
                    Seterusnya <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    )

    // Render step 3: Payment Confirmation
    const renderStep3 = () => {
        const amount = calculateAmount()
        return (
            <div className="space-y-6">
                <div className="bg-muted p-6 rounded-lg space-y-4">
                    <h3 className="font-bold text-lg">Ringkasan Pembayaran</h3>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Lokasi:</span>
                            <span className="font-medium">{selectedLocation?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Penganjur:</span>
                            <span className="font-medium">{selectedLocation?.organizer_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Jenis:</span>
                            <span className="font-medium capitalize">{selectedRateType.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Nama:</span>
                            <span className="font-medium">{fullName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Telefon:</span>
                            <span className="font-medium">{phoneNumber}</span>
                        </div>
                        {businessName && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Perniagaan:</span>
                                <span className="font-medium">{businessName}</span>
                            </div>
                        )}
                        {stallNumber && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">No. Petak:</span>
                                <span className="font-medium">{stallNumber}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">Jumlah Bayaran:</span>
                            <span className="text-2xl font-bold text-primary">RM {amount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        onClick={() => setStep(2)}
                        disabled={loading}
                        className="flex-1 h-12"
                    >
                        Kembali
                    </Button>
                    <Button
                        onClick={handlePayment}
                        disabled={loading}
                        className={`flex-1 h-12 relative overflow-hidden ${loading ? 'pointer-events-none opacity-80' : ''}`}
                    >
                        {loading ? (
                            <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Memproses...</>
                        ) : (
                            <><CreditCard className="mr-2 w-4 h-4" /> Bayar Sekarang</>
                        )}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-secondary/30 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
                        Bayaran Sewa Tapak
                    </h1>
                    <p className="text-muted-foreground">
                        Bayaran sewa tapak tanpa perlu mendaftar akaun
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            1
                        </div>
                        <div className={`w-16 h-1 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            2
                        </div>
                        <div className={`w-16 h-1 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            3
                        </div>
                    </div>
                </div>

                {/* Step Labels */}
                <div className="flex justify-center gap-8 mb-8 text-sm">
                    <span className={step >= 1 ? 'text-primary font-medium' : 'text-muted-foreground'}>Pilih Lokasi</span>
                    <span className={step >= 2 ? 'text-primary font-medium' : 'text-muted-foreground'}>Maklumat</span>
                    <span className={step >= 3 ? 'text-primary font-medium' : 'text-muted-foreground'}>Bayar</span>
                </div>

                {/* Main Card */}
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-serif">
                            {step === 1 && "Pilih Lokasi Tapak"}
                            {step === 2 && "Maklumat Peribadi"}
                            {step === 3 && "Pengesahan Pembayaran"}
                        </CardTitle>
                        <CardDescription>
                            {step === 1 && "Pilih lokasi tapak yang anda ingin sewa"}
                            {step === 2 && "Masukkan maklumat peribadi anda"}
                            {step === 3 && "Sahkan butiran pembayaran anda"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center text-sm text-muted-foreground mt-8">
                    Dikuasakan oleh Permit Akaun
                </p>
            </div>
        </div>
    )
}

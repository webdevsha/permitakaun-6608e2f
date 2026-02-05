"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MapPin, User, Store, CreditCard, CheckCircle, XCircle, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { initiatePayment } from "@/actions/payment"

interface Organizer {
    id: string
    name: string
    organizer_code: string
}

interface Location {
    id: number
    name: string
    type: 'daily' | 'monthly'
    rate_khemah: number
    rate_cbs: number
    rate_monthly: number
    rate_monthly_khemah: number
    rate_monthly_cbs: number
    organizer_id: string
}

export default function PublicPaymentPage() {
    const supabase = createClient()
    
    // Form states
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [loading, setLoading] = useState(false)
    const [organizers, setOrganizers] = useState<Organizer[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    
    // Selected values
    const [selectedOrganizer, setSelectedOrganizer] = useState<string>("")
    const [selectedLocation, setSelectedLocation] = useState<string>("")
    const [selectedRateType, setSelectedRateType] = useState<"khemah" | "cbs" | "monthly_khemah" | "monthly_cbs" | "monthly">("khemah")
    
    // User details
    const [fullName, setFullName] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [email, setEmail] = useState("")
    const [businessName, setBusinessName] = useState("")
    const [stallNumber, setStallNumber] = useState("")

    // Fetch organizers on mount
    useEffect(() => {
        const fetchOrganizers = async () => {
            const { data } = await supabase
                .from('organizers')
                .select('id, name, organizer_code')
                .eq('status', 'active')
                .order('name')
            
            if (data) {
                // Filter out ORG001 (seed data)
                setOrganizers(data.filter(o => o.organizer_code !== 'ORG001'))
            }
        }
        fetchOrganizers()
    }, [supabase])

    // Fetch locations when organizer is selected
    useEffect(() => {
        if (!selectedOrganizer) {
            setLocations([])
            return
        }
        
        const fetchLocations = async () => {
            const { data } = await supabase
                .from('locations')
                .select('*')
                .eq('organizer_id', selectedOrganizer)
                .eq('status', 'active')
                .order('name')
            
            if (data) {
                setLocations(data)
            }
        }
        fetchLocations()
    }, [selectedOrganizer, supabase])

    const selectedLocationData = locations.find(l => l.id.toString() === selectedLocation)
    const selectedOrganizerData = organizers.find(o => o.id === selectedOrganizer)

    const calculateAmount = () => {
        if (!selectedLocationData) return 0
        
        switch (selectedRateType) {
            case 'khemah':
                return (selectedLocationData.rate_khemah || 0) * 4
            case 'cbs':
                return (selectedLocationData.rate_cbs || 0) * 4
            case 'monthly_khemah':
                return selectedLocationData.rate_monthly_khemah || selectedLocationData.rate_monthly || 0
            case 'monthly_cbs':
                return selectedLocationData.rate_monthly_cbs || selectedLocationData.rate_monthly || 0
            case 'monthly':
                return selectedLocationData.rate_monthly || 0
            default:
                return 0
        }
    }

    const handleProceedToPayment = () => {
        if (!fullName || !phoneNumber || !selectedOrganizer || !selectedLocation) {
            toast.error("Sila lengkapkan semua maklumat wajib")
            return
        }
        setStep(3)
    }

    const handlePayment = async () => {
        setLoading(true)
        try {
            const amount = calculateAmount()
            if (amount <= 0) {
                throw new Error("Amaun tidak sah")
            }

            // First, create a pending transaction record
            const { data: transaction, error: txError } = await supabase
                .from('transactions')
                .insert({
                    description: `Bayaran Sewa - ${selectedLocationData?.name} (${selectedRateType})`,
                    amount: amount,
                    type: 'income',
                    category: 'Sewa',
                    status: 'pending',
                    date: new Date().toISOString().split('T')[0],
                    payment_method: 'online',
                    // Store payer info in a JSON field or reference
                    metadata: {
                        payer_name: fullName,
                        payer_phone: phoneNumber,
                        payer_email: email,
                        business_name: businessName,
                        stall_number: stallNumber,
                        organizer_id: selectedOrganizer,
                        organizer_code: selectedOrganizerData?.organizer_code,
                        location_id: selectedLocation,
                        location_name: selectedLocationData?.name,
                        rate_type: selectedRateType,
                        is_public_payment: true
                    }
                })
                .select()
                .single()

            if (txError) throw txError

            const result = await initiatePayment({
                amount,
                description: `Bayaran Sewa - ${selectedLocationData?.name} (${selectedRateType})`,
                redirectPath: `/bayar/status?tx=${transaction.id}`
            })

            if (result.error) {
                throw new Error(result.error)
            }

            if (result.url) {
                // Redirect to payment gateway
                window.location.href = result.url
            }
        } catch (error: any) {
            toast.error("Ralat pembayaran: " + error.message)
            setLoading(false)
        }
    }

    // Render step 1: Select Organizer & Location
    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label>Pilih Penganjur <span className="text-red-500">*</span></Label>
                <Select value={selectedOrganizer} onValueChange={setSelectedOrganizer}>
                    <SelectTrigger className="h-12">
                        <SelectValue placeholder="Pilih penganjur..." />
                    </SelectTrigger>
                    <SelectContent>
                        {organizers.map(org => (
                            <SelectItem key={org.id} value={org.id}>
                                {org.name} ({org.organizer_code})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedOrganizer && (
                <div className="space-y-2">
                    <Label>Pilih Lokasi <span className="text-red-500">*</span></Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger className="h-12">
                            <SelectValue placeholder="Pilih lokasi..." />
                        </SelectTrigger>
                        <SelectContent>
                            {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id.toString()}>
                                    {loc.name} ({loc.type === 'daily' ? 'Mingguan' : 'Bulanan'})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {selectedLocationData && (
                <div className="space-y-4 pt-4 border-t">
                    <Label>Pilih Jenis Sewaan <span className="text-red-500">*</span></Label>
                    {selectedLocationData.type === 'daily' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                type="button"
                                variant={selectedRateType === 'khemah' ? 'default' : 'outline'}
                                onClick={() => setSelectedRateType('khemah')}
                                className="h-auto py-4 flex flex-col items-center"
                            >
                                <span className="font-bold">Khemah</span>
                                <span className="text-sm opacity-80">RM {selectedLocationData.rate_khemah}/minggu</span>
                                <span className="text-xs">~RM {(selectedLocationData.rate_khemah * 4).toFixed(0)}/bulan</span>
                            </Button>
                            <Button
                                type="button"
                                variant={selectedRateType === 'cbs' ? 'default' : 'outline'}
                                onClick={() => setSelectedRateType('cbs')}
                                className="h-auto py-4 flex flex-col items-center"
                            >
                                <span className="font-bold">CBS/Lori</span>
                                <span className="text-sm opacity-80">RM {selectedLocationData.rate_cbs}/minggu</span>
                                <span className="text-xs">~RM {(selectedLocationData.rate_cbs * 4).toFixed(0)}/bulan</span>
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4">
                            <Button
                                type="button"
                                variant={selectedRateType === 'monthly_khemah' ? 'default' : 'outline'}
                                onClick={() => setSelectedRateType('monthly_khemah')}
                                className="h-auto py-4 flex flex-col items-center"
                            >
                                <span className="font-bold">Khemah</span>
                                <span className="text-sm">RM {selectedLocationData.rate_monthly_khemah || selectedLocationData.rate_monthly}/bulan</span>
                            </Button>
                            <Button
                                type="button"
                                variant={selectedRateType === 'monthly_cbs' ? 'default' : 'outline'}
                                onClick={() => setSelectedRateType('monthly_cbs')}
                                className="h-auto py-4 flex flex-col items-center"
                            >
                                <span className="font-bold">CBS/Lori</span>
                                <span className="text-sm">RM {selectedLocationData.rate_monthly_cbs || selectedLocationData.rate_monthly}/bulan</span>
                            </Button>
                            <Button
                                type="button"
                                variant={selectedRateType === 'monthly' ? 'default' : 'outline'}
                                onClick={() => setSelectedRateType('monthly')}
                                className="h-auto py-4 flex flex-col items-center"
                            >
                                <span className="font-bold">Standard</span>
                                <span className="text-sm">RM {selectedLocationData.rate_monthly}/bulan</span>
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <Button 
                onClick={() => setStep(2)} 
                disabled={!selectedOrganizer || !selectedLocation}
                className="w-full h-12"
            >
                Seterusnya <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
        </div>
    )

    // Render step 2: Personal Details
    const renderStep2 = () => (
        <div className="space-y-6">
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
                            <span className="text-muted-foreground">Penganjur:</span>
                            <span className="font-medium">{selectedOrganizerData?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Lokasi:</span>
                            <span className="font-medium">{selectedLocationData?.name}</span>
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
                        className="flex-1 h-12"
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
                            {step === 1 && "Pilih Penganjur & Lokasi"}
                            {step === 2 && "Maklumat Peribadi"}
                            {step === 3 && "Pengesahan Pembayaran"}
                        </CardTitle>
                        <CardDescription>
                            {step === 1 && "Pilih penganjur dan lokasi tapak yang anda sewa"}
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

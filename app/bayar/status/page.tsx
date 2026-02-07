"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, Receipt, Store, MapPin, User, Phone, Calendar } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { ms } from "date-fns/locale"

interface TransactionData {
    id: number
    description: string
    amount: number
    status: string
    date: string
    payment_reference?: string
    metadata: {
        payer_name: string
        payer_phone: string
        payer_email?: string
        business_name?: string
        stall_number?: string
        organizer_id: string
        organizer_code: string
        location_id: string
        location_name: string
        rate_type: string
        is_public_payment: boolean
    }
    organizers?: {
        name: string
        organizer_code: string
    }
}

function PaymentStatusContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [transaction, setTransaction] = useState<TransactionData | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Get all params
    const txId = searchParams.get('tx')
    const billplzId = searchParams.get('billplz[id]')
    const billplzPaid = searchParams.get('billplz[paid]')
    const billplzAmount = searchParams.get('billplz[amount]')
    const isPaymentSuccessful = billplzPaid === 'true'

    useEffect(() => {
        // If payment is successful, redirect to success page immediately
        if (isPaymentSuccessful) {
            console.log('[Bayar Status] Payment successful, redirecting to success page')
            const amount = billplzAmount ? (parseInt(billplzAmount) / 100).toFixed(2) : ''
            router.replace(`/bayar/success?ref=${billplzId || txId}&amount=${amount}`)
            return
        }

        const fetchTransaction = async () => {
            if (!txId) {
                setError("ID transaksi tidak dijumpai")
                setLoading(false)
                return
            }

            try {
                let data: any = null
                
                // Try lookup strategies
                for (let attempt = 0; attempt < 3; attempt++) {
                    console.log(`[Bayar Status] Lookup attempt ${attempt + 1} for txId:`, txId)
                    
                    // Strategy 1: Lookup by Supabase ID
                    let result = await supabase
                        .from('organizer_transactions')
                        .select(`*, organizers:organizer_id (name, organizer_code)`)
                        .eq('id', txId)
                        .maybeSingle()
                    
                    if (result.data) {
                        data = result.data
                        console.log('[Bayar Status] Found by ID:', data.id)
                        break
                    }
                    
                    // Strategy 2: Lookup by Billplz ID
                    if (billplzId) {
                        result = await supabase
                            .from('organizer_transactions')
                            .select(`*, organizers:organizer_id (name, organizer_code)`)
                            .eq('payment_reference', billplzId)
                            .maybeSingle()
                        
                        if (result.data) {
                            data = result.data
                            console.log('[Bayar Status] Found by Billplz ID:', data.id)
                            break
                        }
                    }
                    
                    // Wait before retry
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 1000))
                    }
                }

                if (!data) {
                    console.error('[Bayar Status] Transaction not found')
                    setError("Transaksi tidak dijumpai. Sila semak dengan penganjur.")
                    setLoading(false)
                    return
                }

                setTransaction(data)
            } catch (err: any) {
                console.error('[Bayar Status] Error:', err)
                setError(err.message || "Ralat tidak diketahui")
            } finally {
                setLoading(false)
            }
        }

        fetchTransaction()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Memuatkan status pembayaran...</p>
                </div>
            </div>
        )
    }

    if (error || !transaction) {
        return (
            <div className="min-h-screen bg-secondary/30 py-8 px-4">
                <div className="max-w-lg mx-auto">
                    <Card className="shadow-lg border-red-200">
                        <CardHeader className="text-center">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <XCircle className="w-12 h-12 text-red-600" />
                            </div>
                            <CardTitle className="text-2xl font-serif text-red-800">
                                Ralat
                            </CardTitle>
                            <CardDescription>
                                {error || "Transaksi tidak dijumpai"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/bayar">
                                <Button className="w-full">
                                    Cuba Lagi
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    // Show transaction details for pending/failed payments
    const metadata = transaction.metadata || {}

    return (
        <div className="min-h-screen bg-secondary/30 py-8 px-4">
            <div className="max-w-lg mx-auto">
                <Card className={`shadow-lg ${transaction.status === 'completed' ? 'border-green-200' : 'border-red-200'}`}>
                    <CardHeader className="text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${transaction.status === 'completed' ? 'bg-green-100' : 'bg-red-100'}`}>
                            {transaction.status === 'completed' ? (
                                <CheckCircle className="w-12 h-12 text-green-600" />
                            ) : (
                                <XCircle className="w-12 h-12 text-red-600" />
                            )}
                        </div>
                        <CardTitle className={`text-2xl font-serif ${transaction.status === 'completed' ? 'text-green-800' : 'text-red-800'}`}>
                            {transaction.status === 'completed' ? 'Pembayaran Berjaya!' : 'Pembayaran Gagal'}
                        </CardTitle>
                        <CardDescription>
                            {transaction.status === 'completed'
                                ? 'Terima kasih atas bayaran anda.'
                                : 'Pembayaran anda tidak berjaya. Sila cuba lagi.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted p-4 rounded-lg space-y-3">
                            <div className="flex items-center gap-3 pb-3 border-b">
                                <Receipt className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">ID Transaksi</p>
                                    <p className="font-mono font-medium">{transaction.payment_reference || transaction.id}</p>
                                </div>
                            </div>

                            {transaction.organizers?.name && (
                                <div className="flex items-center gap-3">
                                    <Store className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Penganjur</p>
                                        <p className="font-medium">{transaction.organizers.name}</p>
                                    </div>
                                </div>
                            )}

                            {metadata.location_name && (
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Lokasi</p>
                                        <p className="font-medium">{metadata.location_name}</p>
                                    </div>
                                </div>
                            )}

                            {metadata.payer_name && (
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Nama</p>
                                        <p className="font-medium">{metadata.payer_name}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Tarikh</p>
                                    <p className="font-medium">
                                        {format(new Date(transaction.date), 'dd MMMM yyyy', { locale: ms })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {transaction.amount > 0 && (
                            <div className="bg-primary/10 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold">Jumlah Bayaran:</span>
                                    <span className="text-2xl font-bold text-primary">
                                        RM {transaction.amount.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Link href="/bayar" className="flex-1">
                                <Button variant="outline" className="w-full">
                                    Bayar Lagi
                                </Button>
                            </Link>
                            {transaction.status === 'completed' && (
                                <Button className="flex-1" onClick={() => window.print()}>
                                    Cetak Resit
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function PaymentStatusPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Memuatkan status pembayaran...</p>
                </div>
            </div>
        }>
            <PaymentStatusContent />
        </Suspense>
    )
}

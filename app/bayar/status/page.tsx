"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
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
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [transaction, setTransaction] = useState<TransactionData | null>(null)
    const [error, setError] = useState<string | null>(null)

    const txId = searchParams.get('tx')
    const billplzId = searchParams.get('billplz[id]')
    const status = searchParams.get('status')
    const billplzStatus = searchParams.get('billplz[state]')
    const billplzPaid = searchParams.get('billplz[paid]')

    // Determine if payment was successful based on URL params
    const isPaymentSuccessful = () => {
        if (status === 'success') return true
        if (billplzPaid === 'true') return true
        if (billplzStatus === 'paid') return true
        return false
    }

    useEffect(() => {
        const fetchTransaction = async () => {
            console.log('[Bayar Status] Starting fetch:', { txId, billplzId, status, billplzStatus, billplzPaid })
            
            if (!txId) {
                setError("ID transaksi tidak dijumpai")
                setLoading(false)
                return
            }

            try {
                let data: any = null
                let fetchError: any = null
                
                // Try multiple lookup strategies
                const lookupStrategies = [
                    // Strategy 1: Lookup by Supabase ID (txId)
                    async () => {
                        console.log('[Bayar Status] Trying lookup by ID:', txId)
                        const result = await supabase
                            .from('organizer_transactions')
                            .select(`*, organizers:organizer_id (name, organizer_code)`)
                            .eq('id', txId)
                            .maybeSingle()
                        return result
                    },
                    // Strategy 2: Lookup by Billplz ID (payment_reference)
                    async () => {
                        if (!billplzId) return { data: null, error: null }
                        console.log('[Bayar Status] Trying lookup by Billplz ID:', billplzId)
                        const result = await supabase
                            .from('organizer_transactions')
                            .select(`*, organizers:organizer_id (name, organizer_code)`)
                            .eq('payment_reference', billplzId)
                            .maybeSingle()
                        return result
                    },
                    // Strategy 3: Find recent pending transaction with matching metadata
                    async () => {
                        console.log('[Bayar Status] Trying recent pending lookup')
                        const { data: pendingTxs } = await supabase
                            .from('organizer_transactions')
                            .select(`*, organizers:organizer_id (name, organizer_code)`)
                            .eq('status', 'pending')
                            .gte('created_at', new Date(Date.now() - 3600000).toISOString())
                            .order('created_at', { ascending: false })
                            .limit(5)
                        
                        if (pendingTxs && pendingTxs.length > 0) {
                            console.log('[Bayar Status] Found recent pending tx:', pendingTxs[0].id)
                            return { data: pendingTxs[0], error: null }
                        }
                        return { data: null, error: null }
                    }
                ]

                // Try each strategy with retries
                for (let attempt = 0; attempt < 3; attempt++) {
                    console.log(`[Bayar Status] Lookup attempt ${attempt + 1}`)
                    
                    for (const strategy of lookupStrategies) {
                        const result = await strategy()
                        if (result.data) {
                            data = result.data
                            fetchError = result.error
                            console.log('[Bayar Status] Found transaction:', data.id)
                            break
                        }
                    }
                    
                    if (data) break
                    
                    // Wait before retry
                    if (attempt < 2) {
                        console.log('[Bayar Status] Waiting 1.5s before retry...')
                        await new Promise(r => setTimeout(r, 1500))
                    }
                }

                if (fetchError) {
                    console.error('[Bayar Status] Fetch error:', fetchError)
                    throw new Error(fetchError.message)
                }
                
                if (!data) {
                    console.error('[Bayar Status] Transaction not found after all attempts')
                    // If payment was successful but we can't find the transaction,
                    // show success anyway to avoid confusing the user
                    if (isPaymentSuccessful()) {
                        console.log('[Bayar Status] Payment was successful, showing generic success')
                        setTransaction({
                            id: 0,
                            description: 'Bayaran Sewa',
                            amount: 0,
                            status: 'completed',
                            date: new Date().toISOString(),
                            payment_reference: billplzId || txId,
                            metadata: {
                                payer_name: 'Pengguna',
                                payer_phone: '-',
                                organizer_id: '',
                                organizer_code: '',
                                location_id: '',
                                location_name: '-',
                                rate_type: '-',
                                is_public_payment: true
                            }
                        })
                        setLoading(false)
                        return
                    }
                    throw new Error("Transaksi tidak dijumpai. Sila semak dengan penganjur.")
                }

                // Update status if payment was successful
                if (isPaymentSuccessful() && data.status === 'pending') {
                    console.log('[Bayar Status] Updating transaction status to completed')
                    const { error: updateError } = await supabase
                        .from('organizer_transactions')
                        .update({
                            status: 'completed',
                            payment_reference: billplzId || data.payment_reference,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', data.id)

                    if (updateError) {
                        console.error('[Bayar Status] Update error:', updateError)
                    } else {
                        data.status = 'completed'
                        data.payment_reference = billplzId || data.payment_reference
                    }
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
    }, [txId, billplzId, status, billplzStatus, billplzPaid, supabase])

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

    const isSuccess = transaction.status === 'completed' || isPaymentSuccessful()
    const metadata = transaction.metadata || {}

    return (
        <div className="min-h-screen bg-secondary/30 py-8 px-4">
            <div className="max-w-lg mx-auto">
                <Card className={`shadow-lg ${isSuccess ? 'border-green-200' : 'border-red-200'}`}>
                    <CardHeader className="text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isSuccess ? (
                                <CheckCircle className="w-12 h-12 text-green-600" />
                            ) : (
                                <XCircle className="w-12 h-12 text-red-600" />
                            )}
                        </div>
                        <CardTitle className={`text-2xl font-serif ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
                            {isSuccess ? 'Pembayaran Berjaya!' : 'Pembayaran Gagal'}
                        </CardTitle>
                        <CardDescription>
                            {isSuccess
                                ? 'Terima kasih atas bayaran anda. Resit telah dihantar ke penganjur.'
                                : 'Pembayaran anda tidak berjaya. Sila cuba lagi.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Transaction Details */}
                        <div className="bg-muted p-4 rounded-lg space-y-3">
                            <div className="flex items-center gap-3 pb-3 border-b">
                                <Receipt className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">ID Transaksi</p>
                                    <p className="font-mono font-medium">{transaction.payment_reference || transaction.id || '-'}</p>
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

                            {metadata.payer_phone && (
                                <div className="flex items-center gap-3">
                                    <Phone className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Telefon</p>
                                        <p className="font-medium">{metadata.payer_phone}</p>
                                    </div>
                                </div>
                            )}

                            {metadata.business_name && (
                                <div className="flex items-center gap-3">
                                    <Store className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Nama Perniagaan</p>
                                        <p className="font-medium">{metadata.business_name}</p>
                                    </div>
                                </div>
                            )}

                            {metadata.stall_number && (
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">No. Petak</p>
                                        <p className="font-medium">{metadata.stall_number}</p>
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

                        {/* Amount */}
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

                        {/* Status Badge */}
                        <div className="flex justify-center">
                            <span className={`px-4 py-2 rounded-full font-medium ${isSuccess
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                {isSuccess ? 'Berjaya' : 'Gagal'}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <Link href="/bayar" className="flex-1">
                                <Button variant="outline" className="w-full">
                                    Bayar Lagi
                                </Button>
                            </Link>
                            {isSuccess && (
                                <Button
                                    className="flex-1"
                                    onClick={() => window.print()}
                                >
                                    Cetak Resit
                                </Button>
                            )}
                        </div>

                        {/* Note for Organizer */}
                        {isSuccess && (
                            <p className="text-xs text-center text-muted-foreground">
                                Penganjur akan dapat melihat bayaran ini dalam dashboard mereka.
                            </p>
                        )}
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

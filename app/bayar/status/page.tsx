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
    id: string
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
    const status = searchParams.get('status') // success or failed from payment gateway

    useEffect(() => {
        const fetchTransaction = async () => {
            if (!txId) {
                setError("ID transaksi tidak dijumpai")
                setLoading(false)
                return
            }

            try {
                // Retry logic - sometimes there's a race condition between redirect and DB update
                let retries = 0
                const maxRetries = 5
                let data: any = null
                let fetchError: any = null

                while (retries < maxRetries) {
                    console.log(`[Bayar Status] Lookup attempt ${retries + 1} for txId:`, txId)
                    
                    // Try lookup by ID first - use maybeSingle to avoid "Cannot coerce" error
                    let result = await supabase
                        .from('organizer_transactions')
                        .select(`
                            *,
                            organizers:organizer_id (name, organizer_code)
                        `)
                        .eq('id', txId)
                        .maybeSingle()
                    
                    // If not found by ID, try by payment_reference (Billplz ID)
                    if (!result.data && !result.error) {
                        console.log(`[Bayar Status] Not found by ID, trying payment_reference...`)
                        result = await supabase
                            .from('organizer_transactions')
                            .select(`
                                *,
                                organizers:organizer_id (name, organizer_code)
                            `)
                            .eq('payment_reference', txId)
                            .maybeSingle()
                    }
                    
                    data = result.data
                    fetchError = result.error

                    if (data) {
                        console.log(`[Bayar Status] Found transaction:`, data.id)
                        break
                    }
                    
                    if (fetchError) {
                        console.error(`[Bayar Status] Error on attempt ${retries + 1}:`, fetchError)
                    }
                    
                    // Wait a bit before retrying
                    if (retries < maxRetries - 1) {
                        await new Promise(r => setTimeout(r, 1000))
                    }
                    retries++
                }

                if (fetchError) {
                    throw new Error(fetchError.message)
                }
                
                if (!data) {
                    throw new Error("Transaksi tidak dijumpai. Sila semak dengan penganjur.")
                }

                setTransaction(data)

                // If payment was successful via gateway, update status
                if (status === 'success' && data.status === 'pending') {
                    console.log(`[Bayar Status] Updating transaction status to completed...`)
                    const { error: updateError } = await supabase
                        .from('organizer_transactions')
                        .update({
                            status: 'completed',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', data.id)

                    if (updateError) {
                        console.error(`[Bayar Status] Update error:`, updateError)
                    } else {
                        // Refresh data
                        const { data: updated } = await supabase
                            .from('organizer_transactions')
                            .select(`
                                *,
                                organizers:organizer_id (name, organizer_code)
                            `)
                            .eq('id', data.id)
                            .maybeSingle()

                        if (updated) setTransaction(updated)
                    }
                }
            } catch (err: any) {
                console.error(`[Bayar Status] Error:`, err)
                setError(err.message || "Ralat tidak diketahui")
            } finally {
                setLoading(false)
            }
        }

        fetchTransaction()
    }, [txId, status, supabase])

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

    const isSuccess = transaction.status === 'completed' || status === 'success'
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
                                    <p className="font-mono font-medium">{transaction.payment_reference || transaction.id}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Store className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Penganjur</p>
                                    <p className="font-medium">
                                        {transaction.organizers?.name || metadata.organizer_code || '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <MapPin className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Lokasi</p>
                                    <p className="font-medium">{metadata.location_name || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Nama</p>
                                    <p className="font-medium">{metadata.payer_name || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Telefon</p>
                                    <p className="font-medium">{metadata.payer_phone || '-'}</p>
                                </div>
                            </div>

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
                        <div className="bg-primary/10 p-4 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">Jumlah Bayaran:</span>
                                <span className="text-2xl font-bold text-primary">
                                    RM {transaction.amount.toFixed(2)}
                                </span>
                            </div>
                        </div>

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

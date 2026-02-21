"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Home, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"

// Lazy load activateSubscription - only import when needed
const activateSubscription = async (params: any) => {
    const { activateSubscription: fn } = await import("@/actions/subscription")
    return fn(params)
}

function PaymentStatusContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [status, setStatus] = useState<'loading' | 'success' | 'failure' | 'error'>('loading')
    const [details, setDetails] = useState<any>({})
    const [errorMessage, setErrorMessage] = useState<string>("")
    const [isRefreshingSession, setIsRefreshingSession] = useState(false)

    useEffect(() => {
        // Refresh session when coming back from external payment
        const refreshAuthSession = async () => {
            const supabase = createClient()
            try {
                setIsRefreshingSession(true)
                // This refreshes the session from cookies
                const { data: { session }, error } = await supabase.auth.getSession()
                if (error) {
                    console.warn("[PaymentStatus] Session refresh warning:", error)
                }
                console.log("[PaymentStatus] Session status:", session ? "Active" : "No session")
            } catch (e) {
                console.error("[PaymentStatus] Session refresh error:", e)
            } finally {
                setIsRefreshingSession(false)
            }
        }

        refreshAuthSession()
    }, [])

    useEffect(() => {
        const verifyPayment = async () => {
            try {
                // 1. Check Gateway Source
                const gateway = searchParams.get('gateway')
                const nextPath = searchParams.get('next') || '/dashboard/rentals'

                // Metadata Checks
                const isSubscription = searchParams.get('isSubscription') === 'true'
                const planType = searchParams.get('planType')

                if (gateway === 'chip-in') {
                    const result = searchParams.get('status')
                    if (result === 'success') {
                        if (isSubscription && planType) {
                            try {
                                await activateSubscription({
                                    transactionId: searchParams.get('id') || 'chip-in-txn',
                                    planType: planType,
                                    amount: 39,
                                    paymentRef: searchParams.get('id') || 'chip-in-ref'
                                })
                                toast.success("Langganan diaktifkan!")
                            } catch (e: any) {
                                console.error("Subscription error:", e)
                                // Don't fail the whole payment for subscription activation error
                                toast.error("Pembayaran berjaya tetapi gagal mengaktifkan langganan. Sila hubungi sokongan.")
                            }
                        }

                        setStatus('success')
                        setDetails({
                            id: searchParams.get('id'),
                            message: 'Pembayaran Chip-In Berjaya'
                        })
                    } else {
                        setStatus('failure')
                        setDetails({
                            message: 'Pembayaran Chip-In Gagal'
                        })
                    }
                } else if (gateway === 'billplz') {
                    const paid = searchParams.get('billplz[paid]')
                    const id = searchParams.get('billplz[id]')
                    const statusParam = searchParams.get('billplz[state]')

                    if (paid === 'true' || statusParam === 'paid') {
                        if (isSubscription && planType) {
                            try {
                                await activateSubscription({
                                    transactionId: id || 'billplz-txn',
                                    planType: planType,
                                    amount: 39,
                                    paymentRef: id || 'billplz-ref'
                                })
                                toast.success("Langganan diaktifkan!")
                            } catch (e: any) {
                                console.error("Subscription error:", e)
                                toast.error("Pembayaran berjaya tetapi gagal mengaktifkan langganan. Sila hubungi sokongan.")
                            }
                        }

                        setStatus('success')
                        setDetails({
                            id: id,
                            message: 'Pembayaran Billplz Berjaya'
                        })
                    } else {
                        setStatus('failure')
                        setDetails({
                            id: id,
                            message: 'Pembayaran Dibatalkan / Gagal'
                        })
                    }
                } else {
                    // Check if we have any params at all
                    const hasParams = Array.from(searchParams.entries()).length > 0
                    if (!hasParams) {
                        setStatus('error')
                        setErrorMessage("Tiada maklumat pembayaran diterima. Sila cuba lagi.")
                    } else {
                        // Try to determine status from other params
                        const generalStatus = searchParams.get('status')
                        if (generalStatus === 'success') {
                            setStatus('success')
                            setDetails({ message: 'Pembayaran Berjaya' })
                        } else if (generalStatus === 'failed' || generalStatus === 'failure') {
                            setStatus('failure')
                            setDetails({ message: 'Pembayaran Gagal' })
                        } else {
                            setStatus('error')
                            setErrorMessage("Status pembayaran tidak dapat disahkan. Sila semak dashboard anda.")
                        }
                    }
                }
            } catch (err: any) {
                console.error("Payment status error:", err)
                setStatus('error')
                setErrorMessage(err.message || "Ralat tidak diketahui semasa memproses pembayaran.")
            }
        }

        verifyPayment()
    }, [searchParams])

    const handleNext = () => {
        const nextPath = searchParams.get('next') || '/dashboard/rentals'
        // Use window.location.href for hard redirect to preserve session
        // This ensures cookies are properly sent
        window.location.href = nextPath
    }

    const handleRetry = () => {
        const nextPath = searchParams.get('next') || '/dashboard/rentals'
        window.location.href = nextPath
    }

    const handleGoHome = () => {
        window.location.href = '/dashboard/rentals'
    }

    const getTitle = () => {
        switch (status) {
            case 'loading': return "Memproses..."
            case 'success': return "Pembayaran Berjaya!"
            case 'failure': return "Pembayaran Gagal"
            case 'error': return "Ralat"
            default: return "Memproses..."
        }
    }

    const getDescription = () => {
        switch (status) {
            case 'loading': return "Sila tunggu semasa kami mengesahkan pembayaran anda..."
            case 'success': return "Terima kasih. Transaksi anda telah direkodkan."
            case 'failure': return "Maaf, transaksi tidak dapat diproses."
            case 'error': return errorMessage
            default: return ""
        }
    }

    const getIcon = () => {
        switch (status) {
            case 'loading': return <Loader2 className="w-16 h-16 animate-spin text-primary" />
            case 'success': return <div className="rounded-full bg-green-100 p-3"><CheckCircle2 className="w-12 h-12 text-green-600" /></div>
            case 'failure': return <div className="rounded-full bg-red-100 p-3"><XCircle className="w-12 h-12 text-red-600" /></div>
            case 'error': return <div className="rounded-full bg-orange-100 p-3"><AlertCircle className="w-12 h-12 text-orange-600" /></div>
            default: return <Loader2 className="w-16 h-16 animate-spin text-primary" />
        }
    }

    const getBgColor = () => {
        switch (status) {
            case 'success': return "bg-green-50/50"
            case 'failure': return "bg-red-50/50"
            case 'error': return "bg-orange-50/50"
            default: return "bg-zinc-50"
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
            <Card className="w-full max-w-md shadow-lg border-border/50 rounded-[2rem] overflow-hidden">
                <CardHeader className={cn("text-center pb-8", getBgColor())}>
                    <div className="flex justify-center mb-4 mt-6">
                        {getIcon()}
                    </div>
                    <CardTitle className="text-2xl font-serif">
                        {getTitle()}
                    </CardTitle>
                    <CardDescription>
                        {getDescription()}
                    </CardDescription>
                    {isRefreshingSession && (
                        <p className="text-xs text-muted-foreground mt-2">
                            <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                            Memperbaharui sesi...
                        </p>
                    )}
                </CardHeader>

                <CardContent className="space-y-4 pt-6 text-center">
                    {status !== 'loading' && status !== 'error' && (
                        <div className="bg-secondary/20 p-4 rounded-xl text-sm">
                            <p className="text-muted-foreground mb-1">ID Transaksi:</p>
                            <p className="font-mono font-bold text-foreground overflow-hidden text-ellipsis">
                                {details.id || searchParams.get('billplz[id]') || searchParams.get('id') || "-"}
                            </p>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="bg-orange-50 p-4 rounded-xl text-sm text-orange-800">
                            <p className="font-medium">{errorMessage}</p>
                            <p className="text-xs mt-2 text-orange-600">
                                Jika anda telah membuat pembayaran, sila semak dashboard atau hubungi sokongan.
                            </p>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3 pb-8 px-8">
                    {status === 'success' ? (
                        <Button 
                            onClick={handleNext} 
                            className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20 bg-brand-green hover:bg-brand-green/90"
                        >
                            <Home className="mr-2 h-4 w-4" /> Kembali ke Halaman Utama
                        </Button>
                    ) : status === 'failure' ? (
                        <Button 
                            onClick={handleRetry} 
                            className="w-full h-12 rounded-xl text-base font-bold shadow-sm" 
                            variant="outline"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Cuba Semula
                        </Button>
                    ) : status === 'error' ? (
                        <>
                            <Button 
                                onClick={handleGoHome} 
                                className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20"
                            >
                                <Home className="mr-2 h-4 w-4" /> Ke Halaman Utama
                            </Button>
                            <Button 
                                onClick={handleRetry} 
                                variant="outline" 
                                className="w-full h-12 rounded-xl"
                            >
                                Cuba Semula
                            </Button>
                        </>
                    ) : null}
                </CardFooter>
            </Card>
        </div>
    )
}

export default function PaymentStatusPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
                <Card className="w-full max-w-md shadow-lg border-border/50 rounded-[2rem] overflow-hidden">
                    <CardContent className="flex items-center justify-center py-20">
                        <Loader2 className="w-16 h-16 animate-spin text-primary" />
                    </CardContent>
                </Card>
            </div>
        }>
            <PaymentStatusContent />
        </Suspense>
    )
}

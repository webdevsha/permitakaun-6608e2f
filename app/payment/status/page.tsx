
import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { activateSubscription } from "@/actions/subscription"
import { toast } from "sonner"

export default function PaymentStatusPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [status, setStatus] = useState<'loading' | 'success' | 'failure'>('loading')
    const [details, setDetails] = useState<any>({})

    useEffect(() => {
        const verifyPayment = async () => {
            // 1. Check Gateway Source
            const gateway = searchParams.get('gateway')
            const nextPath = searchParams.get('next') || '/dashboard'

            // Metadata Checks
            const isSubscription = searchParams.get('isSubscription') === 'true'
            const planType = searchParams.get('planType')

            if (gateway === 'chip-in') {
                const result = searchParams.get('status')
                // Chip-in might explicitly pass status via our custom redirect URL params
                if (result === 'success') {
                    if (isSubscription && planType) {
                        try {
                            await activateSubscription({
                                transactionId: searchParams.get('id') || 'chip-in-txn',
                                planType: planType,
                                amount: 39, // Placeholder, should come from params or verification
                                paymentRef: searchParams.get('id') || 'chip-in-ref'
                            })
                            toast.success("Langganan diaktifkan!")
                        } catch (e) {
                            console.error(e)
                            toast.error("Gagal mengaktifkan langganan")
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

                if (paid === 'true') {
                    if (isSubscription && planType) {
                        try {
                            await activateSubscription({
                                transactionId: id || 'billplz-txn',
                                planType: planType,
                                amount: 39,
                                paymentRef: id || 'billplz-ref'
                            })
                            toast.success("Langganan diaktifkan!")
                        } catch (e) {
                            console.error(e)
                            toast.error("Gagal mengaktifkan langganan")
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
                // Fallback or unknown
                setStatus('failure')
            }
        }

        verifyPayment()

    }, [searchParams])

    const handleNext = () => {
        const nextPath = searchParams.get('next') || '/dashboard'
        router.push(nextPath)
    }

    const handleRetry = () => {
        // Go back to previous page
        const nextPath = searchParams.get('next') || '/dashboard'
        router.push(nextPath)
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
            <Card className="w-full max-w-md shadow-lg border-border/50 rounded-[2rem] overflow-hidden">
                <CardHeader className={cn("text-center pb-8",
                    status === 'success' ? "bg-green-50/50" :
                        status === 'failure' ? "bg-red-50/50" : "bg-zinc-50"
                )}>
                    <div className="flex justify-center mb-4 mt-6">
                        {status === 'loading' && <Loader2 className="w-16 h-16 animate-spin text-primary" />}
                        {status === 'success' && <div className="rounded-full bg-green-100 p-3"><CheckCircle2 className="w-12 h-12 text-green-600" /></div>}
                        {status === 'failure' && <div className="rounded-full bg-red-100 p-3"><XCircle className="w-12 h-12 text-red-600" /></div>}
                    </div>
                    <CardTitle className="text-2xl font-serif">
                        {status === 'loading' && "Memproses..."}
                        {status === 'success' && "Pembayaran Berjaya!"}
                        {status === 'failure' && "Pembayaran Gagal"}
                    </CardTitle>
                    <CardDescription>
                        {status === 'success' && "Terima kasih. Transaksi anda telah direkodkan."}
                        {status === 'failure' && "Maaf, transaksi tidak dapat diproses."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-6 text-center">
                    {status !== 'loading' && (
                        <div className="bg-secondary/20 p-4 rounded-xl text-sm">
                            <p className="text-muted-foreground mb-1">ID Transaksi:</p>
                            <p className="font-mono font-bold text-foreground overflow-hidden text-ellipsis">
                                {details.id || searchParams.get('billplz[id]') || searchParams.get('id') || "-"}
                            </p>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3 pb-8 px-8">
                    {status === 'success' ? (
                        <Button onClick={handleNext} className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20 bg-brand-green hover:bg-brand-green/90">
                            <Home className="mr-2 h-4 w-4" /> Kembali ke Halaman Utama
                        </Button>
                    ) : status === 'failure' ? (
                        <Button onClick={handleRetry} className="w-full h-12 rounded-xl text-base font-bold shadow-sm" variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Cuba Semula
                        </Button>
                    ) : null}
                </CardFooter>
            </Card>
        </div>
    )
}

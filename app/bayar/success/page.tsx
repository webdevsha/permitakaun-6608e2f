"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Home, Loader2 } from "lucide-react"
import Link from "next/link"

function PaymentSuccessContent() {
    const searchParams = useSearchParams()
    const billplzId = searchParams.get('billplz[id]') || searchParams.get('ref')
    const amount = searchParams.get('amount')

    return (
        <div className="min-h-screen bg-secondary/30 py-8 px-4">
            <div className="max-w-lg mx-auto">
                <Card className="shadow-lg border-green-200">
                    <CardHeader className="text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl font-serif text-green-800">
                            Pembayaran Berjaya!
                        </CardTitle>
                        <CardDescription>
                            Terima kasih atas bayaran anda. Resit akan dihantar ke email anda.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {billplzId && (
                            <div className="bg-muted p-4 rounded-lg">
                                <p className="text-sm text-muted-foreground">ID Rujukan:</p>
                                <p className="font-mono font-medium">{billplzId}</p>
                            </div>
                        )}

                        {amount && (
                            <div className="bg-primary/10 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold">Jumlah:</span>
                                    <span className="text-2xl font-bold text-primary">
                                        RM {amount}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Link href="/" className="flex-1">
                                <Button className="w-full" variant="outline">
                                    <Home className="w-4 h-4 mr-2" />
                                    Halaman Utama
                                </Button>
                            </Link>
                            <Button 
                                className="flex-1"
                                onClick={() => window.print()}
                            >
                                Cetak Resit
                            </Button>
                        </div>

                        <p className="text-xs text-center text-muted-foreground">
                            Penganjur akan dapat melihat bayaran ini dalam dashboard mereka.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Memuatkan...</p>
                </div>
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    )
}

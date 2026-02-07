"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, CheckCircle, XCircle, AlertCircle, Send } from "lucide-react"
import { toast } from "sonner"
import { sendWelcomeEmailAction, sendPaymentReceiptAction, sendAccountActivatedAction } from "@/actions/email"

export default function TestEmailPage() {
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [results, setResults] = useState<Record<string, any>>({})

    // Form states
    const [welcomeData, setWelcomeData] = useState({ email: "", name: "" })
    const [receiptData, setReceiptData] = useState({ 
        email: "", 
        name: "", 
        amount: "100.00", 
        date: new Date().toLocaleString('ms-MY'),
        description: "Bayaran Sewa Tapak"
    })
    const [activationData, setActivationData] = useState({ email: "", name: "" })

    const handleSendWelcome = async () => {
        if (!welcomeData.email || !welcomeData.name) {
            toast.error("Sila isi email dan nama")
            return
        }
        
        setLoading(prev => ({ ...prev, welcome: true }))
        try {
            const result = await sendWelcomeEmailAction(welcomeData.email, welcomeData.name)
            setResults(prev => ({ ...prev, welcome: result }))
            
            if (result.success) {
                toast.success("Email selamat datang dihantar!")
            } else {
                toast.error("Gagal menghantar: " + (result.error?.message || result.error || "Unknown error"))
            }
        } catch (error: any) {
            toast.error("Ralat: " + error.message)
            setResults(prev => ({ ...prev, welcome: { success: false, error: error.message } }))
        } finally {
            setLoading(prev => ({ ...prev, welcome: false }))
        }
    }

    const handleSendReceipt = async () => {
        if (!receiptData.email || !receiptData.name) {
            toast.error("Sila isi email dan nama")
            return
        }
        
        setLoading(prev => ({ ...prev, receipt: true }))
        try {
            const result = await sendPaymentReceiptAction(
                receiptData.email, 
                receiptData.name, 
                receiptData.amount, 
                receiptData.date, 
                receiptData.description
            )
            setResults(prev => ({ ...prev, receipt: result }))
            
            if (result.success) {
                toast.success("Resit pembayaran dihantar!")
            } else {
                toast.error("Gagal menghantar: " + (result.error?.message || result.error || "Unknown error"))
            }
        } catch (error: any) {
            toast.error("Ralat: " + error.message)
            setResults(prev => ({ ...prev, receipt: { success: false, error: error.message } }))
        } finally {
            setLoading(prev => ({ ...prev, receipt: false }))
        }
    }

    const handleSendActivation = async () => {
        if (!activationData.email || !activationData.name) {
            toast.error("Sila isi email dan nama")
            return
        }
        
        setLoading(prev => ({ ...prev, activation: true }))
        try {
            const result = await sendAccountActivatedAction(activationData.email, activationData.name)
            setResults(prev => ({ ...prev, activation: result }))
            
            if (result.success) {
                toast.success("Email pengaktifan dihantar!")
            } else {
                toast.error("Gagal menghantar: " + (result.error?.message || result.error || "Unknown error"))
            }
        } catch (error: any) {
            toast.error("Ralat: " + error.message)
            setResults(prev => ({ ...prev, activation: { success: false, error: error.message } }))
        } finally {
            setLoading(prev => ({ ...prev, activation: false }))
        }
    }

    const getStatusBadge = (result: any) => {
        if (!result) return null
        if (result.success) {
            return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="w-3 h-3 mr-1" /> Berjaya</Badge>
        } else {
            return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="w-3 h-3 mr-1" /> Gagal</Badge>
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white py-12 px-4">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                        <Mail className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Test Emel Brevo</h1>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Ujian penghantaran emel melalui Brevo API. Tiada perlu daftar masuk atau buat transaksi.
                    </p>
                </div>

                {/* Brevo Config Status */}
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-semibold mb-1">Konfigurasi Diperlukan</p>
                                <p>Pastikan <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">BREVO_API_KEY</code> telah ditetapkan dalam environment variables.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Email Test Tabs */}
                <Tabs defaultValue="welcome" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="welcome">Selamat Datang</TabsTrigger>
                        <TabsTrigger value="receipt">Resit Pembayaran</TabsTrigger>
                        <TabsTrigger value="activation">Akaun Diaktifkan</TabsTrigger>
                    </TabsList>

                    {/* Welcome Email */}
                    <TabsContent value="welcome">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="w-5 h-5" />
                                    Emel Selamat Datang
                                </CardTitle>
                                <CardDescription>
                                    Hantar emel selamat datang kepada pengguna baharu
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="welcome-email">Alamat Emel</Label>
                                        <Input 
                                            id="welcome-email" 
                                            type="email" 
                                            placeholder="test@example.com"
                                            value={welcomeData.email}
                                            onChange={(e) => setWelcomeData(prev => ({ ...prev, email: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="welcome-name">Nama</Label>
                                        <Input 
                                            id="welcome-name" 
                                            placeholder="Ahmad bin Abdullah"
                                            value={welcomeData.name}
                                            onChange={(e) => setWelcomeData(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                
                                {results.welcome && (
                                    <div className={`p-4 rounded-lg text-sm ${results.welcome.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {getStatusBadge(results.welcome)}
                                        </div>
                                        {results.welcome.error && (
                                            <pre className="text-xs overflow-auto max-h-32 mt-2 p-2 bg-black/5 rounded">
                                                {JSON.stringify(results.welcome.error, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    onClick={handleSendWelcome} 
                                    disabled={loading.welcome}
                                    className="w-full"
                                >
                                    {loading.welcome ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menghantar...</>
                                    ) : (
                                        <><Send className="w-4 h-4 mr-2" /> Hantar Emel</>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* Payment Receipt */}
                    <TabsContent value="receipt">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="w-5 h-5" />
                                    Resit Pembayaran
                                </CardTitle>
                                <CardDescription>
                                    Hantar resit pembayaran kepada penyewa
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="receipt-email">Alamat Emel</Label>
                                            <Input 
                                                id="receipt-email" 
                                                type="email" 
                                                placeholder="tenant@example.com"
                                                value={receiptData.email}
                                                onChange={(e) => setReceiptData(prev => ({ ...prev, email: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="receipt-name">Nama</Label>
                                            <Input 
                                                id="receipt-name" 
                                                placeholder="Siti Aminah"
                                                value={receiptData.name}
                                                onChange={(e) => setReceiptData(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="receipt-amount">Jumlah (RM)</Label>
                                            <Input 
                                                id="receipt-amount" 
                                                placeholder="100.00"
                                                value={receiptData.amount}
                                                onChange={(e) => setReceiptData(prev => ({ ...prev, amount: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="receipt-date">Tarikh</Label>
                                            <Input 
                                                id="receipt-date" 
                                                value={receiptData.date}
                                                onChange={(e) => setReceiptData(prev => ({ ...prev, date: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="receipt-desc">Keterangan</Label>
                                        <Input 
                                            id="receipt-desc" 
                                            placeholder="Bayaran Sewa Tapak"
                                            value={receiptData.description}
                                            onChange={(e) => setReceiptData(prev => ({ ...prev, description: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                
                                {results.receipt && (
                                    <div className={`p-4 rounded-lg text-sm ${results.receipt.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {getStatusBadge(results.receipt)}
                                        </div>
                                        {results.receipt.error && (
                                            <pre className="text-xs overflow-auto max-h-32 mt-2 p-2 bg-black/5 rounded">
                                                {JSON.stringify(results.receipt.error, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    onClick={handleSendReceipt} 
                                    disabled={loading.receipt}
                                    className="w-full"
                                >
                                    {loading.receipt ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menghantar...</>
                                    ) : (
                                        <><Send className="w-4 h-4 mr-2" /> Hantar Resit</>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* Account Activation */}
                    <TabsContent value="activation">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="w-5 h-5" />
                                    Pengaktifan Akaun
                                </CardTitle>
                                <CardDescription>
                                    Hantar emel notifikasi akaun telah diaktifkan
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="activation-email">Alamat Emel</Label>
                                        <Input 
                                            id="activation-email" 
                                            type="email" 
                                            placeholder="user@example.com"
                                            value={activationData.email}
                                            onChange={(e) => setActivationData(prev => ({ ...prev, email: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="activation-name">Nama</Label>
                                        <Input 
                                            id="activation-name" 
                                            placeholder="Muhammad Ali"
                                            value={activationData.name}
                                            onChange={(e) => setActivationData(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                
                                {results.activation && (
                                    <div className={`p-4 rounded-lg text-sm ${results.activation.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {getStatusBadge(results.activation)}
                                        </div>
                                        {results.activation.error && (
                                            <pre className="text-xs overflow-auto max-h-32 mt-2 p-2 bg-black/5 rounded">
                                                {JSON.stringify(results.activation.error, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    onClick={handleSendActivation} 
                                    disabled={loading.activation}
                                    className="w-full"
                                >
                                    {loading.activation ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menghantar...</>
                                    ) : (
                                        <><Send className="w-4 h-4 mr-2" /> Hantar Emel</>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Tips Section */}
                <Card className="bg-blue-50/50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-sm text-blue-800">Tip Penggunaan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-sm text-blue-700 space-y-2 list-disc list-inside">
                            <li>Gunakan emel anda sendiri untuk menguji penerimaan</li>
                            <li>Semak folder Spam/Junk jika emel tidak diterima</li>
                            <li>Pastikan BREVO_API_KEY sah dan aktif di dashboard Brevo</li>
                            <li>Domain pengirim (hai@shafiranoh.com) perlu diverifikasi di Brevo</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

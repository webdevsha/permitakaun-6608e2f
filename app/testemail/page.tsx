"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Loader2, Mail, CheckCircle, XCircle, AlertCircle, Send, Key } from "lucide-react"
import { toast } from "sonner"
import { sendWelcomeEmailAction, sendPaymentReceiptAction, sendAccountActivatedAction, setEmailApiKeyType, getEmailApiKeyType } from "@/actions/email"

type ApiKeyType = 'default' | 'shafira' | 'hazman'

const API_KEY_CONFIG: Record<ApiKeyType, { 
    name: string; 
    color: string; 
    desc: string;
    senderEmail: string;
    adminEmail: string;
}> = {
    default: { 
        name: 'BREVO_HAZMAN (Default)', 
        color: 'bg-green-100 text-green-800 border-green-300', 
        desc: 'Key utama - BREVO_HAZMAN (Hazman)',
        senderEmail: 'admin@kumim.my',
        adminEmail: 'admin@kumim.my'
    },
    shafira: { 
        name: 'BREVO_SHAFIRA', 
        color: 'bg-blue-100 text-blue-800 border-blue-300', 
        desc: 'Key Shafira (backup)',
        senderEmail: 'hai@shafiranoh.com',
        adminEmail: 'hai@shafiranoh.com'
    },
    hazman: { 
        name: 'BREVO_HAZMAN', 
        color: 'bg-green-100 text-green-800 border-green-300', 
        desc: 'Key Hazman (default)',
        senderEmail: 'admin@kumim.my',
        adminEmail: 'admin@kumim.my'
    }
}

export default function TestEmailPage() {
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [results, setResults] = useState<Record<string, any>>({})
    const [apiKeyType, setApiKeyType] = useState<ApiKeyType>('default')
    const [isSwitching, setIsSwitching] = useState(false)

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

    // Load current API key type on mount
    useEffect(() => {
        const loadApiKeyType = async () => {
            const result = await getEmailApiKeyType()
            if (result.currentType) {
                setApiKeyType(result.currentType)
            }
        }
        loadApiKeyType()
    }, [])

    // Handle API key switch
    const handleSwitchApiKey = async (newType: ApiKeyType) => {
        setIsSwitching(true)
        try {
            const result = await setEmailApiKeyType(newType)
            if (result.success) {
                setApiKeyType(newType)
                toast.success(`Tukar ke ${API_KEY_CONFIG[newType].name}`)
                
                // Also save to localStorage for client-side reference
                localStorage.setItem('brevo_api_key_type', newType)
            }
        } catch (error) {
            toast.error('Gagal menukar API key')
        } finally {
            setIsSwitching(false)
        }
    }

    const handleSendWelcome = async () => {
        if (!welcomeData.email || !welcomeData.name) {
            toast.error("Sila isi email dan nama")
            return
        }
        
        setLoading(prev => ({ ...prev, welcome: true }))
        try {
            const result = await sendWelcomeEmailAction(welcomeData.email, welcomeData.name, undefined, apiKeyType)
            setResults(prev => ({ ...prev, welcome: result }))
            
            if (result.success) {
                toast.success(`Email selamat datang dihantar menggunakan ${API_KEY_CONFIG[apiKeyType].name}!`)
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
                receiptData.description,
                undefined,
                apiKeyType
            )
            setResults(prev => ({ ...prev, receipt: result }))
            
            if (result.success) {
                toast.success(`Resit pembayaran dihantar menggunakan ${API_KEY_CONFIG[apiKeyType].name}!`)
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
            const result = await sendAccountActivatedAction(activationData.email, activationData.name, apiKeyType)
            setResults(prev => ({ ...prev, activation: result }))
            
            if (result.success) {
                toast.success(`Email pengaktifan dihantar menggunakan ${API_KEY_CONFIG[apiKeyType].name}!`)
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

                {/* API Key Selector */}
                <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-primary" />
                            <CardTitle className="text-lg">Pilihan API Key Brevo</CardTitle>
                        </div>
                        <CardDescription>
                            Pilih API key untuk menghantar emel. Pilihan ini akan digunakan untuk keseluruhan sistem.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Current Status */}
                            <div className="p-3 bg-muted rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">API Key Aktif:</span>
                                    <Badge className={API_KEY_CONFIG[apiKeyType].color}>
                                        {API_KEY_CONFIG[apiKeyType].name}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Email Pengirim (FROM):</span>
                                    <code className="bg-background px-2 py-0.5 rounded font-mono">
                                        {API_KEY_CONFIG[apiKeyType].senderEmail}
                                    </code>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Email Admin (TO):</span>
                                    <code className="bg-background px-2 py-0.5 rounded font-mono">
                                        {API_KEY_CONFIG[apiKeyType].adminEmail}
                                    </code>
                                </div>
                            </div>

                            {/* Toggle Options */}
                            <div className="grid gap-3">
                                {/* Default / Hazman */}
                                <div className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                    apiKeyType === 'default' 
                                        ? 'border-green-500 bg-green-50/50' 
                                        : 'border-border hover:border-green-200'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            apiKeyType === 'default' ? 'border-green-500' : 'border-gray-300'
                                        }`}>
                                            {apiKeyType === 'default' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">BREVO_HAZMAN (Default)</p>
                                            <p className="text-xs text-muted-foreground">Key utama sistem - admin@kumim.my</p>
                                        </div>
                                    </div>
                                    <Switch 
                                        checked={apiKeyType === 'default'}
                                        onCheckedChange={() => handleSwitchApiKey('default')}
                                        disabled={isSwitching}
                                    />
                                </div>

                                {/* Shafira Explicit */}
                                <div className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                    apiKeyType === 'shafira' 
                                        ? 'border-blue-500 bg-blue-50/50' 
                                        : 'border-border hover:border-blue-200'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            apiKeyType === 'shafira' ? 'border-blue-500' : 'border-gray-300'
                                        }`}>
                                            {apiKeyType === 'shafira' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">BREVO_SHAFIRA</p>
                                            <p className="text-xs text-muted-foreground">Key Shafira secara eksplisit</p>
                                        </div>
                                    </div>
                                    <Switch 
                                        checked={apiKeyType === 'shafira'}
                                        onCheckedChange={() => handleSwitchApiKey('shafira')}
                                        disabled={isSwitching}
                                    />
                                </div>

                                {/* Hazman Explicit */}
                                <div className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                    apiKeyType === 'hazman' 
                                        ? 'border-green-500 bg-green-50/50' 
                                        : 'border-border hover:border-green-200'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            apiKeyType === 'hazman' ? 'border-green-500' : 'border-gray-300'
                                        }`}>
                                            {apiKeyType === 'hazman' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">BREVO_HAZMAN (Eksplisit)</p>
                                            <p className="text-xs text-muted-foreground">Key Hazman secara eksplisit</p>
                                        </div>
                                    </div>
                                    <Switch 
                                        checked={apiKeyType === 'hazman'}
                                        onCheckedChange={() => handleSwitchApiKey('hazman')}
                                        disabled={isSwitching}
                                    />
                                </div>
                            </div>

                            {isSwitching && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Menukar API key...
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Brevo Config Status */}
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-semibold mb-1">Status Konfigurasi</p>
                                <p><code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">BREVO_API_KEY</code> kini menggunakan <strong>BREVO_HAZMAN</strong> (key aktif - Hazman)</p>
                                <p className="mt-1"><code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">BREVO_SHAFIRA</code> disimpan sebagai backup (key Shafira)</p>
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
                                            {results.welcome.apiKeyType && (
                                                <Badge variant="outline" className="text-xs">
                                                    {API_KEY_CONFIG[results.welcome.apiKeyType as ApiKeyType]?.name || results.welcome.apiKeyType}
                                                </Badge>
                                            )}
                                        </div>
                                        {results.welcome.sender && (
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Dihantar dari: <code className="font-mono">{results.welcome.sender}</code>
                                            </p>
                                        )}
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
                                        <><Send className="w-4 h-4 mr-2" /> Hantar Emel ({API_KEY_CONFIG[apiKeyType].name.split(' ')[0]})</>
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
                                            {results.receipt.apiKeyType && (
                                                <Badge variant="outline" className="text-xs">
                                                    {API_KEY_CONFIG[results.receipt.apiKeyType as ApiKeyType]?.name || results.receipt.apiKeyType}
                                                </Badge>
                                            )}
                                        </div>
                                        {results.receipt.sender && (
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Dihantar dari: <code className="font-mono">{results.receipt.sender}</code>
                                            </p>
                                        )}
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
                                        <><Send className="w-4 h-4 mr-2" /> Hantar Resit ({API_KEY_CONFIG[apiKeyType].name.split(' ')[0]})</>
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
                                            {results.activation.apiKeyType && (
                                                <Badge variant="outline" className="text-xs">
                                                    {API_KEY_CONFIG[results.activation.apiKeyType as ApiKeyType]?.name || results.activation.apiKeyType}
                                                </Badge>
                                            )}
                                        </div>
                                        {results.activation.sender && (
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Dihantar dari: <code className="font-mono">{results.activation.sender}</code>
                                            </p>
                                        )}
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
                                        <><Send className="w-4 h-4 mr-2" /> Hantar Emel ({API_KEY_CONFIG[apiKeyType].name.split(' ')[0]})</>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Tips Section */}
                <Card className="bg-blue-50/50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-sm text-blue-800">Tip Penggunaan & Konfigurasi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ul className="text-sm text-blue-700 space-y-2 list-disc list-inside">
                            <li>Gunakan emel anda sendiri untuk menguji penerimaan</li>
                            <li>Semak folder Spam/Junk jika emel tidak diterima</li>
                            <li>Key <strong>BREVO_HAZMAN</strong> adalah key utama sistem (admin@kumim.my)</li>
                            <li>Key <strong>BREVO_SHAFIRA</strong> disediakan sebagai backup (hai@shafiranoh.com)</li>
                            <li>Pilihan API key di sini akan digunakan untuk keseluruhan sistem</li>
                        </ul>
                        
                        <div className="pt-3 border-t border-blue-200">
                            <p className="text-xs font-semibold text-blue-800 mb-2">Konfigurasi Email:</p>
                            <div className="grid gap-1 text-xs text-blue-700">
                                <div className="flex justify-between">
                                    <span>BREVO_SHAFIRA:</span>
                                    <span className="font-mono">hai@shafiranoh.com</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>BREVO_HAZMAN:</span>
                                    <span className="font-mono">admin@kumim.my</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

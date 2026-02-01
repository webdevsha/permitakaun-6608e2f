"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Timer } from "lucide-react"
import { getPaymentMode, updatePaymentMode, getTrialPeriod, updateTrialPeriod } from "@/actions/settings"

export function PaymentSettings() {
    const [mode, setMode] = useState<"sandbox" | "real">("sandbox")
    const [trialDays, setTrialDays] = useState("14")
    const [loading, setLoading] = useState(true)
    const [updatingStr, setUpdatingStr] = useState("")

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            const [currentMode, days] = await Promise.all([
                getPaymentMode(),
                getTrialPeriod()
            ])
            setMode(currentMode as "sandbox" | "real")
            setTrialDays(days.toString())
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (checked: boolean) => {
        const newMode = checked ? "real" : "sandbox"
        setUpdatingStr("payment")
        setMode(newMode)
        try {
            await updatePaymentMode(newMode)
            toast.success(`Mod pembayaran dikemaskini: ${newMode.toUpperCase()} `)
        } catch (e: any) {
            toast.error("Gagal mengemaskini")
            setMode(mode) // Revert
        } finally {
            setUpdatingStr("")
        }
    }

    const handleSaveTrial = async () => {
        const d = parseInt(trialDays)
        if (isNaN(d) || d < 0) return toast.error("Hari tidak sah")

        setUpdatingStr("trial")
        try {
            await updateTrialPeriod(d)
            toast.success("Tempoh percubaan dikemaskini")
        } catch (e: any) {
            toast.error("Gagal: " + e.message)
        } finally {
            setUpdatingStr("")
        }
    }

    if (loading) return <div className="p-4"><Loader2 className="animate-spin" /></div>

    return (
        <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
            <CardHeader className="pb-2">
                <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Tetapan Sistem</CardDescription>
                <CardTitle className="text-xl font-serif font-bold">Konfigurasi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                {/* Payment Mode */}
                <div className="flex items-center justify-between space-x-2 bg-secondary/20 p-4 rounded-xl">
                    <div className="space-y-1">
                        <Label htmlFor="payment-mode" className="font-bold flex items-center gap-2">
                            {mode === 'real' ? 'Mod LIVE (Billplz)' : 'Mod SANDBOX (Chip-In)'}
                            {updatingStr === 'payment' && <Loader2 className="h-3 w-3 animate-spin" />}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            {mode === 'real' ? "Pembayaran sebenar akan diproses." : "Mod ujian. Tiada wang sebenar ditolak."}
                        </p>
                    </div>
                    <Switch
                        id="payment-mode"
                        checked={mode === 'real'}
                        onCheckedChange={handleToggle}
                        disabled={!!updatingStr}
                    />
                </div>

                {/* Trial Period */}
                <div className="space-y-3 p-4 bg-secondary/10 rounded-xl border border-secondary/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Timer className="w-4 h-4 text-primary" />
                        <Label className="font-bold">Tempoh Percubaan 'Akaun' (Hari)</Label>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            value={trialDays}
                            onChange={(e) => setTrialDays(e.target.value)}
                            className="bg-white"
                        />
                        <Button onClick={handleSaveTrial} disabled={!!updatingStr} className="shrink-0">
                            {updatingStr === 'trial' ? <Loader2 className="animate-spin" /> : "Simpan"}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Tempoh akses percuma untuk pengguna baru sebelum perlu melanggan.</p>
                </div>
            </CardContent>
        </Card>
    )
}

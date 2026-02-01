"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { getPaymentMode, updatePaymentMode } from "@/actions/settings"

export function PaymentSettings() {
    const [mode, setMode] = useState<"sandbox" | "real">("sandbox")
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            const currentMode = await getPaymentMode()
            setMode(currentMode as "sandbox" | "real")
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (checked: boolean) => {
        const newMode = checked ? "real" : "sandbox"
        setUpdating(true)
        // Optimistic update
        setMode(newMode)

        try {
            await updatePaymentMode(newMode)
            toast.success(`Mod pembayaran dikemaskini kepada: ${newMode.toUpperCase()}`)
        } catch (e: any) {
            toast.error("Gagal mengemaskini tetapan")
            setMode(mode) // Revert
        } finally {
            setUpdating(false)
        }
    }

    if (loading) return <div className="p-4"><Loader2 className="animate-spin" /></div>

    return (
        <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
            <CardHeader className="pb-2">
                <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Tetapan Sistem</CardDescription>
                <CardTitle className="text-xl font-serif font-bold">Gerbang Pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between space-x-2 bg-secondary/20 p-4 rounded-xl">
                    <div className="space-y-1">
                        <Label htmlFor="payment-mode" className="font-bold flex items-center gap-2">
                            {mode === 'real' ? 'Mod LIVE (Billplz)' : 'Mod SANDBOX (Chip-In)'}
                            {updating && <Loader2 className="h-3 w-3 animate-spin" />}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            {mode === 'real'
                                ? "Pembayaran sebenar akan diproses."
                                : "Mod ujian. Tiada wang sebenar ditolak."}
                        </p>
                    </div>
                    <Switch
                        id="payment-mode"
                        checked={mode === 'real'}
                        onCheckedChange={handleToggle}
                        disabled={updating}
                    />
                </div>
            </CardContent>
        </Card>
    )
}

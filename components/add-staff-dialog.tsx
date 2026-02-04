"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus, Loader2, AlertCircle } from "lucide-react"
import { createStaffAccount } from "@/actions/admin"
import { toast } from "sonner"

interface AddStaffDialogProps {
    currentStaffCount?: number
    maxStaff?: number
    organizerCode?: string | null
}

export function AddStaffDialog({ currentStaffCount = 0, maxStaff = 2, organizerCode }: AddStaffDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    
    const hasReachedLimit = currentStaffCount >= maxStaff

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        
        if (hasReachedLimit) {
            toast.error(`Had maksimum ${maxStaff} staf telah dicapai.`)
            return
        }
        
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        
        // Add organizer code if provided
        if (organizerCode) {
            formData.append('organizerCode', organizerCode)
        }

        try {
            const result = await createStaffAccount(formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(result.message)
                setOpen(false)
            }
        } catch (err) {
            toast.error("Ralat tidak dijangka.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                className="rounded-full text-xs font-bold bg-primary text-primary-foreground"
                disabled={hasReachedLimit}
            >
                <UserPlus className="w-3 h-3 mr-2" /> 
                {hasReachedLimit ? `Had ${maxStaff} Staf` : "Tambah Staf"}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px] bg-white border-border rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Tambah Staf Baru</DialogTitle>
                        <DialogDescription>
                            Cipta akaun untuk staf. Mereka boleh log masuk menggunakan emel ini.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {hasReachedLimit && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Had maksimum {maxStaff} staf telah dicapai.</span>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="fullName">Nama Penuh</Label>
                            <Input id="fullName" name="fullName" placeholder="Ahmad Albab" required className="rounded-lg" disabled={hasReachedLimit} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Emel</Label>
                            <Input id="email" name="email" type="email" placeholder="staf@permit.com" required className="rounded-lg" disabled={hasReachedLimit} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Kata Laluan Sementara</Label>
                            <Input id="password" name="password" type="password" placeholder="******" required className="rounded-lg" disabled={hasReachedLimit} />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={loading || hasReachedLimit} className="w-full rounded-lg">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cipta Akaun"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}

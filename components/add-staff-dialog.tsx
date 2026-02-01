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
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus, Loader2 } from "lucide-react"
import { createStaffAccount } from "@/actions/admin"
import { toast } from "sonner"

export function AddStaffDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)

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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-full text-xs font-bold bg-primary text-primary-foreground">
                    <UserPlus className="w-3 h-3 mr-2" /> Tambah Staf
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white border-border rounded-xl">
                <DialogHeader>
                    <DialogTitle className="font-serif">Tambah Staf Baru</DialogTitle>
                    <DialogDescription>
                        Cipta akaun untuk staf. Mereka boleh log masuk menggunakan emel ini.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="fullName">Nama Penuh</Label>
                        <Input id="fullName" name="fullName" placeholder="Ahmad Albab" required className="rounded-lg" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Emel</Label>
                        <Input id="email" name="email" type="email" placeholder="staf@permit.com" required className="rounded-lg" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Kata Laluan Sementara</Label>
                        <Input id="password" name="password" type="password" placeholder="******" required className="rounded-lg" />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full rounded-lg">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cipta Akaun"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

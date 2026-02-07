"use client"

import { useActionState } from "react"
// @ts-ignore - useActionState might be in react-dom in some versions or called useFormState
import { useFormStatus } from "react-dom"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, CreditCard } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { login } from "@/actions/auth"
import { useEffect } from "react"

const initialState = {
  error: "",
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 text-md rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Sedang Memproses...
        </>
      ) : (
        "Log Masuk"
      )}
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, initialState)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Card className="w-full max-w-md bg-white border-border shadow-2xl rounded-3xl overflow-hidden">
      <CardHeader className="text-center space-y-2 pt-10 pb-6 bg-secondary/20 border-b border-border/30">
        <div className="relative w-48 h-20 mx-auto mb-2">
          <Image
            src="https://permitakaun.kumim.my/logo.png"
            alt="Permit Akaun"
            fill
            className="object-contain"
            priority
          />
        </div>
        <p className="text-muted-foreground font-medium">Sistem Pengurusan Bersepadu</p>
      </CardHeader>
      <CardContent className="space-y-6 p-8">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Emel</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="nama@contoh.com"
              className="border-input focus:ring-primary/50 bg-white h-12 rounded-xl"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Kata Laluan</Label>
              <button
                type="button"
                className="text-xs text-primary font-semibold hover:underline"
                onClick={() => toast.info("Sila hubungi admin untuk set semula kata laluan.")}
              >
                Lupa kata laluan?
              </button>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="border-input focus:ring-primary/50 bg-white h-12 rounded-xl"
              required
            />
          </div>

          <SubmitButton />
        </form>

        <div className="text-center pt-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Belum ada akaun? <Link href="/signup" className="text-primary font-bold hover:underline">Daftar Sekarang</Link>
          </p>

          {/* Public Payment Link */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">
              Ingin membuat bayaran sewa tanpa daftar akaun?
            </p>
            <Link 
              href="/bayar" 
              className="inline-flex items-center text-sm text-blue-600 font-bold hover:underline"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Bayar Sewa Tapak
            </Link>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}

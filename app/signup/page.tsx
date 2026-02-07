"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, ArrowLeft, Upload, FileText } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { sendWelcomeEmailAction } from "@/actions/email"

export default function SignupPage() {

  const [role, setRole] = useState<'tenant' | 'organizer'>('tenant')

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    businessName: "",
    phone: "",
    ssmNumber: "",
    icNumber: "",
    address: ""
  })

  // Files and organizer code removed - can be added later in Tetapan

  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      toast.error("Sila isi maklumat wajib (Emel, Kata Laluan, Nama Penuh)")
      return
    }

    setLoading(true)

    try {
      // 1. Sign Up with Metadata
      // This triggers the database function to create Profile AND Tenant/Organizer records simultaneously
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            business_name: formData.businessName,
            phone_number: formData.phone,
            ssm_number: formData.ssmNumber,
            ic_number: formData.icNumber,
            address: formData.address,
            role: role // Pass the selected role
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Send Welcome Email
        await sendWelcomeEmailAction(formData.email, formData.fullName)

        toast.success("Pendaftaran berjaya! Akaun anda sedang menunggu pengesahan admin.")
        router.push("/")
      }

    } catch (err: any) {
      toast.error("Ralat pendaftaran: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4 py-8">
      <Card className="w-full max-w-2xl bg-white border-border shadow-2xl rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <CardHeader className="text-center space-y-2 pt-8 pb-6 bg-secondary/20 border-b border-border/30 relative">
          <Link href="/" className="absolute left-6 top-6 text-muted-foreground hover:text-primary">
            <ArrowLeft size={24} />
          </Link>
          <div className="relative w-40 h-16 mx-auto mb-2">
            <Image
              src="https://permitakaun.kumim.my/logo.png"
              alt="Permit Akaun"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-xl font-serif font-bold text-foreground">
            Pendaftaran {role === 'tenant' ? 'Peniaga' : 'Penganjur'} Baru
          </h2>
        </CardHeader>
        <CardContent className="space-y-6 p-8">
          {/* Role Selection Tabs */}
          <div className="flex p-1 bg-secondary/20 rounded-xl mb-6">
            <button
              onClick={() => setRole('tenant')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${role === 'tenant'
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Peniaga (Tenant)
            </button>
            <button
              onClick={() => setRole('organizer')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${role === 'organizer'
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Penganjur (Organizer)
            </button>
          </div>

          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Penuh (Seperti IC) *</Label>
                <Input
                  id="fullName"
                  className="border-input rounded-xl h-11"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icNumber">No. Kad Pengenalan</Label>
                <Input
                  id="icNumber"
                  className="border-input rounded-xl h-11"
                  value={formData.icNumber}
                  onChange={(e) => setFormData({ ...formData, icNumber: e.target.value })}
                  placeholder="Contoh: 880101-14-1234"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">No. Telefon</Label>
                <Input
                  id="phone"
                  className="border-input rounded-xl h-11"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="012-3456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssmNumber">No. SSM (Jika ada)</Label>
                <Input
                  id="ssmNumber"
                  className="border-input rounded-xl h-11"
                  value={formData.ssmNumber}
                  onChange={(e) => setFormData({ ...formData, ssmNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Nama Perniagaan (Syarikat/Gerai)</Label>
              <Input
                id="businessName"
                className="border-input rounded-xl h-11"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat Surat Menyurat</Label>
              <Input
                id="address"
                className="border-input rounded-xl h-11"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Contoh: No 123, Jalan ABC, 50000 KL"
              />
            </div>

            {/* Note: Kod Penganjur removed - can be added later in Tetapan */}


            {/* Documents Note - Hidden on signup, can be added later */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
              <h3 className="font-bold text-sm text-amber-800 flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" /> Dokumen Diperlukan
              </h3>
              <p className="text-xs text-amber-700 mb-2">
                Sila sediakan dokumen berikut untuk disemak oleh admin:
              </p>
              <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
                <li>Salinan SSM (jika berdaftar)</li>
                <li>Salinan Kad Pengenalan</li>
                {role === 'tenant' && <li>Kod Penganjur (jika ada)</li>}
              </ul>
              <p className="text-xs text-amber-700 mt-2 font-medium">
                Anda boleh muat naik dokumen ini nanti di Tetakan &gt; Profil Saya.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Emel *</Label>
                <Input
                  id="email"
                  type="email"
                  className="border-input rounded-xl h-11"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Laluan *</Label>
                <Input
                  id="password"
                  type="password"
                  className="border-input rounded-xl h-11"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 text-md rounded-xl shadow-lg shadow-primary/25 mt-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Daftar Akaun"}
          </Button>

          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              Sudah ada akaun? <Link href="/" className="text-primary font-bold hover:underline">Log Masuk</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
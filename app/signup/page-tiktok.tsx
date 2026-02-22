"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, ArrowLeft, Upload, FileText, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { sendWelcomeEmailAction } from "@/actions/email"

export default function SignupPage() {

  const [role, setRole] = useState<'tenant' | 'organizer'>('tenant')

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    organizerCode: ""
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

    // Strict Validation: Alphabets, space, and slash only
    const nameRegex = /^[A-Za-z\s\/]+$/
    if (!nameRegex.test(formData.fullName)) {
      toast.error("Nama Penuh hanya boleh mengandungi Huruf, Ruang (Space), dan Slash (/) sahaja.")
      return
    }

    setLoading(true)

    try {
      console.log('[Signup] Starting signup with role:', role)
      
      // 1. Sign Up with Metadata
      // This triggers the database function to create Profile AND Tenant/Organizer records simultaneously
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone_number: formData.phone,
            organizer_code: formData.organizerCode,
            role: role // Pass the selected role
          }
        }
      })

      console.log('[Signup] Auth response:', { user: authData.user?.id, error: authError })

      if (authError) {
        console.error('[Signup] Auth error:', authError)
        throw authError
      }

      if (authData.user) {
        let newOrgCode = undefined
        if (role === 'organizer') {
          // Fetch the generated organizer code that the trigger just created
          console.log('[Signup] Fetching organizer code for:', formData.email)
          const { data: orgData, error: orgError } = await supabase.from('organizers').select('organizer_code').eq('email', formData.email).maybeSingle()
          console.log('[Signup] Organizer data:', orgData, 'Error:', orgError)
          newOrgCode = orgData?.organizer_code
        }

        // Send Welcome Email
        await sendWelcomeEmailAction(formData.email, formData.fullName, newOrgCode)

        toast.success("Pendaftaran berjaya! Akaun anda sedang menunggu pengesahan admin.")
        router.push("/")
      }

    } catch (err: any) {
      console.error('[Signup] Error:', err)
      toast.error("Ralat pendaftaran: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-secondary/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/5 to-transparent -z-10" />
      <div className="container mx-auto px-4 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left - Form */}
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 text-sm">
              <ArrowLeft size={16} />
              Kembali ke Laman Utama
            </Link>

            <div className="relative w-40 h-16 mb-4">
              <Image
                src="https://permitakaun.kumim.my/logo.png"
                alt="Permit Akaun"
                fill
                className="object-contain"
                priority
              />
            </div>

            <h1 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-2 tracking-tight">
              Pendaftaran {role === 'tenant' ? 'Pengguna' : 'Penganjur'} Baru
            </h1>
            <p className="text-muted-foreground mb-8">Daftar akaun percuma dan mula urus perniagaan anda.</p>

            {/* Role Selection Tabs */}
            <div className="flex p-1 bg-white/60 rounded-xl mb-6 border border-border/50 max-w-sm">
              <button
                onClick={() => setRole('tenant')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${role === 'tenant'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Pengguna
              </button>
              <button
                onClick={() => setRole('organizer')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${role === 'organizer'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Penganjur
              </button>
            </div>

            <div className="grid gap-4 max-w-lg">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm font-medium">
                  {role === 'tenant' ? 'Nama Penuh (Seperti IC) *' : 'Nama Penuh / Nama Organisasi *'}
                </Label>
                <Input
                  id="fullName"
                  className="border-input rounded-xl h-11 bg-white"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm font-medium">No. Telefon</Label>
                <Input
                  id="phone"
                  className="border-input rounded-xl h-11 bg-white"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="012-3456789"
                />
              </div>
              {role === 'tenant' && (
                <div className="space-y-1.5">
                  <Label htmlFor="organizerCode" className="text-sm font-medium">Kod Penganjur (Jika Ada)</Label>
                  <Input
                    id="organizerCode"
                    className="border-input rounded-xl h-11 bg-white"
                    value={formData.organizerCode}
                    onChange={(e) => setFormData({ ...formData, organizerCode: e.target.value })}
                    placeholder="Contoh: ORG123"
                  />
                </div>
            )}
          </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Emel *</Label>
                  <Input
                    id="email"
                    type="email"
                    className="border-input rounded-xl h-11 bg-white"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium">Kata Laluan *</Label>
                  <Input
                    id="password"
                    type="password"
                    className="border-input rounded-xl h-11 bg-white"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <Button
                onClick={handleSignup}
                disabled={loading}
                className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-bold h-12 text-md rounded-xl shadow-xl shadow-brand-blue/25"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Daftar Akaun Sekarang"}
              </Button>

              <p className="text-sm text-muted-foreground">
                Sudah ada akaun? <Link href="/login" className="text-brand-blue font-bold hover:underline">Log Masuk</Link>
              </p>

              <div className="bg-blue-50/80 border border-blue-200/50 p-3 rounded-xl">
                <p className="text-xs text-blue-800/80">
                  Nota: Anda boleh mengemaskini maklumat perniagaan dan memuat naik dokumen di <b>Tetapan &gt; Profil Saya</b> selepas mendaftar.
                </p>
              </div>
            </div>
          </div>

          {/* Right - Videos & Testimonials */}
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-8 duration-1000">
            {/* Testimonials */}
            <div className="space-y-3">
              <h3 className="text-lg font-serif font-bold text-foreground">Apa kata pengguna kami</h3>
              <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
                <p className="text-sm text-foreground italic mb-2">&ldquo;Dulu saya guna buku tulis, selalu silap kira. Sekarang semua automatik, jimat masa sangat!&rdquo;</p>
                <p className="text-xs font-bold text-brand-blue">— Kak Rina, Peniaga Kuih</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
                <p className="text-sm text-foreground italic mb-2">&ldquo;Sebelum ni pening nak track siapa dah bayar sewa. Permit Akaun selesaikan semua masalah tu.&rdquo;</p>
                <p className="text-xs font-bold text-brand-blue">— Abang Faiz, Penganjur Bazar</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
                <p className="text-sm text-foreground italic mb-2">&ldquo;Baru seminggu guna, dah nampak untung rugi dengan jelas. Tak payah upah akauntan lagi!&rdquo;</p>
                <p className="text-xs font-bold text-brand-blue">— Encik Hafiz, Peniaga Pasar Malam</p>
              </div>
            </div>

            {/* TikTok Videos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="rounded-2xl overflow-hidden shadow-xl border border-border/50 bg-black aspect-[9/16]">
                  <iframe
                    src="https://www.tiktok.com/player/v1/7596695390271933704?autoplay=1&mute=1&loop=1"
                    className="w-full h-full"
                    allow="autoplay"
                    allowFullScreen
                  />
                </div>
              </div>
              <div className="pt-6">
                <div className="rounded-2xl overflow-hidden shadow-xl border border-border/50 bg-black aspect-[9/16]">
                  <iframe
                    src="https://www.tiktok.com/player/v1/7596302888159382792?autoplay=1&mute=1&loop=1"
                    className="w-full h-full"
                    allow="autoplay"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>

            <div className="text-center">
              <a
                href="https://tiktok.com/@permitakaun"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-brand-blue hover:underline"
              >
                <Video className="w-4 h-4" />
                Ikuti @permitakaun di TikTok
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

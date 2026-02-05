"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, 
  Users, 
  Building, 
  Store, 
  Receipt, 
  MapPin, 
  Settings,
  CheckCircle,
  AlertCircle,
  UserPlus,
  FileText,
  CreditCard,
  Activity,
  HelpCircle,
  BookOpen
} from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"

export default function HelpPage() {
  const { role } = useAuth()
  const [activeTab, setActiveTab] = useState(role || "admin")

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="pb-4 border-b border-border/30">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tighter flex items-center gap-3">
            <BookOpen className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            Panduan Penggunaan
          </h1>
          <p className="text-muted-foreground text-lg font-medium">
            Panduan lengkap mengikut peranan pengguna sistem.
          </p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-border/50 p-1 rounded-xl flex-wrap h-auto">
          <TabsTrigger value="admin" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-2" /> Admin
          </TabsTrigger>
          <TabsTrigger value="staff" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" /> Staf
          </TabsTrigger>
          <TabsTrigger value="organizer" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Building className="w-4 h-4 mr-2" /> Penganjur
          </TabsTrigger>
          <TabsTrigger value="tenant" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Store className="w-4 h-4 mr-2" /> Peniaga
          </TabsTrigger>
        </TabsList>

        {/* ADMIN GUIDE */}
        <TabsContent value="admin" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-primary/5 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Keupayaan Admin
                </CardTitle>
                <CardDescription>Admin mempunyai akses penuh ke sistem</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <FeatureItem icon={Building} title="Pengurusan Penganjur" desc="Tambah, edit dan urus penganjur pasar/tapak" />
                <FeatureItem icon={Store} title="Pengurusan Peniaga" desc="Daftar peniaga baru, urus status dan lokasi" />
                <FeatureItem icon={MapPin} title="Pengurusan Lokasi" desc="Tambah lokasi baru, tetapkan kadar sewa" />
                <FeatureItem icon={Receipt} title="Pengurusan Akaun" desc="Rekod transaksi, semak pendapatan dan perbelanjaan" />
                <FeatureItem icon={Users} title="Pengurusan Staf" desc="Tambah staf (maksimum 2), tetapkan akses" />
                <FeatureItem icon={Settings} title="Tetapan Sistem" desc="Konfigurasi pembayaran, backup data" />
              </CardContent>
            </Card>

            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-green-50 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  Aliran Kerja Penting
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <WorkflowItem number="1" title="Tambah Penganjur" desc="Mulakan dengan mendaftar penganjur pasar" />
                <WorkflowItem number="2" title="Tambah Lokasi" desc="Daftarkan lokasi/tapak untuk penganjur" />
                <WorkflowItem number="3" title="Daftar Peniaga" desc="Tambah peniaga dan tetapkan lokasi sewa" />
                <WorkflowItem number="4" title="Rekod Transaksi" desc="Catat bayaran sewa dan perbelanjaan" />
                <WorkflowItem number="5" title="Semak Laporan" desc="Pantau pendapatan dan tunggakan" />
              </CardContent>
            </Card>
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-amber-800 mb-2">Nota Penting</h4>
                  <p className="text-amber-700 text-sm">
                    Admin boleh meluluskan data yang ditambah oleh Staf. Data yang ditambah oleh Staf 
                    akan mempunyai status &quot;Pending&quot; sehingga diluluskan oleh Admin.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STAFF GUIDE */}
        <TabsContent value="staff" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-blue-50 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Users className="w-5 h-5" />
                  Keupayaan Staf
                </CardTitle>
                <CardDescription>Staf membantu Admin mengurus data</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <FeatureItem icon={Building} title="Lihat Penganjur" desc="Semua penganjur milik Admin" />
                <FeatureItem icon={Store} title="Tambah Peniaga" desc="Daftar peniaga baru (status: Pending)" />
                <FeatureItem icon={MapPin} title="Lihat Lokasi" desc="Semua lokasi milik Admin" />
                <FeatureItem icon={Receipt} title="Rekod Transaksi" desc="Catat transaksi (status: Pending)" />
                <FeatureItem icon={FileText} title="Edit Data" desc="Ubah data yang telah direkod" />
                <RestrictedItem icon={Settings} title="Tetapan" desc="Tidak boleh ubah tetapan sistem" />
              </CardContent>
            </Card>

            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-orange-50 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertCircle className="w-5 h-5" />
                  Peraturan Staf
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <RuleItem icon={CheckCircle} text="Staf hanya melihat data Admin mereka sendiri" />
                <RuleItem icon={CheckCircle} text="Data ditambah oleh Staf perlu diluluskan Admin" />
                <RuleItem icon={CheckCircle} text="Staf boleh edit data yang masih Pending" />
                <RuleItem icon={AlertCircle} text="Staf tidak boleh padam data yang telah diluluskan" />
                <RuleItem icon={AlertCircle} text="Maksimum 2 Staf bagi setiap Admin" />
                <RuleItem icon={AlertCircle} text="Staf tidak boleh ubah tetapan kritikal" />
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <HelpCircle className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">Bagaimana Staf Berfungsi?</h4>
                  <p className="text-blue-700 text-sm mb-2">
                    Staf ditugaskan kepada Admin tertentu melalui <strong>organizer_code</strong>.
                  </p>
                  <ul className="text-blue-700 text-sm list-disc list-inside space-y-1">
                    <li>staff@permit.com → Admin: admin@permit.com (ORG001)</li>
                    <li>manjaya.solution@gmail.com → Admin: admin@kumim.my (ORG002)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ORGANIZER GUIDE */}
        <TabsContent value="organizer" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-purple-50 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <Building className="w-5 h-5" />
                  Keupayaan Penganjur
                </CardTitle>
                <CardDescription>Penganjur mengurus peniaga mereka</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <FeatureItem icon={Store} title="Peniaga Saya" desc="Lihat dan urus peniaga di bawah penganjur" />
                <FeatureItem icon={MapPin} title="Lokasi Saya" desc="Urus lokasi/tapak pasar" />
                <FeatureItem icon={Receipt} title="Rekod Kewangan" desc="Catat transaksi sewa" />
                <FeatureItem icon={Activity} title="Laporan" desc="Semak pendapatan dan tunggakan" />
              </CardContent>
            </Card>

            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-purple-100 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <UserPlus className="w-5 h-5" />
                  Pendaftaran Peniaga
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <span>Pergi ke <strong>Peniaga & Sewa</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <span>Klik <strong>Tambah Peniaga</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <span>Isi maklumat peniaga</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <span>Tetapkan lokasi sewa</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TENANT GUIDE */}
        <TabsContent value="tenant" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-green-50 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Store className="w-5 h-5" />
                  Keupayaan Peniaga
                </CardTitle>
                <CardDescription>Peniaga mengurus sewa dan kewangan</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <FeatureItem icon={MapPin} title="Lokasi Saya" desc="Semak lokasi tapak yang disewa" />
                <FeatureItem icon={Receipt} title="Rekod Transaksi" desc="Catat jualan dan perbelanjaan" />
                <FeatureItem icon={CreditCard} title="Bayaran Sewa" desc="Semak status bayaran dan tunggakan" />
                <FeatureItem icon={FileText} title="Dokumen" desc="Muat naik dokumen SSM, sijil makanan" />
              </CardContent>
            </Card>

            <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
              <CardHeader className="bg-green-100 rounded-t-[1.5rem]">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CreditCard className="w-5 h-5" />
                  Cara Bayar Sewa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <span>Pergi ke <strong>Lokasi</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <span>Pilih lokasi yang ingin disewa</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <span>Klik <strong>Sewa Tapak Ini</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <span>Selesaikan pembayaran online</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <FileText className="w-6 h-6 text-green-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-green-800 mb-2">Dokumen Diperlukan</h4>
                  <ul className="text-green-700 text-sm list-disc list-inside space-y-1">
                    <li>Salinan Kad Pengenalan (IC)</li>
                    <li>Sijil SSM (jika berdaftar)</li>
                    <li>Sijil Pengendalian Makanan (untuk peniaga makanan)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper Components
function FeatureItem({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

function RestrictedItem({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-3 opacity-50">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

function WorkflowItem({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
        {number}
      </span>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

function RuleItem({ icon: Icon, text }: { icon: any, text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-orange-500 shrink-0" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

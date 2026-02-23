"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, 
  Lock, 
  Database, 
  CreditCard, 
  Server, 
  Eye,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileKey,
  Globe,
  UserCheck,
  Activity,
  Key
} from "lucide-react"

// FAQ Item Component
function FAQItem({ question, answer, icon: Icon }: { question: string, answer: React.ReactNode, icon: any }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-sm md:text-base">{question}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <div className="pl-11 text-sm text-muted-foreground leading-relaxed">
            {answer}
          </div>
        </div>
      )}
    </div>
  )
}

// Security Feature Card
function SecurityFeature({ 
  icon: Icon, 
  title, 
  description, 
  status 
}: { 
  icon: any, 
  title: string, 
  description: string, 
  status: "aktif" | "pasif" | "info"
}) {
  const statusColors = {
    aktif: "bg-green-100 text-green-700 border-green-200",
    pasif: "bg-amber-100 text-amber-700 border-amber-200",
    info: "bg-blue-100 text-blue-700 border-blue-200"
  }
  
  return (
    <div className="flex items-start gap-4 p-4 bg-white border border-border/50 rounded-xl">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold text-sm">{title}</h4>
          <Badge variant="outline" className={`text-xs ${statusColors[status]}`}>
            {status === "aktif" ? "Aktif" : status === "pasif" ? "Sederhana" : "Info"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  )
}

// Layer Card Component
function LayerCard({ 
  number, 
  title, 
  items, 
  color 
}: { 
  number: string, 
  title: string, 
  items: string[], 
  color: string 
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
    orange: "bg-orange-50 border-orange-200"
  }
  
  return (
    <Card className={`${colors[color]} border`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-bold shadow-sm">
            {number}
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default function SecurityPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header className="pb-4 border-b border-border/30">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tighter flex items-center gap-3">
            <Shield className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            Keselamatan Sistem
          </h1>
          <p className="text-muted-foreground text-lg font-medium">
            Dokumentasi keselamatan dan FAQ untuk rujukan Pihak Berkuasa Tempatan (PBT).
          </p>
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border border-border/50 p-1 rounded-xl flex-wrap h-auto">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-2" /> Overview
          </TabsTrigger>
          <TabsTrigger value="layers" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Server className="w-4 h-4 mr-2" /> Lapisan Keselamatan
          </TabsTrigger>
          <TabsTrigger value="rls" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Database className="w-4 h-4 mr-2" /> RLS
          </TabsTrigger>
          <TabsTrigger value="payment" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" /> Pembayaran
          </TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <HelpCircle className="w-4 h-4 mr-2" /> FAQ
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-medium">Tahap Keselamatan</p>
                    <p className="text-2xl font-bold text-green-800">TINGGI</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 font-medium">Enkripsi</p>
                    <p className="text-2xl font-bold text-blue-800">AES-256</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <FileKey className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-700 font-medium">Pengesahan</p>
                    <p className="text-2xl font-bold text-purple-800">JWT + bcrypt</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Features */}
          <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Ciri-ciri Keselamatan Utama
              </CardTitle>
              <CardDescription>Sistem dilindungi oleh pelbagai lapisan keselamatan</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <SecurityFeature 
                icon={Lock}
                title="Row Level Security (RLS)"
                description="Kawalan akses di peringkat database - pengguna hanya lihat data sendiri"
                status="aktif"
              />
              <SecurityFeature 
                icon={UserCheck}
                title="Role-Based Access Control"
                description="Hierarki akses: Superadmin → Admin → Staff → Organizer → Tenant"
                status="aktif"
              />
              <SecurityFeature 
                icon={Globe}
                title="SSL/TLS Encryption"
                description="Semua data dihantar menggunakan HTTPS/TLS 1.3"
                status="aktif"
              />
              <SecurityFeature 
                icon={Database}
                title="Encryption at Rest"
                description="Data dalam pangkalan data dienkripsi dengan AES-256"
                status="aktif"
              />
              <SecurityFeature 
                icon={Eye}
                title="Protection Against Crawling"
                description="Tiada public API, semua akses memerlukan pengesahan"
                status="aktif"
              />
              <SecurityFeature 
                icon={Activity}
                title="Audit Logging"
                description="Semua aktiviti direkod untuk tujuan audit"
                status="aktif"
              />
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-green-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Sijil Keselamatan Infrastruktur</h4>
                  <p className="text-slate-700 text-sm mb-3">
                    Sistem dihoskan di platform yang mempunyai sijil keselamatan antarabangsa:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-white">SOC 2 Type 2</Badge>
                    <Badge variant="outline" className="bg-white">ISO 27001</Badge>
                    <Badge variant="outline" className="bg-white">GDPR Compliant</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LAYERS TAB */}
        <TabsContent value="layers" className="space-y-6">
          <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Arsitektur 4 Lapisan Keselamatan
              </CardTitle>
              <CardDescription>
                Sistem menggunakan konsep &quot;Defense in Depth" dengan pelbagai lapisan perlindungan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <LayerCard 
                  number="1"
                  title="Lapisan Aplikasi (Next.js)"
                  color="blue"
                  items={[
                    "Server Components (SSR)",
                    "Route Protection via Middleware",
                    "Form Validation (Zod Schema)",
                    "XSS Protection (React auto-escape)"
                  ]}
                />
                <LayerCard 
                  number="2"
                  title="Lapisan Pengesahan (Supabase Auth)"
                  color="green"
                  items={[
                    "JWT Token-based Authentication",
                    "Session Management",
                    "Password Hashing (bcrypt)",
                    "Automatic Token Rotation"
                  ]}
                />
                <LayerCard 
                  number="3"
                  title="Lapisan Data Access (RLS)"
                  color="purple"
                  items={[
                    "Database-level access control",
                    "Role-based data visibility",
                    "Cross-tenant isolation",
                    "Policy-based permissions"
                  ]}
                />
                <LayerCard 
                  number="4"
                  title="Lapisan Pangkalan Data"
                  color="orange"
                  items={[
                    "PostgreSQL with SSL",
                    "Encrypted at Rest (AES-256)",
                    "SSL/TLS in Transit",
                    "Automated Backups"
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          {/* Protection Against Attacks */}
          <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Proteksi Serangan Siber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { attack: "SQL Injection", protection: "Parameterized queries + RLS", status: "Dilindungi" },
                  { attack: "Cross-Site Scripting (XSS)", protection: "React auto-escape + CSP", status: "Dilindungi" },
                  { attack: "CSRF", protection: "SameSite cookies + token validation", status: "Dilindungi" },
                  { attack: "Clickjacking", protection: "X-Frame-Options header", status: "Dilindungi" },
                  { attack: "Session Hijacking", protection: "httpOnly cookies + secure flag", status: "Dilindungi" },
                  { attack: "Brute Force", protection: "Rate limiting (Supabase)", status: "Dilindungi" },
                  { attack: "Data Crawling", protection: "RLS + Auth required", status: "Dilindungi" },
                  { attack: "DDoS", protection: "Vercel Edge Network protection", status: "Dilindungi" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{item.attack}</p>
                      <p className="text-xs text-muted-foreground">{item.protection}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{item.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RLS TAB */}
        <TabsContent value="rls" className="space-y-6">
          <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Apa itu Row Level Security (RLS)?
              </CardTitle>
              <CardDescription>
                RLS adalah ciri keselamatan PostgreSQL yang mengawal akses data di peringkat baris (row)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  <strong>Definisi:</strong> Row Level Security (RLS) memastikan pengguna HANYA dapat melihat 
                  dan mengubah data yang mereka ada hak akses - walaupun mereka cuba akses secara terus ke database.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-semibold">Jadual</th>
                      <th className="text-left py-3 px-2 font-semibold">Dasar Keselamatan</th>
                      <th className="text-left py-3 px-2 font-semibold">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-3 px-2 font-medium">profiles</td>
                      <td className="py-3 px-2">Self read/update + Admin full</td>
                      <td className="py-3 px-2 text-muted-foreground">Pengguna hanya boleh lihat/ubah profil sendiri</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-2 font-medium">tenants</td>
                      <td className="py-3 px-2">Self + Organizer linked + Admin</td>
                      <td className="py-3 px-2 text-muted-foreground">Peniaga lihat data sendiri sahaja</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-2 font-medium">locations</td>
                      <td className="py-3 px-2">Organizer own + Admin/Staff</td>
                      <td className="py-3 px-2 text-muted-foreground">Organizer hanya lihat lokasi sendiri</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-2 font-medium">organizer_transactions</td>
                      <td className="py-3 px-2">Tenant own + Organizer + Admin</td>
                      <td className="py-3 px-2 text-muted-foreground">Kawalan akses transaksi kewangan</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-2 font-medium">tenant_payments</td>
                      <td className="py-3 px-2">Tenant own + Admin/Staff</td>
                      <td className="py-3 px-2 text-muted-foreground">Peniaga hanya lihat bayaran sendiri</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Role Hierarchy */}
          <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Hierarki Peranan (Role Hierarchy)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { role: "SUPERADMIN", access: "Akses penuh ke semua data dan tetapan sistem", color: "bg-red-100 text-red-700" },
                  { role: "ADMIN", access: "Lihat/Ubah data organisasi, lokasi, peniaga, transaksi", color: "bg-purple-100 text-purple-700" },
                  { role: "STAFF", access: "Lihat data (read-only), Cipta kemas kini rekod (perlu kelulusan)", color: "bg-blue-100 text-blue-700" },
                  { role: "ORGANIZER", access: "Lihat lokasi sendiri, peniaga berkaitan, transaksi sendiri", color: "bg-amber-100 text-amber-700" },
                  { role: "TENANT", access: "Lihat profil sendiri sahaja, lokasi yang disewa, sejarah transaksi", color: "bg-green-100 text-green-700" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <Badge className={`${item.color} font-bold shrink-0`}>{item.role}</Badge>
                    <span className="text-sm">{item.access}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENT TAB */}
        <TabsContent value="payment" className="space-y-6">
          <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Keselamatan Pembayaran
              </CardTitle>
              <CardDescription>
                Sistem menggunakan gateway pembayaran yang disahkan dengan tahap keselamatan tinggi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Gateways */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border border-border/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Billplz</h4>
                      <Badge className="bg-green-100 text-green-700">Production Ready</Badge>
                    </div>
                  </div>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      API Key + X-Signature verification
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Callback verification
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      PCI DSS compliant
                    </li>
                  </ul>
                </div>

                <div className="p-4 border border-border/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Key className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Chip-in Asia</h4>
                      <Badge className="bg-amber-100 text-amber-700">Sandbox/Test</Badge>
                    </div>
                  </div>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Bearer Token authentication
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      SSL/TLS encryption
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Secure redirect handling
                    </li>
                  </ul>
                </div>
              </div>

              {/* Security Flow */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Aliran Keselamatan Pembayaran
                </h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <span><strong>Permintaan Bayaran</strong> - Diolah di server (bukan browser)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <span><strong>API Keys</strong> - Disimpan di environment variables (bukan kode)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <span><strong>Callback Verification</strong> - Gateway hantar callback, sistem sahkan status</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <span><strong>Idempotency Check</strong> - Elak duplikasi pembayaran</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">5</span>
                    <span><strong>Data Sensitif</strong> - Tiada info kad kredit disimpan, hanya reference ID</span>
                  </li>
                </ol>
              </div>

              {/* X-Signature */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <h4 className="font-semibold text-green-800 mb-2">X-Signature Verification (Billplz)</h4>
                <p className="text-sm text-green-700">
                  Setiap callback dari Billplz disahkan menggunakan X-Signature untuk memastikan 
                  datanya sah dan bukan dari pihak ketiga yang tidak dibenarkan.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ TAB */}
        <TabsContent value="faq" className="space-y-6">
          <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                Soalan Lazim (FAQ) Keselamatan
              </CardTitle>
              <CardDescription>
                Jawapan kepada soalan lazim berkaitan keselamatan sistem untuk rujukan PBT
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <FAQItem 
                  icon={AlertTriangle}
                  question="Bolehkah sistem ini di-hack?"
                  answer={
                    <div className="space-y-2">
                      <p>
                        <strong>Tiada sistem yang 100% selamat</strong>, tetapi risiko adalah <strong>MINIMUM</strong> kerana:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Defense in Depth</strong> - Pelbagai lapisan keselamatan</li>
                        <li><strong>Zero Trust</strong> - Setiap request disahkan</li>
                        <li><strong>Principle of Least Privilege</strong> - Akses minimum diberikan</li>
                        <li><strong>Regular Updates</strong> - Dependency sentiasa dikemaskini</li>
                        <li><strong>Managed Infrastructure</strong> - Vercel & Supabase ada security team</li>
                      </ul>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Eye}
                  question="Bolehkah data kami dicuri oleh pihak ketiga?"
                  answer={
                    <div className="space-y-2">
                      <p>
                        <strong>SUKAR</strong> untuk data dicuri kerana:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>RLS (Row Level Security)</strong> - Walaupun database diakses, data tetap terhad kepada pengguna berkenaan</li>
                        <li><strong>Enkripsi AES-256</strong> - Data dienkripsi semasa rehat (at rest)</li>
                        <li><strong>Tiada data sensitif dalam kod</strong> - API keys disimpan dalam environment variables</li>
                        <li><strong>Akses database terhad</strong> - IP whitelist untuk akses database</li>
                        <li><strong>SSL/TLS</strong> - Semua data dihantar dalam format terenkripsi</li>
                      </ul>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Globe}
                  question="Bolehkah data kami di-crawl atau di-scrape oleh bot?"
                  answer={
                    <div className="space-y-2">
                      <p>
                        <strong>SUKAR</strong> untuk data di-crawl kerana:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Tiada Public API Endpoint</strong> - Semua API memerlukan pengesahan (authenticated)</li>
                        <li><strong>RLS Menghalang Akses Tanpa Auth</strong> - Walaupun crawler ada URL, data tak boleh diakses tanpa login</li>
                        <li><strong>Server-Side Rendering (SSR)</strong> - Data diolah di server, bukan dihantar sebagai JSON</li>
                        <li><strong>Middleware Protection</strong> - Halaman /dashboard dan /admin dilindungi</li>
                        <li><strong>No Sensitive Data in URL</strong> - ID di-encode, tiada email/IC dalam URL</li>
                      </ul>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Database}
                  question="Bagaimana dengan backup dan disaster recovery?"
                  answer={
                    <div className="space-y-2">
                      <p><strong>Backup Schedule:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Automated Daily Backup: 00:00 UTC</li>
                        <li>Point-in-Time Recovery: 7 hari</li>
                        <li>Retention Period: 30 hari</li>
                      </ul>
                      <p className="mt-2"><strong>Recovery Objectives:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Recovery Time Objective (RTO): &lt; 4 jam</li>
                        <li>Recovery Point Objective (RPO): &lt; 24 jam</li>
                      </ul>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Lock}
                  question="Adakah data pembayaran selamat?"
                  answer={
                    <div className="space-y-2">
                      <p>
                        <strong>Ya, data pembayaran sangat selamat kerana:</strong>
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Tiada info kad kredit disimpan</strong> - Hanya reference ID disimpan</li>
                        <li><strong>Gateway berlesen</strong> - Billplz adalah gateway pembayaran berlesen di Malaysia</li>
                        <li><strong>X-Signature Verification</strong> - Setiap callback disahkan</li>
                        <li><strong>PCI DSS Compliant</strong> - Mematuhi standard keselamatan pembayaran</li>
                        <li><strong>Idempotency Check</strong> - Elak duplikasi transaksi</li>
                      </ul>
                    </div>
                  }
                />

                <FAQItem 
                  icon={UserCheck}
                  question="Siapa yang boleh akses data kami?"
                  answer={
                    <div className="space-y-2">
                      <p><strong>Akses data adalah terhad mengikut peranan:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Peniaga (Tenant)</strong> - Hanya lihat data sendiri</li>
                        <li><strong>Organizer</strong> - Lihat peniaga di bawah mereka sahaja</li>
                        <li><strong>Staff</strong> - Lihat data organisasi mereka (read-only)</li>
                        <li><strong>Admin</strong> - Lihat semua data dalam organisasi mereka</li>
                        <li><strong>Superadmin</strong> - Akses penuh ke semua data</li>
                      </ul>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Ini dikawal oleh <strong>Row Level Security (RLS)</strong> di peringkat database.
                      </p>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Key}
                  question="Bagaimana dengan pengesahan pengguna (authentication)?"
                  answer={
                    <div className="space-y-2">
                      <p><strong>Sistem menggunakan:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>JWT (JSON Web Tokens)</strong> - Token-based authentication</li>
                        <li><strong>bcrypt Password Hashing</strong> - Kata laluan di-hash (bukan disimpan sebagai teks)</li>
                        <li><strong>httpOnly Cookies</strong> - Session token tidak boleh diakses oleh JavaScript</li>
                        <li><strong>Automatic Token Rotation</strong> - Refresh token ditukar secara automatik</li>
                        <li><strong>Session Timeout</strong> - Logout automatik selepas tidak aktif</li>
                      </ul>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Server}
                  question="Di mana data kami disimpan?"
                  answer={
                    <div className="space-y-2">
                      <p><strong>Infrastruktur:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Database:</strong> Supabase (PostgreSQL) - SOC 2 Type 2, ISO 27001 certified</li>
                        <li><strong>Frontend:</strong> Vercel - SOC 2 Type 2 certified</li>
                        <li><strong>Storage:</strong> Supabase Storage - AES-256 encryption</li>
                      </ul>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Semua platform mempunyai sijil keselamatan antarabangsa dan 
                        pasukan keselamatan khusus (dedicated security teams).
                      </p>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Activity}
                  question="Adakah aktiviti pengguna direkod (audit trail)?"
                  answer={
                    <div className="space-y-2">
                      <p><strong>Ya, sistem merekod:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Login dan logout pengguna</li>
                        <li>Create, Update, Delete operations</li>
                        <li>Transaksi kewangan (organizer_transactions)</li>
                        <li>Perubahan status penting</li>
                        <li>IP address dan timestamp</li>
                      </ul>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Log ini boleh diakses melalui halaman <strong>Logs</strong> untuk tujuan audit.
                      </p>
                    </div>
                  }
                />

                <FAQItem 
                  icon={Shield}
                  question="Apakah cadangan untuk meningkatkan keselamatan lagi?"
                  answer={
                    <div className="space-y-2">
                      <p><strong>Cadangan penambahbaikan:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Two-Factor Authentication (2FA)</strong> - Tambahan lapisan pengesahan</li>
                        <li><strong>Rate Limiting per User</strong> - Hadkan percubaan login</li>
                        <li><strong>Security Headers (CSP)</strong> - Content Security Policy</li>
                        <li><strong>Automated Security Scanning</strong> - Imbas keselamatan automatik</li>
                        <li><strong>Penetration Testing</strong> - Ujian penembusi oleh pihak ketiga</li>
                        <li><strong>WAF (Web Application Firewall)</strong> - Firewall aplikasi web</li>
                      </ul>
                    </div>
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <HelpCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Perlu Bantuan Lanjut?</h4>
                  <p className="text-muted-foreground text-sm">
                    Jika anda mempunyai soalan keselamatan yang tidak tersenarai di atas, 
                    sila hubungi pembangun applikasi web anda.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

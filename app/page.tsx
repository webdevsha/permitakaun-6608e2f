import Link from "next/link"
import { ArrowRight, CheckCircle2, LayoutDashboard, Calendar, PieChart, ShieldCheck, Facebook, Youtube, Video, Mail, Check, Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 fixed w-full bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <a href="https://permitakaun.kumim.my/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Permit Akaun Logo" className="w-8 h-8 object-contain" />
            <span className="font-serif font-bold text-xl tracking-tight text-foreground">Permit Akaun</span>
          </a>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Log Masuk
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition-colors shadow-lg shadow-brand-blue/20"
            >
              Daftar Akaun
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/5 to-transparent -z-10" />
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold uppercase tracking-wider mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
            Sistem No. 1 Peniaga Kecil
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-foreground mb-6 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700">
            Sistem Pengurusan<br className="hidden md:block" /> Akaun & Acara <span className="text-brand-blue">Untuk Peniaga Kecil</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000">
            Permit Akaun ialah sistem pengurusan akaun dan acara yang direka khas untuk peniaga kecil. Urus rekod bayaran, akaun perniagaan serta pendaftaran acara secara digital dan tersusun—tanpa pening kepala.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-brand-blue text-white rounded-2xl text-lg font-bold hover:bg-brand-blue/90 transition-all hover:scale-105 shadow-xl shadow-brand-blue/25 flex items-center justify-center gap-2"
            >
              Daftar Akaun Sekarang
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white text-foreground border border-border rounded-2xl text-lg font-bold hover:bg-secondary transition-all hover:scale-105 shadow-sm flex items-center justify-center gap-2"
            >
              Log Masuk Sistem
            </Link>
          </div>
        </div>
      </section>

      {/* Problem / Solution Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Masih guna buku, WhatsApp atau Excel?</h2>
            <p className="text-lg text-muted-foreground">
              Permit Akaun membantu anda urus semua dalam satu sistem digital yang kemas dan mudah.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-red-100 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <LayoutDashboard className="w-32 h-32 text-red-500 transform rotate-12" />
              </div>
              <h3 className="text-xl font-bold text-red-600 mb-4">Masalah Biasa</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="mt-1 text-red-500">✕</span> Hilang rekod bayaran pelanggan
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="mt-1 text-red-500">✕</span> Pening kira untung rugi hujung bulan
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="mt-1 text-red-500">✕</span> Pengurusan acara dan peserta yang kucar-kacir
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-lg border border-brand-green/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle2 className="w-32 h-32 text-brand-green transform -rotate-12" />
              </div>
              <h3 className="text-xl font-bold text-brand-green mb-4">Penyelesaian Permit Akaun</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-foreground font-medium">
                  <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
                  Semua rekod disimpan selamat dalam cloud
                </li>
                <li className="flex items-start gap-3 text-foreground font-medium">
                  <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
                  Kira akaun secara automatik
                </li>
                <li className="flex items-start gap-3 text-foreground font-medium">
                  <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
                  Pengurusan peserta acara yang sistematik
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Section */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-border/50 group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
            <img
              src="/landing-banner.jpeg"
              alt="Permit Akaun Banner"
              className="w-full h-[300px] md:h-[400px] lg:h-[500px] object-cover transform group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 z-20 text-white">
              <div className="max-w-3xl">
                <Badge className="bg-brand-blue text-white hover:bg-brand-blue/90 mb-4 border-none text-sm px-3 py-1">
                  Revolusi Digital
                </Badge>
                <h3 className="text-2xl md:text-4xl font-serif font-bold mb-4 leading-tight">
                  Tinggalkan cara lama. <br />
                  <span className="text-brand-green">Mulakan era digital perniagaan anda.</span>
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4">Apa Yang Anda Boleh Buat?</h2>
            <p className="text-muted-foreground text-lg">Sistem lengkap untuk keperluan bisnes kecil anda.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-border hover:border-brand-blue/30 transition-colors shadow-sm hover:shadow-xl hover:shadow-brand-blue/5 group">
              <div className="w-14 h-14 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <PieChart className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-3 group-hover:text-brand-blue transition-colors">Pengurusan Akaun Digital</h3>
              <p className="text-muted-foreground mb-6">
                Permit Akaun memudahkan pengurusan akaun perniagaan kecil dengan rekod bayaran yang kemas.
              </p>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Simpan rekod bayaran</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Semak transaksi mudah</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Elak kesilapan kiraan</li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-border hover:border-brand-blue/30 transition-colors shadow-sm hover:shadow-xl hover:shadow-brand-blue/5 group">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-3 group-hover:text-purple-600 transition-colors">Pengurusan Acara</h3>
              <p className="text-muted-foreground mb-6">
                Sistem pengurusan acara dan pendaftaran yang ringkas. Urus pendaftaran acara dan rekod bayaran peserta.
              </p>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-600" /> Urus pendaftaran peserta</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-600" /> Rekod yuran penyertaan</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-600" /> Pantau status semasa</li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-border hover:border-brand-blue/30 transition-colors shadow-sm hover:shadow-xl hover:shadow-brand-blue/5 group">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-3 group-hover:text-orange-600 transition-colors">Direka Untuk Peniaga Kecil</h3>
              <p className="text-muted-foreground mb-6">
                Sistem akaun ringkas untuk peniaga kecil tanpa perlu kemahiran teknikal yang rumit.
              </p>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-600" /> Paparan mudah (User Friendly)</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-600" /> Tak perlu akauntan</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-600" /> Akses di mana-mana</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-brand-blue text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-12">Kenapa Pilih Permit Akaun?</h2>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-4xl font-bold mb-2">🚀</div>
              <h4 className="text-xl font-bold mb-2">Ringkas & Teratur</h4>
              <p className="text-white/80 text-sm">Sistem digital yang mudah difahami seawal 5 minit.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-4xl font-bold mb-2">⏳</div>
              <h4 className="text-xl font-bold mb-2">Jimat Masa</h4>
              <p className="text-white/80 text-sm">Kurangkan masa mengurus rekod manual setiap hari.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-4xl font-bold mb-2">📱</div>
              <h4 className="text-xl font-bold mb-2">Semua Di Satu Tempat</h4>
              <p className="text-white/80 text-sm">Rekod bayaran, peserta, dan akaun dalam satu app.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-4xl font-bold mb-2">☁️</div>
              <h4 className="text-xl font-bold mb-2">Akses Cloud</h4>
              <p className="text-white/80 text-sm">Boleh akses bila-bila masa menggunakan phone atau laptop.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Section */}
      <section className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4">Pakej Langganan</h2>
            <p className="text-muted-foreground text-lg">Pilih pelan yang sesuai untuk perniagaan anda.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Enterprise */}
            <Card className="relative rounded-[2rem] border-2 border-border shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
              <CardHeader className="text-center pb-2">
                <CardTitle className="font-serif text-2xl">Enterprise</CardTitle>
                <CardDescription>Untuk peniaga kecil yang baru bermula</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <div className="text-center">
                  <p className="text-xs font-bold mb-2 text-emerald-600">(Percuma Dua Minggu)</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-5xl font-bold tracking-tight">RM19</span>
                    <span className="text-xl line-through text-muted-foreground">RM49</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">/bulan</span>
                </div>
                <ul className="space-y-3 text-sm">
                  {["Rekod Jualan & Pembelian", "Simpan resit", "Cashflow", "Balance sheet", "Download laporan kewangan", "Sokongan 1 pengguna"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="rounded-full p-1 bg-primary/10"><Check className="w-3 h-3 text-primary" /></div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs font-bold mb-3 uppercase tracking-wider text-muted-foreground">Pecahan Tabung Akaun</p>
                  <ul className="space-y-3 text-sm">
                    {["Auto kiraan Cukai", "Auto kiraan zakat", "Auto kiraan kos operating"].map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="rounded-full p-1 bg-emerald-500/10"><Check className="w-3 h-3 text-emerald-600" /></div>
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/signup" className="w-full text-center">
                  <Button variant="outline" className="w-full h-12 rounded-xl font-bold text-md shadow-sm">Daftar Sekarang</Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Sdn Bhd */}
            <Card className="relative rounded-[2rem] border-2 border-primary shadow-xl scale-105 z-10 bg-primary text-primary-foreground flex flex-col">
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <Badge className="bg-amber-400 text-black hover:bg-amber-500 border-none px-4 py-1 text-xs uppercase font-bold tracking-widest shadow-sm">
                  <Star className="w-3 h-3 mr-1 fill-black" /> Paling Popular
                </Badge>
              </div>
              <CardHeader className="text-center pb-2">
                <CardTitle className="font-serif text-2xl">Sdn Bhd</CardTitle>
                <CardDescription className="text-primary-foreground/80">Pilihan terbaik untuk perniagaan berkembang</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <div className="text-center">
                  <p className="text-xs font-bold mb-2 text-primary-foreground/80">(Percuma Dua Minggu)</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-5xl font-bold tracking-tight">RM39</span>
                    <span className="text-xl line-through text-primary-foreground/60">RM59</span>
                  </div>
                  <span className="text-sm font-medium text-primary-foreground/60">/bulan</span>
                </div>
                <ul className="space-y-3 text-sm">
                  {["Rekod Jualan & Pembelian", "Simpan resit", "Cashflow", "Balance sheet", "Download laporan kewangan", "Sokongan 1 pengguna", "Analisis untung rugi"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="rounded-full p-1 bg-white/20"><Check className="w-3 h-3 text-white" /></div>
                      <span className="text-primary-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs font-bold mb-3 uppercase tracking-wider text-primary-foreground/80">Pecahan Tabung Akaun</p>
                  <ul className="space-y-3 text-sm">
                    {["Auto kiraan Cukai", "Auto kiraan zakat", "Kos Operating", "Auto kiraan Aset"].map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="rounded-full p-1 bg-white/20"><Check className="w-3 h-3 text-white" /></div>
                        <span className="text-primary-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/signup" className="w-full text-center">
                  <Button variant="secondary" className="w-full h-12 rounded-xl font-bold text-md shadow-sm">Daftar Sekarang</Button>
                </Link>
              </CardFooter>
            </Card>

            {/* SdnBhd / Berhad */}
            <Card className="relative rounded-[2rem] border-2 border-border shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
              <CardHeader className="text-center pb-2">
                <CardTitle className="font-serif text-2xl">SdnBhd/ Berhad</CardTitle>
                <CardDescription>Untuk syarikat atau francais</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <div className="text-center">
                  <div className="h-6 mb-2"></div> {/* Spacer for alignment */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-5xl font-bold tracking-tight">RM99</span>
                    <span className="text-xl line-through text-muted-foreground">RM120</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">/bulan</span>
                </div>
                <ul className="space-y-3 text-sm">
                  {["Semua pakej Sdn bhd", "Dashboard CEO", "Sokongan 2 pengguna akaun", "Sokongan 4 pengguna staff", "Boleh Add On anak syarikat", "Boleh Add inventori", "Analisis Stok/ Produk", "Download laporan kewangan", "7 PECAHAN TABUNG AKAUN"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="rounded-full p-1 bg-primary/10"><Check className="w-3 h-3 text-primary" /></div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <a href="mailto:admin@kumim.my" className="w-full text-center">
                  <Button variant="default" className="w-full h-12 rounded-xl font-bold text-md shadow-sm">Hubungi Kami</Button>
                </a>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="container mx-auto px-4">
          <div className="bg-secondary/50 rounded-[3rem] p-12 md:p-20 text-center border border-border">
            <h2 className="text-4xl md:text-6xl font-serif font-bold text-foreground mb-8">
              Mulakan pengurusan yang<br /> lebih teratur hari ini.
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-10 py-5 bg-brand-blue text-white rounded-2xl text-xl font-bold hover:bg-brand-blue/90 transition-all hover:scale-105 shadow-xl shadow-brand-blue/25"
              >
                Daftar Akaun Percuma
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-10 py-5 bg-white text-foreground border border-border rounded-2xl text-xl font-bold hover:bg-secondary transition-all hover:scale-105 shadow-sm"
              >
                Log Masuk Sistem
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <a href="https://permitakaun.kumim.my/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Permit Akaun Logo" className="w-6 h-6 object-contain" />
            <span className="font-serif font-bold text-lg text-foreground">Permit Akaun</span>
          </a>

          <div className="flex items-center gap-6">
            <a href="https://www.facebook.com/permitakaun" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-600 transition-colors">
              <Facebook className="w-5 h-5" />
            </a>
            <a href="https://www.youtube.com/@permitakaun" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-red-600 transition-colors">
              <Youtube className="w-5 h-5" />
            </a>
            <a href="https://tiktok.com/@permitakaun" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-black transition-colors">
              <Video className="w-5 h-5" />
            </a>
            <a href="mailto:admin@kumim.my" className="text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="w-5 h-5" />
            </a>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Permit Akaun. Hak Cipta Terpelihara.
          </p>
        </div>
      </footer>
    </div>
  )
}

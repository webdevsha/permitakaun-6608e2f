import Link from "next/link"
import { ArrowRight, CheckCircle2, LayoutDashboard, Calendar, PieChart, ShieldCheck } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 fixed w-full bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center">
              <span className="text-white font-serif font-bold text-lg">P</span>
            </div>
            <span className="font-serif font-bold text-xl tracking-tight text-foreground">Permit Akaun</span>
          </div>
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
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-blue flex items-center justify-center">
              <span className="text-white font-serif font-bold text-xs">P</span>
            </div>
            <span className="font-serif font-bold text-lg text-foreground">Permit Akaun</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Permit Akaun. Hak Cipta Terpelihara.
          </p>
        </div>
      </footer>
    </div>
  )
}

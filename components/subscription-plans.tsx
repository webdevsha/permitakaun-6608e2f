"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Check, Lock, Star, Loader2, // Building2, CreditCard, ArrowLeft (removed unused)
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { initiatePayment } from "@/actions/payment"
import { useState } from "react"
import { toast } from "sonner"
// import { ManualSubscriptionPayment } from "./manual-subscription-payment"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function SubscriptionPlans() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const plans = [
    {
      id: "enterprise",
      name: "Enterprise",
      price: "19",
      originalPrice: "29",
      remark: "(Percuma Dua Minggu)",
      description: "Untuk peniaga kecil yang baru bermula",
      features: [
        "Rekod Jualan & Pembelian",
        "Simpan resit",
        "Cashflow",
        "Balance sheet",
        "Download laporan kewangan",
        "Sokongan 1 pengguna"
      ],
      tabungFeatures: [
        "Auto kiraan Cukai",
        "Auto kiraan zakat",
        "Auto kiraan kos operating"
      ],
      popular: false,
      color: "bg-white",
      buttonVariant: "outline" as const,
      buttonText: "Langgan Sekarang",
      isContact: false
    },
    {
      id: "sdn-bhd",
      name: "Sdn Bhd",
      price: "39",
      originalPrice: "59",
      remark: "(Percuma Dua Minggu)",
      description: "Pilihan terbaik untuk perniagaan berkembang",
      features: [
        "Rekod Jualan & Pembelian",
        "Simpan resit",
        "Cashflow",
        "Balance sheet",
        "Download laporan kewangan",
        "Sokongan 1 pengguna",
        "Analisis untung rugi"
      ],
      tabungFeatures: [
        "Auto kiraan Cukai",
        "Auto kiraan zakat",
        "Kos Operating",
        "Auto kiraan Aset"
      ],
      popular: true,
      color: "bg-primary text-primary-foreground",
      buttonVariant: "secondary" as const,
      buttonText: "Langgan Sekarang",
      isContact: false
    },
    {
      id: "sdn-bhd-berhad",
      name: "SdnBhd/ Berhad",
      price: "99",
      originalPrice: "150",
      description: "Untuk syarikat atau francais",
      features: [
        "Semua pakej Sdn bhd",
        "Dashboard CEO",
        "Sokongan 2 pengguna akaun",
        "Sokongan 4 pengguna staff",
        "Boleh Add On anak syarikat",
        "Boleh Add inventori",
        "Analisis Stok/ Produk",
        "Download laporan kewangan",
        "7 PECAHAN TABUNG AKAUN"
      ],
      popular: false,
      color: "bg-white",
      buttonVariant: "default" as const,
      buttonText: "Akan Datang",
      isContact: true
    }
  ]

  const handleSubscribe = async (planName: string, price: string) => {
    setLoadingPlan(planName)
    try {
      const result = await initiatePayment({
        amount: parseFloat(price),
        description: `Langganan Pelan ${planName}`,
        redirectPath: '/dashboard',
        metadata: {
          planType: planName.toLowerCase().includes('premium') ? 'premium' : planName.toLowerCase().includes('standard') ? 'standard' : 'basic',
          isSubscription: true
        }
      })

      if (result.error) throw new Error(result.error)
      if (result.url) {
        toast.success("Mengarahkan ke pembayaran...")
        window.location.href = result.url
      }
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
      setLoadingPlan(null)
    }
  }

  const handlePlanSelect = async (plan: typeof plans[0]) => {
    if (plan.isContact) {
      window.location.href = 'mailto:support@permitakaun.kumim.my?subject=Permintaan Langganan SdnBhd/Berhad'
      return
    }

    // Direct FPX Payment Trigger
    await handleSubscribe(plan.name, plan.price)
  }



  return (
    <div className="space-y-8 py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-sm font-bold border border-amber-200">
          <Lock className="w-4 h-4" />
          <span>Akses Terhad</span>
        </div>
        <h2 className="text-4xl font-serif font-bold tracking-tight">Naik Taraf Akaun Anda</h2>
        <p className="text-xl text-muted-foreground">
          Modul Akaun Profesional dikhaskan untuk pengguna Premium.
          Pilih pelan langganan untuk membuka akses penuh laporan kewangan dan analisis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto pt-6">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative rounded-[2rem] border-2 flex flex-col ${plan.popular
              ? "border-primary shadow-xl scale-105 z-10 " + plan.color
              : "border-border shadow-sm hover:shadow-md transition-shadow bg-white"
              }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <Badge className="bg-amber-400 text-black hover:bg-amber-500 border-none px-4 py-1 text-xs uppercase font-bold tracking-widest shadow-sm">
                  <Star className="w-3 h-3 mr-1 fill-black" /> Paling Popular
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-2xl">{plan.name}</CardTitle>
              <CardDescription className={plan.popular ? "text-primary-foreground/80" : ""}>
                {plan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-6">
              <div className="text-center">
                {/* @ts-ignore */}
                {plan.remark && (
                  <p className={`text-xs font-bold mb-2 ${plan.popular ? "text-primary-foreground/80" : "text-emerald-600"}`}>
                    {/* @ts-ignore */}
                    {plan.remark}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-5xl font-bold tracking-tight">RM{plan.price}</span>
                  {/* @ts-ignore */}
                  {plan.originalPrice && (
                    <span className={`text-xl line-through ${plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {/* @ts-ignore */}
                      RM{plan.originalPrice}
                    </span>
                  )}
                </div>
                <span className={`text-sm font-medium ${plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  /bulan
                </span>
              </div>

              <ul className="space-y-3 text-sm">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className={`rounded-full p-1 ${plan.popular ? "bg-white/20" : "bg-primary/10"}`}>
                      <Check className={`w-3 h-3 ${plan.popular ? "text-white" : "text-primary"}`} />
                    </div>
                    <span className={plan.popular ? "text-primary-foreground/90" : "text-foreground"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* @ts-ignore */}
              {plan.tabungFeatures && (
                <div className="pt-4 border-t border-border/50">
                  <p className={`text-xs font-bold mb-3 uppercase tracking-wider ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    Pecahan Tabung Akaun
                  </p>
                  <ul className="space-y-3 text-sm">
                    {/* @ts-ignore */}
                    {plan.tabungFeatures.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className={`rounded-full p-1 ${plan.popular ? "bg-white/20" : "bg-emerald-500/10"}`}>
                          <Check className={`w-3 h-3 ${plan.popular ? "text-white" : "text-emerald-600"}`} />
                        </div>
                        <span className={plan.popular ? "text-primary-foreground/90" : "text-foreground"}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button
                variant={plan.buttonVariant}
                className="w-full h-12 rounded-xl font-bold text-md shadow-sm"
                onClick={() => handlePlanSelect(plan)}
                disabled={!!loadingPlan && !plan.isContact}
              >
                {loadingPlan === plan.name && !plan.isContact ? <Loader2 className="animate-spin" /> : plan.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="text-center pt-8">
        <p className="text-sm text-muted-foreground">
          Perlukan bantuan memilih? <a href="#" className="text-primary font-bold hover:underline">Hubungi Sokongan</a>
        </p>
      </div>
    </div>
  )
}

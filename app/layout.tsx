import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { AuthProvider } from "@/components/providers/auth-provider"
import { Toaster } from "sonner"
import { GlobalLoader } from "@/components/global-loader"
import { Suspense } from "react"

const _geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const _playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" })

export const metadata: Metadata = {
  title: "Sistem Pengurusan Akaun & Acara | Permit Akaun",
  description: "Sistem pengurusan akaun dan acara untuk peniaga kecil. Urus rekod bayaran, akaun perniagaan dan pendaftaran acara secara digital",
  icons: {
    icon: "https://permitakaun.kumim.my/logo.png",
    shortcut: "https://permitakaun.kumim.my/logo.png",
    apple: "https://permitakaun.kumim.my/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ms">
      <body className={`${_geist.variable} ${_geistMono.variable} ${_playfair.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <Suspense fallback={null}>
            <GlobalLoader />
          </Suspense>
          {children}
          <Toaster />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}

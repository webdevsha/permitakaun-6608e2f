"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function GlobalLoader() {
    const { isLoading, isInitialized } = useAuth()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isNavigating, setIsNavigating] = useState(false)

    // Show loader on initial auth check
    const showLoader = isLoading || !isInitialized || isNavigating

    useEffect(() => {
        // Reset navigation state when path or params change
        setIsNavigating(false)
    }, [pathname, searchParams])

    // Listen for link clicks to show loader during navigation
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const link = target.closest('a')

            if (link && link.href && link.href.startsWith(window.location.origin) && !link.target && !e.ctrlKey && !e.metaKey) {
                // Don't show loader if clicking simple anchors on same page
                const url = new URL(link.href)
                if (url.pathname === window.location.pathname && url.search === window.location.search) return

                setIsNavigating(true)
            }
        }

        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [])

    if (!showLoader) return null

    return (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center transition-all duration-300">
            <div className="bg-card border shadow-lg rounded-2xl p-8 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
                    <div className="relative bg-primary/10 p-4 rounded-full">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                </div>
                <div className="text-center space-y-1">
                    <h3 className="font-serif text-lg font-medium text-foreground">Memuatkan...</h3>
                    <p className="text-xs text-muted-foreground">Sila tunggu sebentar</p>
                </div>
            </div>
        </div>
    )
}

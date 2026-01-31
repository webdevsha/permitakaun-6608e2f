"use client"

import { useState } from "react"
import { AppSidebar, MobileNav } from "@/components/app-sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    return (
        <div className="flex h-screen bg-background font-sans overflow-hidden">
            <AppSidebar
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
                <MobileNav />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scroll-smooth">
                    <div className="max-w-7xl mx-auto space-y-10 pb-20">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}

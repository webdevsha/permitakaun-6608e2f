import { fetchDashboardData } from "@/utils/data/dashboard"
import { createClient } from "@/utils/supabase/server"
import { Users, AlertCircle, TrendingUp, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { RecentTransactions } from "@/components/recent-transactions"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const data = await fetchDashboardData()
  const { role } = data

  if (role === 'organizer') {
    redirect('/dashboard/organizer')
  }

  if (role === 'tenant') {
    redirect('/dashboard/tenant')
  }

  if (role === 'admin' || role === 'staff' || role === 'superadmin') {
    redirect('/admin')
  }

  // Fallback (e.g. if role is missing or something else, though fetchDashboardData defaults to tenant)
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Memuatkan...</p>
    </div>
  )
}

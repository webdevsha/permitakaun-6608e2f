import { DashboardNav } from "@/components/dashboard-nav"
import { AccountingModule } from "@/components/accounting-module"
import { fetchDashboardData } from "@/utils/data/dashboard"

export default async function AccountingPage() {
  const data = await fetchDashboardData()

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto py-6 px-4">
        <AccountingModule initialTransactions={data.transactions} />
      </main>
    </div>
  )
}

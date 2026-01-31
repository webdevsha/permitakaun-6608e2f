import { fetchDashboardData } from "@/utils/data/dashboard"
import DashboardClient from "@/components/dashboard-client"

export default async function DashboardPage() {
  const data = await fetchDashboardData()
  return <DashboardClient initialData={data} serverRole={data.role} />
}

import { fetchDashboardData } from "@/utils/data/dashboard"
import { AccountingModule } from "@/components/accounting-module"

export default async function AccountingPage() {
    const data = await fetchDashboardData()

    return (
        <AccountingModule initialTransactions={data.transactions} tenants={data.tenants} />
    )
}

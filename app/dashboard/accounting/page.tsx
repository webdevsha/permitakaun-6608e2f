import { fetchDashboardData } from "@/utils/data/dashboard"
import { AccountingModule } from "@/components/accounting-module"

export const dynamic = 'force-dynamic'

export default async function AccountingPage() {
    let data
    try {
        data = await fetchDashboardData()
    } catch (e) {
        console.error('[AccountingPage] Error fetching data:', e)
        data = { transactions: [], tenants: [] }
    }

    return (
        <AccountingModule initialTransactions={data.transactions} tenants={data.tenants} />
    )
}

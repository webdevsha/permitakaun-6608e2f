import { fetchDashboardData } from "@/utils/data/dashboard"
import { TenantList } from "@/components/tenant-list"

export default async function TenantsPage() {
    const data = await fetchDashboardData()

    return (
        <TenantList initialTenants={data.tenants} />
    )
}

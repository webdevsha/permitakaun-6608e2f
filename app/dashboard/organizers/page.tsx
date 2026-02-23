import { fetchDashboardData } from "@/utils/data/dashboard"
import { OrganizerModule } from "@/components/organizer-module"

export const dynamic = 'force-dynamic'

export default async function OrganizersPage() {
    const data = await fetchDashboardData()

    return (
        <OrganizerModule initialOrganizers={data.organizers} userRole={data.role} />
    )
}

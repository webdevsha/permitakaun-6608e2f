import { fetchDashboardData } from "@/utils/data/dashboard"
import { OrganizerModule } from "@/components/organizer-module"

export default async function OrganizersPage() {
    const data = await fetchDashboardData()

    return (
        <OrganizerModule initialOrganizers={data.organizers} />
    )
}

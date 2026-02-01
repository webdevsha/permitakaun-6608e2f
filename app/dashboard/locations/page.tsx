import { fetchLocations } from "@/utils/data/dashboard"
import { LocationModule } from "@/components/location-module"

export default async function LocationsPage() {
    const locations = await fetchLocations()

    return (
        <LocationModule initialLocations={locations} />
    )
}

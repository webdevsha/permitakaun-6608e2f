import { fetchLocations } from "@/utils/data/dashboard"
import { LocationModule } from "@/components/location-module"

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server component with direct data fetching and error handling
export default async function LocationsPage() {
    let locations: any[] = []
    
    try {
        // Add timeout at page level too (5 seconds)
        const locationsPromise = fetchLocations()
        const timeoutPromise = new Promise<any[]>((_, reject) => 
            setTimeout(() => reject(new Error('Page timeout')), 5000)
        )
        locations = await Promise.race([locationsPromise, timeoutPromise])
    } catch (error) {
        console.error('[LocationsPage] Error fetching locations:', error)
        // Return empty array on error
        locations = []
    }
    
    return <LocationModule initialLocations={locations} />
}

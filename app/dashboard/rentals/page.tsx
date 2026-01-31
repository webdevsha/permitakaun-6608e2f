import { fetchDashboardData } from "@/utils/data/dashboard"
import { RentalModule } from "@/components/rental-module"
import { Redirect } from "next/navigation" // Wait, it's redirect
import { redirect } from "next/navigation"

export default async function RentalsPage() {
    const data = await fetchDashboardData()

    // Optional: Protect route? 
    // If Admin goes here, do they see something?
    // RentalModule is primarily for Tenants.
    // But maybe Admin wants to see "Rentals" view of a specific tenant? 
    // For now, let's just render it. 

    return (
        <RentalModule
            initialTenant={data.userProfile}
            initialLocations={data.myLocations}
            initialHistory={data.transactions}
            initialAvailable={data.availableLocations}
        />
    )
}

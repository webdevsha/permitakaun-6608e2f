export function determineUserRole(data: any | null, userEmail?: string): string {
    let determinedRole = data?.role ?? 'tenant'

    // Fallback for specific emails if profile is missing or role is tenant
    if (userEmail) {
        if (userEmail === 'admin@permit.com' && determinedRole !== 'admin') determinedRole = 'admin'
        else if (userEmail === 'staff@permit.com' && determinedRole !== 'staff') determinedRole = 'staff'
        else if (userEmail === 'manjaya.solution@gmail.com' && determinedRole !== 'staff') determinedRole = 'staff'
        else if (userEmail === 'organizer@permit.com' && determinedRole !== 'organizer') determinedRole = 'organizer'
        else if (userEmail === 'rafisha92@gmail.com' && determinedRole !== 'superadmin') determinedRole = 'superadmin'
        else if (userEmail === 'admin@kumim.my' && determinedRole !== 'admin') determinedRole = 'admin'
    }

    return determinedRole
}

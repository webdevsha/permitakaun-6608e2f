import { SubscriptionPlans } from "@/components/subscription-plans"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { checkAkaunAccess } from "@/utils/access-control"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SubscriptionPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return (
            <div className="container mx-auto py-10">
                <SubscriptionPlans />
            </div>
        )
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organizer_code, full_name, email')
        .eq('id', user.id)
        .single()
    
    const role = determineUserRole(profile, user.email)
    
    // Check access status
    const access = await checkAkaunAccess(user, role)
    
    const isExpired = access.reason === 'expired'

    return (
        <div className="container mx-auto py-10 space-y-6">
            {/* Trial Expired Warning */}
            {isExpired && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertTitle className="text-red-800 font-bold">Tempoh Percubaan Tamat</AlertTitle>
                    <AlertDescription className="text-red-700">
                        Tempoh percubaan anda telah tamat. Sila langgan untuk terus mengakses ciri-ciri Akaun.
                    </AlertDescription>
                </Alert>
            )}
            
            <SubscriptionPlans />
        </div>
    )
}

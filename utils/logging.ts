import { createClient } from "@/utils/supabase/client"

export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT'
export type ResourceType = 'location' | 'tenant' | 'transaction' | 'organizer' | 'tenant_link'

export async function logAction(
    action: ActionType,
    resource: ResourceType,
    resourceId: string | number,
    details: any
) {
    const supabase = createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('action_logs').insert({
            user_id: user.id,
            action,
            resource,
            resource_id: resourceId.toString(),
            details
        })

        if (error) {
            console.error("Failed to log action:", error)
        }
    } catch (e) {
        console.error("Error logging action:", e)
    }
}

"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"

export async function saveLocationAction(payload: any, locationId?: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Tidak dibenarkan" }

  // Verify caller is organizer/admin/staff
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (!role || !['organizer', 'admin', 'superadmin', 'staff'].includes(role)) {
    return { success: false, error: "Peranan tidak dibenarkan" }
  }

  // For organizer, set organizer_id from their record
  if (role === 'organizer') {
    const { data: orgData } = await supabase
      .from('organizers')
      .select('id')
      .eq('profile_id', user.id)
      .single()
    if (orgData?.id) {
      payload.organizer_id = orgData.id
    }
    payload.status = 'active'
  }

  if (role === 'staff') {
    payload.status = 'pending'
  }

  const admin = createAdminClient()

  try {
    if (locationId) {
      // Update
      const { error } = await admin.from('locations').update(payload).eq('id', locationId)
      if (error) throw error
    } else {
      // Insert
      const { error } = await admin.from('locations').insert(payload)
      if (error) throw error
    }

    revalidatePath('/dashboard/locations')
    return { success: true }
  } catch (e: any) {
    console.error("Error saving location:", e)
    return { success: false, error: e.message }
  }
}

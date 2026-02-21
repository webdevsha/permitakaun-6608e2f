"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"

/**
 * Validate organizer by code and return masked info for tenant confirmation
 */
export async function validateOrganizerAction(organizerCode: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .rpc('validate_organizer_by_code', {
        p_organizer_code: organizerCode
      })

    if (error) throw error

    if (!data || data.length === 0 || !data[0].organizer_exists) {
      return {
        success: false,
        error: "Kod Penganjur tidak sah atau tidak dijumpai"
      }
    }

    const organizer = data[0]
    return {
      success: true,
      data: {
        id: organizer.id,
        name: organizer.name,
        email: organizer.masked_email,
        organizer_code: organizer.organizer_code,
        status: organizer.status
      }
    }
  } catch (error: any) {
    console.error("Error validating organizer:", error)
    return {
      success: false,
      error: error.message || "Ralat semakan penganjur"
    }
  }
}

/**
 * Submit request to link tenant with organizer
 */
export async function requestOrganizerLinkAction(tenantId: number, organizerCode: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .rpc('request_organizer_link', {
        p_tenant_id: tenantId,
        p_organizer_code: organizerCode
      })

    if (error) throw error

    if (!data.success) {
      return {
        success: false,
        error: data.error,
        status: data.status
      }
    }

    revalidatePath('/dashboard/rentals')
    revalidatePath('/dashboard/tenant')
    
    return {
      success: true,
      message: data.message,
      organizer_id: data.organizer_id,
      status: data.status
    }
  } catch (error: any) {
    console.error("Error requesting organizer link:", error)
    return {
      success: false,
      error: error.message || "Gagal menghantar permohonan"
    }
  }
}

/**
 * Get pending tenant requests for organizer/admin
 */
export async function getPendingRequestsAction(organizerId?: string) {
  const supabase = await createClient()

  try {
    let query = supabase
      .from('tenant_organizers')
      .select(`
        *,
        tenants(id, full_name, business_name, phone_number, email, ic_number, profile_image_url),
        organizers(id, name, organizer_code, email)
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })

    // If organizerId provided, filter by that organizer
    if (organizerId) {
      query = query.eq('organizer_id', organizerId)
    }

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data || []
    }
  } catch (error: any) {
    console.error("Error fetching pending requests:", error)
    return {
      success: false,
      error: error.message || "Gagal mengambil senarai permohonan",
      data: []
    }
  }
}

/**
 * Process tenant request (approve or reject)
 */
export async function processTenantRequestAction(
  linkId: number,
  action: 'approve' | 'reject',
  rejectionReason?: string
) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .rpc('process_tenant_request', {
        p_link_id: linkId,
        p_action: action,
        p_rejection_reason: rejectionReason || null
      })

    if (error) throw error

    if (!data.success) {
      return {
        success: false,
        error: data.error
      }
    }

    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard/organizer')
    
    return {
      success: true,
      message: data.message,
      status: data.status
    }
  } catch (error: any) {
    console.error("Error processing tenant request:", error)
    return {
      success: false,
      error: error.message || "Gagal memproses permohonan"
    }
  }
}

/**
 * Get available locations for tenant (from approved organizers only)
 */
export async function getAvailableLocationsAction(tenantId: number) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .rpc('get_available_locations_for_tenant', {
        p_tenant_id: tenantId
      })

    if (error) throw error

    return {
      success: true,
      data: data || []
    }
  } catch (error: any) {
    console.error("Error fetching available locations:", error)
    return {
      success: false,
      error: error.message || "Gagal mengambil senarai lokasi",
      data: []
    }
  }
}

/**
 * Add multiple locations to tenant (bulk insert)
 */
export async function addTenantLocationsAction(tenantId: number, locationIds: number[]) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .rpc('add_tenant_locations', {
        p_tenant_id: tenantId,
        p_location_ids: locationIds
      })

    if (error) throw error

    if (!data.success) {
      return {
        success: false,
        error: data.error
      }
    }

    revalidatePath('/dashboard/rentals')
    revalidatePath('/dashboard/tenant')
    
    return {
      success: true,
      message: data.message,
      inserted: data.inserted,
      skipped: data.skipped
    }
  } catch (error: any) {
    console.error("Error adding tenant locations:", error)
    return {
      success: false,
      error: error.message || "Gagal menambah lokasi"
    }
  }
}

/**
 * Delete (soft) a tenant location by marking it inactive
 */
export async function deleteTenantLocationAction(rentalId: number, tenantId: number) {
  // Verify the caller owns this tenant
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Tidak dibenarkan" }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('profile_id', user.id)
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) return { success: false, error: "Peniaga tidak dijumpai" }

  // Use admin client to bypass RLS for the update
  const admin = createAdminClient()
  const { error } = await admin
    .from('tenant_locations')
    .update({ is_active: false, status: 'inactive' })
    .eq('id', rentalId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error("Error deleting tenant location:", error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/rentals')
  return { success: true }
}

/**
 * Get tenant's linked organizers with status
 */
export async function getTenantOrganizersAction(tenantId: number) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('tenant_organizers')
      .select(`
        *,
        organizers(id, name, organizer_code, email, phone)
      `)
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data || []
    }
  } catch (error: any) {
    console.error("Error fetching tenant organizers:", error)
    return {
      success: false,
      error: error.message || "Gagal mengambil senarai penganjur",
      data: []
    }
  }
}

/**
 * Check if tenant has any approved organizer relationship
 */
export async function hasApprovedOrganizerAction(tenantId: number) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('tenant_organizers')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'active'])
      .limit(1)

    if (error) throw error

    return {
      success: true,
      hasApproved: data && data.length > 0
    }
  } catch (error: any) {
    console.error("Error checking approved organizer:", error)
    return {
      success: false,
      hasApproved: false,
      error: error.message
    }
  }
}

/**
 * Remove tenant-organizer link (for re-request after rejection or cleanup)
 */
export async function removeOrganizerLinkAction(linkId: number) {
  const supabase = await createClient()

  try {
    // Verify the link belongs to current user's tenant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data: link, error: linkError } = await supabase
      .from('tenant_organizers')
      .select('tenant_id, tenants!inner(profile_id)')
      .eq('id', linkId)
      .single()

    if (linkError || !link) throw new Error("Link not found")
    
    // Check authorization - either tenant owner, organizer, or admin
    const tenantProfileId = (link.tenants as any)?.profile_id
    
    const { data: userRole } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAuthorized = 
      tenantProfileId === user.id || 
      ['admin', 'superadmin'].includes(userRole?.role || '')

    if (!isAuthorized) {
      return {
        success: false,
        error: "Tidak dibenarkan"
      }
    }

    const { error } = await supabase
      .from('tenant_organizers')
      .delete()
      .eq('id', linkId)

    if (error) throw error

    revalidatePath('/dashboard/rentals')
    revalidatePath('/dashboard/tenants')
    
    return {
      success: true,
      message: "Pautan dipadam"
    }
  } catch (error: any) {
    console.error("Error removing organizer link:", error)
    return {
      success: false,
      error: error.message || "Gagal memadam pautan"
    }
  }
}

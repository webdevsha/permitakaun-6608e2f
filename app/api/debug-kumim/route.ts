import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and Key are required")
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

export async function GET() {
  try {
    const supabase = getSupabaseClient()
    
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@kumim.my')

    const { data: staffProfile, error: staffError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'manjaya.solution@gmail.com')

    const { data: org002, error: orgError } = await supabase
      .from('organizers')
      .select('*')
      .eq('organizer_code', 'ORG002')

    // Check if admin@kumim.my is in organizers table by profile_id if adminProfile exists
    let adminAsOrganizer = null;
    if (adminProfile && adminProfile.length > 0) {
        const { data: orgByProfile } = await supabase
          .from('organizers')
          .select('*')
          .eq('profile_id', adminProfile[0].id)
        adminAsOrganizer = orgByProfile
    }

    return NextResponse.json({
      adminProfile,
      adminError,
      staffProfile,
      staffError,
      org002,
      orgError,
      adminAsOrganizer,
      serviceRoleUsed: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      hint: "Environment variables may not be set during build time"
    }, { status: 500 })
  }
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Shield, User, Users, CheckCircle, AlertTriangle, Building, Wrench } from "lucide-react"
import { clearAllSetupData, cleanHazmanData, wipeSystemData } from "./actions"
import { cn } from "@/lib/utils"

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const supabase = createClient()

  const addLog = (msg: string) => setLogs(prev => [...prev, msg])

  const users = [
    { email: "admin@permit.com", pass: "pass1234", role: "admin", name: "Super Admin", isTenant: false },
    { email: "rafisha92@gmail.com", pass: "pass1234", role: "admin", name: "Super Admin Rafisha", isTenant: false },
    { email: "admin@kumim.my", pass: "pass1234", role: "organizer", name: "Hazman", isTenant: false, orgCode: "ORG002", orgName: "Kumim Enterprise" },
    { email: "staff@permit.com", pass: "pass1234", role: "staff", name: "Staff Member", isTenant: false },
    { email: "manjaya.solution@gmail.com", pass: "pass1234", role: "staff", name: "Staff Encik Hazman", isTenant: false, orgCode: "ORG002" },
    { email: "organizer@permit.com", pass: "pass1234", role: "organizer", name: "Ketua Penganjur", isTenant: false, orgCode: "ORG001", orgName: "Persatuan Peniaga Gombak" },
    { email: "siti@permit.com", pass: "pass1234", role: "tenant", name: "Siti Aminah", isTenant: true, business: "Siti Hijab Collection", phone: "0123456789" },
    { email: "ahmad@permit.com", pass: "pass1234", role: "tenant", name: "Ahmad Albab", isTenant: true, business: "Ahmad Burger", phone: "0198765432" },
  ]

  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    users.filter(u => u.role === 'admin').map(u => u.email)
  )

  const toggleUser = (email: string) => {
    setSelectedUsers(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const clearData = async () => {
    if (!confirm("⚠️ AMARAN: Ini akan memadam SEMUA data (Lokasi, Peniaga, Penganjur) kecuali Akaun Pengguna. Adakah anda pasti?")) return;

    setLoading(true);
    addLog("🗑️ Clearing data (Admin Mode)...");
    try {
      const res = await clearAllSetupData()
      if (res.success) {
        addLog("✅ Data Cleared (Blank Slate).");
        toast.success("Data cleared successfully.");
      } else {
        addLog(`❌ Error clearing: ${res.error}`);
        toast.error(`Error: ${res.error}`)
      }
    } catch (e: any) {
      addLog(`❌ Error clearing: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }


  const handleWipeAll = async () => {
    if (!confirm("⚠️ DANGER: This will delete EVERYTHING (All Tenants, Locations, Organizers, Transactions). Are you sure?")) return
    if (!confirm("⚠️ DOUBLE CHECK: This is irreversible. Confirm?")) return

    setLoading(true)
    addLog("🧨 Wiping ENTIRE System...")
    const res = await wipeSystemData()
    if (res.success) {
      addLog("✅ System Wiped.")
      toast.success("System wiped completely.")
    } else {
      addLog(`❌ Wipe Failed: ${res.error}`)
    }
    setLoading(false)
  }



  const cleanHazmanOnly = async () => {
    if (!confirm("🧹 Clean only Hazman (ORG002) data? other data will be kept.")) return

    setLoading(true)
    addLog(`🧹 Cleaning Hazman (ORG002) data...`)
    const res = await cleanHazmanData()

    if (res.success) {
      addLog(`✅ ${res.message}`)
      toast.success("Hazman data cleaned!")
    } else {
      addLog(`❌ Failed: ${res.error}`)
      toast.error("Failed to clean Hazman data")
    }
    setLoading(false)
  }

  const forceFixOrganizer = async () => {
    setLoading(true)
    addLog("🔧 Attempting to force fix Organizer Role...")

    try {
      // 1. Try RPC method first (Best method)
      const { error: rpcError } = await supabase.rpc('set_user_role', {
        target_email: 'organizer@permit.com',
        new_role: 'organizer'
      })

      if (!rpcError) {
        addLog("✅ RPC Update Success!")
      } else {
        addLog(`⚠️ RPC Failed: ${rpcError.message}. Trying direct update...`)

        // 2. Try Direct Update (Only works if RLS allows or user is self)
        // We need the user ID first
        const { data: userData } = await supabase.from('profiles').select('id').eq('email', 'organizer@permit.com').single()

        if (userData) {
          const { error: updateError } = await supabase.from('profiles').update({ role: 'organizer' }).eq('id', userData.id)
          if (updateError) addLog(`❌ Direct Update Failed: ${updateError.message}`)
          else addLog("✅ Direct Update Success!")
        } else {
          addLog("❌ Profile not found")
        }
      }

      toast.success("Fix attempted. Please check logs.")
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runSetup = async () => {
    setLoading(true)
    setLogs([])
    addLog("Starting setup...")

    try {
      const targetUsers = users.filter(u => selectedUsers.includes(u.email))
      if (targetUsers.length === 0) {
        addLog("⚠️ No users selected.")
        setLoading(false)
        return
      }

      for (const u of targetUsers) {
        addLog(`Processing user: ${u.email}...`)

        // 1. Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: u.email,
          password: u.pass,
          options: {
            data: { full_name: u.name }
          }
        })

        if (error) {
          addLog(`⚠️ Auth Note: ${error.message} (User might exist)`)
        }

        // Wait a bit for trigger to run
        await new Promise(r => setTimeout(r, 1000))

        // Try to get User ID (either from sign up or sign in if exists)
        let userId = data.user?.id
        if (!userId) {
          // If user existed, we can't get ID easily without login. 
          // For this script, we assume clean slate OR we try to fetch profile if RLS allows (public read)
          const { data: pData } = await supabase.from('profiles').select('id').eq('email', u.email).single()
          userId = pData?.id
        }

        if (userId) {
          addLog(`✅ User ID found`)

          // 2. Set Role
          if (u.role !== 'tenant') {
            const { error: rpcError } = await supabase.rpc('set_user_role', {
              target_email: u.email,
              new_role: u.role
            })

            if (rpcError) {
              addLog(`   ⚠️ Failed to set role via RPC: ${rpcError.message}`)
              // Fallback: Try direct update (likely fail due to RLS but worth a try in dev)
              await supabase.from('profiles').update({ role: u.role }).eq('id', userId)
            } else {
              addLog(`   Updated role to ${u.role}`)
            }

            // 2.5. Set organizer_code for staff members
            if (u.role === 'staff' && u.orgCode) {
              const { error: orgCodeError } = await supabase
                .from('profiles')
                .update({ organizer_code: u.orgCode })
                .eq('id', userId)

              if (orgCodeError) {
                addLog(`   ⚠️ Failed to set organizer_code: ${orgCodeError.message}`)
              } else {
                addLog(`   🔗 Linked staff to organizer ${u.orgCode}`)
              }
            }
          }

          // 3. Special: Create Organizer Record
          if (u.role === 'organizer' && u.orgCode && u.orgName) {
            const { data: existingOrg } = await supabase.from('organizers').select('id').eq('organizer_code', u.orgCode).maybeSingle()
            let orgId = existingOrg?.id

            if (!orgId) {
              const { data: newOrg, error: orgError } = await supabase.from('organizers').insert({
                name: u.orgName,
                organizer_code: u.orgCode,
                status: 'active',
                email: u.email,
                profile_id: userId
              }).select('id').single()

              if (orgError) addLog(`   ❌ Org Error: ${orgError.message}`)
              else {
                orgId = newOrg.id
                addLog(`   🏢 Created Organizer: ${u.orgName}`)
              }
            } else {
              // Link existing org to this user
              await supabase.from('organizers').update({ profile_id: userId }).eq('id', orgId)
              addLog(`   Linked Organizer to User`)
            }

            // Seed Locations for this Organizer (skip for ORG002 - they start with clean slate)
            if (orgId && u.orgCode !== 'ORG002') {
              const { count } = await supabase.from('locations').select('*', { count: 'exact', head: true }).eq('organizer_id', orgId)
              if (count === 0) {
                await supabase.from('locations').insert([
                  {
                    organizer_id: orgId,
                    name: "Pasar Malam Gombak",
                    type: "daily",
                    operating_days: "Sabtu",
                    days_per_week: 1,
                    total_lots: 100,
                    rate_khemah: 15,
                    rate_cbs: 20,
                    rate_monthly: 0,
                    program_name: "Niaga Malam Minggu"
                  },
                  {
                    organizer_id: orgId,
                    name: "Uptown Danau Kota",
                    type: "monthly",
                    operating_days: "Selasa - Ahad",
                    days_per_week: 6,
                    total_lots: 200,
                    rate_khemah: 0,
                    rate_cbs: 0,
                    rate_monthly: 450,
                    program_name: "Uptown DK"
                  }
                ])
                addLog(`   📍 Created Seed Locations for Organizer`)
              }
            }
          }

          // 4. Create Tenant Record if needed
          if (u.isTenant) {
            const { data: existingTenant } = await supabase
              .from('tenants')
              .select('id, profile_id')
              .eq('email', u.email)
              .maybeSingle()

            if (existingTenant) {
              // If tenant exists but doesn't have profile_id linked, link it now
              if (!existingTenant.profile_id) {
                const { error: updateError } = await supabase
                  .from('tenants')
                  .update({ profile_id: userId })
                  .eq('id', existingTenant.id)

                if (updateError) addLog(`   ⚠️ Failed to link tenant: ${updateError.message}`)
                else addLog(`   🔗 Linked existing tenant to user profile`)
              } else {
                addLog(`   ✓ Tenant already linked`)
              }
            } else {
              // Create new tenant record
              const { error: tenantError } = await supabase
                .from('tenants')
                .insert({
                  profile_id: userId,
                  full_name: u.name,
                  business_name: u.business,
                  phone_number: u.phone,
                  email: u.email,
                  status: 'active',
                  organizer_code: 'ORG001' // Assign them to our seeded organizer
                })

              if (tenantError) addLog(`   ❌ Tenant Error: ${tenantError.message}`)
              else addLog(`   ✨ Created Tenant record`)
            }
          }
        }
      }

      addLog("🎉 Setup complete!")
      toast.success("Setup complete")

      // Logout
      await supabase.auth.signOut()

    } catch (e: any) {
      addLog(`🔥 Critical Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl border-none">
        <CardHeader className="bg-white border-b pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Database Setup & Seeder</CardTitle>
              <CardDescription>Initialize your demo environment</CardDescription>
            </div>
          </div>

          <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm flex gap-3 items-start border border-amber-100">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Instructions:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Ensure you have disabled "Confirm Email" in Supabase Auth settings.</li>
                <li>If Organizer Role is incorrect, run the SQL script in <code>supabase/fix_roles.sql</code></li>
              </ol>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Accounts to Create</h3>
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setSelectedUsers(users.map(u => u.email))}>Select All</Button>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setSelectedUsers([])}>Deselect All</Button>
              </div>
              {users.map((u, i) => (
                <div key={i} className={cn("flex items-center justify-between p-3 border rounded-lg shadow-sm cursor-pointer transition-colors", selectedUsers.includes(u.email) ? "bg-white border-primary/50" : "bg-slate-50 opacity-60")}>
                  <div className="flex items-center gap-3" onClick={() => toggleUser(u.email)}>
                    <input type="checkbox" checked={selectedUsers.includes(u.email)} onChange={() => toggleUser(u.email)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    {u.role === 'admin' ? <Shield size={16} className="text-red-500" /> :
                      u.role === 'organizer' ? <Building size={16} className="text-purple-500" /> :
                        u.role === 'staff' ? <User size={16} className="text-blue-500" /> :
                          <Users size={16} className="text-green-500" />}
                    <p className="font-bold text-sm">{u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.name}</p>
                  </div>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{u.role}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-green-400 h-full min-h-[200px] overflow-y-auto">
              <p className="text-slate-500 border-b border-slate-800 pb-2 mb-2">System Logs...</p>
              {logs.length === 0 && <p className="opacity-50 italic">Ready to start...</p>}
              {logs.map((log, i) => (
                <p key={i} className="mb-1">{log}</p>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={runSetup}
              disabled={loading}
              size="lg"
              className="w-full text-lg font-bold h-14 shadow-lg shadow-primary/20"
            >
              {loading ? "Processing..." : "Run Full Setup & Seed Data"}
            </Button>


            <Button onClick={cleanHazmanOnly} variant="secondary" className="w-full bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200">
              🧹 Clean Hazman (ORG002) Data Only
            </Button>

            <Button onClick={forceFixOrganizer} variant="outline" className="w-full">
              <Wrench className="w-4 h-4 mr-2" /> Force Fix "organizer@permit.com" Role
            </Button>

            <Button
              onClick={clearData}
              variant="destructive"
              disabled={loading}
              className="w-full mt-4 border-red-200 bg-red-50 text-destructive hover:bg-red-100"
            >
              🗑️ Clear ALL Data (Start Fresh)
            </Button>

            <Button
              onClick={handleWipeAll}
              variant="destructive"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              🧨 WIPEOUT (Delete Everything for Everyone)
            </Button>


          </div>

        </CardContent >
      </Card >
    </div >
  )
}

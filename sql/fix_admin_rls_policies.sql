-- =============================================================================
-- Fix RLS Policies for Admin Access
-- This allows Admins to create/update locations, tenants, and organizers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (1) LOCATIONS TABLE - Fix RLS for Admin
-- -----------------------------------------------------------------------------

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow organizers to manage their locations" ON locations;
DROP POLICY IF EXISTS "Staff can create pending locations" ON locations;
DROP POLICY IF EXISTS "Admins can manage all locations" ON locations;

-- Create comprehensive policy for Admins
CREATE POLICY "Admins can manage all locations"
ON locations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
);

-- Policy for Organizers to manage their own locations
CREATE POLICY "Organizers can manage their locations"
ON locations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'organizer'
    )
    AND organizer_id IN (
        SELECT id FROM organizers WHERE profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'organizer'
    )
);

-- Policy for Staff to create pending locations
CREATE POLICY "Staff can create pending locations"
ON locations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'staff'
    )
);

-- -----------------------------------------------------------------------------
-- (2) TENANTS TABLE - Fix RLS for Admin
-- -----------------------------------------------------------------------------

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow users to view own tenant" ON tenants;
DROP POLICY IF EXISTS "Allow users to update own tenant" ON tenants;
DROP POLICY IF EXISTS "Allow authenticated to create tenant" ON tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON tenants;

-- Admin policy for full access
CREATE POLICY "Admins can manage all tenants"
ON tenants
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
);

-- Users can view their own tenant
CREATE POLICY "Users can view own tenant"
ON tenants
FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin', 'staff', 'organizer')
    )
);

-- Users can update their own tenant
CREATE POLICY "Users can update own tenant"
ON tenants
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Allow insertion during signup (trigger handles profile_id)
CREATE POLICY "Allow authenticated to create tenant"
ON tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- (3) ORGANIZERS TABLE - Fix RLS for Admin
-- -----------------------------------------------------------------------------

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow users to view own organizer" ON organizers;
DROP POLICY IF EXISTS "Allow users to update own organizer" ON organizers;
DROP POLICY IF EXISTS "Allow authenticated to create organizer" ON organizers;
DROP POLICY IF EXISTS "Admins can manage all organizers" ON organizers;

-- Admin policy for full access
CREATE POLICY "Admins can manage all organizers"
ON organizers
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
);

-- Users can view their own organizer
CREATE POLICY "Users can view own organizer"
ON organizers
FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin', 'staff')
    )
);

-- Users can update their own organizer
CREATE POLICY "Users can update own organizer"
ON organizers
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Allow insertion during signup
CREATE POLICY "Allow authenticated to create organizer"
ON organizers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- (4) PROFILES TABLE - Ensure Admin can view all
-- -----------------------------------------------------------------------------

-- Drop and recreate profile policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'superadmin')
    )
);

-- -----------------------------------------------------------------------------
-- (5) Enable RLS on all tables (if not already)
-- -----------------------------------------------------------------------------

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Verification Query (Run to check policies)
-- -----------------------------------------------------------------------------
/*
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies 
WHERE tablename IN ('locations', 'tenants', 'organizers', 'profiles')
AND schemaname = 'public'
ORDER BY tablename, policyname;
*/

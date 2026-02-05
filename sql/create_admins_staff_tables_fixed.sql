-- =============================================================================
-- CREATE NEW TABLES: admins and staff
-- Proper separation from profiles/tenants/organizers
-- =============================================================================

-- =============================================================================
-- TABLE: admins
-- Stores admin-specific data linked to profiles
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organizer_code text, -- Can be null for superadmin/dev admin
    full_name text,
    email text NOT NULL,
    is_active boolean DEFAULT true,
    max_staff_count integer DEFAULT 2,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(profile_id),
    UNIQUE(email)
);

COMMENT ON TABLE public.admins IS 'Admin users who manage organizers and staff';

-- Enable RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admins
DROP POLICY IF EXISTS "Admins view own data" ON public.admins;
CREATE POLICY "Admins view own data" ON public.admins
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "Superadmin manage admins" ON public.admins;
CREATE POLICY "Superadmin manage admins" ON public.admins
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

-- =============================================================================
-- TABLE: staff
-- Stores staff-specific data linked to profiles and their admin
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id uuid REFERENCES public.admins(id) ON DELETE SET NULL,
    organizer_code text NOT NULL, -- Staff must have organizer_code
    full_name text,
    email text NOT NULL,
    is_active boolean DEFAULT true,
    can_approve boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(profile_id),
    UNIQUE(email)
);

COMMENT ON TABLE public.staff IS 'Staff users who help admins manage data';

-- Enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff
DROP POLICY IF EXISTS "Staff view own data" ON public.staff;
CREATE POLICY "Staff view own data" ON public.staff
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'staff')));

DROP POLICY IF EXISTS "Admin manage their staff" ON public.staff;
CREATE POLICY "Admin manage their staff" ON public.staff
    FOR ALL TO authenticated
    USING (admin_id IN (SELECT id FROM admins WHERE profile_id = auth.uid()) OR
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

-- =============================================================================
-- MIGRATE EXISTING DATA
-- Use ON CONFLICT on single unique column (profile_id)
-- =============================================================================

-- First, clear existing data to prevent conflicts during migration
TRUNCATE TABLE public.staff CASCADE;
TRUNCATE TABLE public.admins CASCADE;

-- Migrate admins from profiles (allow NULL organizer_code)
INSERT INTO public.admins (profile_id, organizer_code, full_name, email, created_at)
SELECT DISTINCT ON (p.id)
    p.id as profile_id,
    COALESCE(p.organizer_code, 'ORG001') as organizer_code, -- Default to ORG001 if NULL
    p.full_name,
    p.email,
    p.created_at
FROM profiles p
WHERE p.role = 'admin'
ORDER BY p.id
ON CONFLICT (profile_id) DO UPDATE SET
    organizer_code = EXCLUDED.organizer_code,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

-- Migrate staff from profiles (must have organizer_code)
INSERT INTO public.staff (profile_id, admin_id, organizer_code, full_name, email, created_at)
SELECT DISTINCT ON (p.id)
    p.id as profile_id,
    a.id as admin_id,
    p.organizer_code,
    p.full_name,
    p.email,
    p.created_at
FROM profiles p
LEFT JOIN admins a ON a.organizer_code = p.organizer_code
WHERE p.role = 'staff'
  AND p.organizer_code IS NOT NULL  -- Only migrate staff with organizer_code
ORDER BY p.id
ON CONFLICT (profile_id) DO UPDATE SET
    organizer_code = EXCLUDED.organizer_code,
    admin_id = EXCLUDED.admin_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

-- =============================================================================
-- VERIFY MIGRATION
-- =============================================================================

SELECT '=== ADMINS TABLE ===' as info;
SELECT 
    a.id,
    a.email,
    a.full_name,
    a.organizer_code,
    a.max_staff_count,
    (SELECT COUNT(*) FROM staff s WHERE s.admin_id = a.id) as current_staff_count
FROM admins a
ORDER BY a.organizer_code;

SELECT '=== STAFF TABLE ===' as info;
SELECT 
    s.id,
    s.email,
    s.full_name,
    s.organizer_code,
    a.email as admin_email,
    s.can_approve
FROM staff s
LEFT JOIN admins a ON a.id = s.admin_id
ORDER BY s.organizer_code, s.email;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_admins_organizer_code ON public.admins(organizer_code);
CREATE INDEX IF NOT EXISTS idx_admins_profile_id ON public.admins(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_organizer_code ON public.staff(organizer_code);
CREATE INDEX IF NOT EXISTS idx_staff_admin_id ON public.staff(admin_id);
CREATE INDEX IF NOT EXISTS idx_staff_profile_id ON public.staff(profile_id);

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_admins_updated_at ON public.admins;
CREATE TRIGGER update_admins_updated_at
    BEFORE UPDATE ON public.admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at
    BEFORE UPDATE ON public.staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

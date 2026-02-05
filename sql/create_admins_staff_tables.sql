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
    organizer_code text NOT NULL,
    full_name text,
    email text NOT NULL,
    phone_number text,
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
CREATE POLICY "Admins view own data" ON public.admins
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

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
    organizer_code text NOT NULL,
    full_name text,
    email text NOT NULL,
    phone_number text,
    is_active boolean DEFAULT true,
    can_approve boolean DEFAULT false, -- staff can approve pending items
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(profile_id),
    UNIQUE(email)
);

COMMENT ON TABLE public.staff IS 'Staff users who help admins manage data';

-- Enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff
CREATE POLICY "Staff view own data" ON public.staff
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'staff')));

CREATE POLICY "Admin manage their staff" ON public.staff
    FOR ALL TO authenticated
    USING (admin_id IN (SELECT id FROM admins WHERE profile_id = auth.uid()) OR
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

-- =============================================================================
-- MIGRATE EXISTING DATA
-- =============================================================================

-- Migrate admins from profiles
INSERT INTO public.admins (profile_id, organizer_code, full_name, email, created_at)
SELECT 
    p.id as profile_id,
    p.organizer_code,
    p.full_name,
    p.email,
    p.created_at
FROM profiles p
WHERE p.role = 'admin'
ON CONFLICT (profile_id) DO UPDATE SET
    organizer_code = EXCLUDED.organizer_code,
    full_name = EXCLUDED.full_name,
    updated_at = now();

-- Migrate staff from profiles
INSERT INTO public.staff (profile_id, admin_id, organizer_code, full_name, email, created_at)
SELECT 
    p.id as profile_id,
    a.id as admin_id,
    p.organizer_code,
    p.full_name,
    p.email,
    p.created_at
FROM profiles p
LEFT JOIN admins a ON a.organizer_code = p.organizer_code
WHERE p.role = 'staff'
ON CONFLICT (profile_id) DO UPDATE SET
    organizer_code = EXCLUDED.organizer_code,
    admin_id = EXCLUDED.admin_id,
    full_name = EXCLUDED.full_name,
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

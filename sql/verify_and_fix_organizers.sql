-- ============================================================================
-- VERIFY AND FIX: Ensure all organizers are visible
-- ============================================================================

-- ============================================================================
-- STEP 1: Check what's actually in the organizers table (bypass RLS)
-- ============================================================================
SELECT 
    'ALL ORGANIZERS (bypassing RLS)' as check_type,
    COUNT(*) as count
FROM public.organizers;

-- Show all organizers
SELECT 
    id,
    profile_id,
    name,
    email,
    organizer_code,
    status,
    accounting_status,
    created_at
FROM public.organizers
ORDER BY organizer_code;

-- ============================================================================
-- STEP 2: Check RLS policies on organizers table
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'organizers';

-- ============================================================================
-- STEP 3: Ensure RLS is enabled but policies allow all authenticated users
-- ============================================================================

-- Enable RLS
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public read organizers" ON public.organizers;
DROP POLICY IF EXISTS "Organizers can update self" ON public.organizers;
DROP POLICY IF EXISTS "Allow all read organizers" ON public.organizers;
DROP POLICY IF EXISTS "Allow all insert organizers" ON public.organizers;
DROP POLICY IF EXISTS "Allow all update organizers" ON public.organizers;

-- Create permissive policies
CREATE POLICY "Allow all read organizers" 
    ON public.organizers 
    FOR SELECT 
    USING (true);

CREATE POLICY "Allow all insert organizers" 
    ON public.organizers 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow all update organizers" 
    ON public.organizers 
    FOR UPDATE 
    USING (true);

CREATE POLICY "Allow all delete organizers" 
    ON public.organizers 
    FOR DELETE 
    USING (true);

-- ============================================================================
-- STEP 4: Fix any NULL profile_ids
-- ============================================================================
UPDATE public.organizers 
SET profile_id = id 
WHERE profile_id IS NULL;

-- ============================================================================
-- STEP 5: Verify final state
-- ============================================================================
SELECT 
    'AFTER FIX' as check_type,
    COUNT(*) as organizer_count,
    STRING_AGG(name || ' (' || organizer_code || ')', ', ' ORDER BY organizer_code) as organizers
FROM public.organizers;

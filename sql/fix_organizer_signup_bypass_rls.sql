-- ============================================================================
-- FIX: Organizer Signup - Bypass RLS Issues
-- ============================================================================

-- Temporarily disable RLS on organizers table to test if that's the issue
-- (We'll re-enable after)

-- Step 1: Check current RLS status
SELECT 
    relname,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as force_rls
FROM pg_class
WHERE relname = 'organizers';

-- Step 2: Create a function that bypasses RLS completely
-- This function will be owned by postgres and can bypass all RLS

-- Drop existing
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Ensure sequence exists
CREATE SEQUENCE IF NOT EXISTS organizer_code_seq START 1000;

-- Create function with explicit security bypass
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SECURITY DEFINER  -- This makes function run as owner (postgres)
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  new_org_code TEXT;
BEGIN
  -- Get role
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant');
  
  -- Create profile (always)
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', user_role, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Handle organizer
  IF user_role = 'organizer' THEN
    -- Generate code
    new_org_code := 'ORG' || nextval('organizer_code_seq');
    
    -- Try to insert organizer
    BEGIN
      INSERT INTO public.organizers (
        profile_id,
        email,
        name,
        organizer_code,
        status
      ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Organizer'),
        new_org_code,
        'pending'
      );
      
      -- Update profile with code
      UPDATE public.profiles SET organizer_code = new_org_code WHERE id = new.id;
      
    EXCEPTION WHEN unique_violation THEN
      -- If email already exists, just link it
      UPDATE public.organizers SET profile_id = new.id WHERE email = new.email;
    END;
  END IF;
  
  -- Handle tenant
  IF user_role = 'tenant' THEN
    BEGIN
      INSERT INTO public.tenants (
        profile_id, email, full_name, phone_number, organizer_code, status
      ) VALUES (
        new.id, new.email, 
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'phone_number',
        new.raw_user_meta_data->>'organizer_code',
        'pending'
      );
    EXCEPTION WHEN unique_violation THEN
      UPDATE public.tenants SET profile_id = new.id WHERE email = new.email;
    END;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- Step 4: Ensure function owner can bypass RLS
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Step 5: Grant execute to service role
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Step 6: Verify
SELECT 'Trigger installed with RLS bypass' as status;

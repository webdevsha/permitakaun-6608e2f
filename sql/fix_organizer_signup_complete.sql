-- ============================================================================
-- COMPLETE FIX: Organizer Signup Database Error
-- ============================================================================
-- This SQL fixes the "Database error saving new user" error for organizer signup
-- Run this in Supabase SQL Editor

-- Step 1: Drop existing trigger and function completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Ensure sequence exists for organizer codes
CREATE SEQUENCE IF NOT EXISTS organizer_code_seq START 1000;

-- Step 3: Verify sequence is working
SELECT nextval('organizer_code_seq') as test_val;

-- Step 4: Create the fixed trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  new_org_code TEXT;
BEGIN
  -- Get role from metadata, default to 'tenant'
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant');
  
  -- Create profile with the correct role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    user_role
  );
  
  -- Create tenant record if role is 'tenant'
  IF user_role = 'tenant' THEN
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE email = new.email) THEN
      INSERT INTO public.tenants (
        profile_id,
        email,
        full_name,
        business_name,
        phone_number,
        ic_number,
        ssm_number,
        address,
        organizer_code,
        status
      ) VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'business_name',
        new.raw_user_meta_data->>'phone_number',
        new.raw_user_meta_data->>'ic_number',
        new.raw_user_meta_data->>'ssm_number',
        new.raw_user_meta_data->>'address',
        new.raw_user_meta_data->>'organizer_code',
        'pending'
      );
    ELSE
      UPDATE public.tenants 
      SET profile_id = new.id 
      WHERE email = new.email;
    END IF;
  END IF;
  
  -- Create organizer record if role is 'organizer'
  IF user_role = 'organizer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.organizers WHERE email = new.email) THEN
      -- Generate unique organizer code
      new_org_code := 'ORG' || nextval('organizer_code_seq');
      
      -- Insert organizer with ALL required fields
      INSERT INTO public.organizers (
        profile_id,
        email,
        name,
        organizer_code,
        status,
        created_at,
        updated_at
      ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', 'New Organizer'),
        new_org_code,
        'pending',
        NOW(),
        NOW()
      );
      
      -- Update profiles table with the new organizer code
      UPDATE public.profiles 
      SET organizer_code = new_org_code 
      WHERE id = new.id;
    ELSE
      -- Link existing organizer
      UPDATE public.organizers 
      SET profile_id = new.id 
      WHERE email = new.email;
      
      -- Get existing code and update profile
      SELECT organizer_code INTO new_org_code 
      FROM public.organizers 
      WHERE email = new.email;
      
      UPDATE public.profiles 
      SET organizer_code = new_org_code 
      WHERE id = new.id;
    END IF;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create the trigger
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- Step 6: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Step 7: Verify installation
SELECT 
    'Trigger installed successfully' as status,
    tgname as trigger_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Step 8: Test sequence generation
SELECT 'Test organizer code: ' || 'ORG' || nextval('organizer_code_seq') as test_result;

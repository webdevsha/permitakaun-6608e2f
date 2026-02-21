-- ============================================================================
-- FIX V2: Organizer Signup - Handle All Constraints
-- ============================================================================

-- Step 1: Drop everything
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create sequence
CREATE SEQUENCE IF NOT EXISTS organizer_code_seq START 1000;

-- Step 3: Ensure organizers table has all required columns and constraints are correct
-- First, let's check if we need to alter the table
DO $$
BEGIN
    -- Make sure organizer_code is not NULL (if it has constraint)
    -- But we'll handle it in the trigger
    RAISE NOTICE 'Checking organizers table...';
END $$;

-- Step 4: Create the trigger function with comprehensive error handling
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  new_org_code TEXT;
  profile_exists BOOLEAN;
  organizer_exists BOOLEAN;
BEGIN
  -- Get role from metadata
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant');
  
  RAISE NOTICE '[Trigger] Starting for user: %, role: %', new.email, user_role;
  
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = new.id) INTO profile_exists;
  
  IF NOT profile_exists THEN
    RAISE NOTICE '[Trigger] Creating profile for: %', new.email;
    
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
      new.id, 
      new.email, 
      new.raw_user_meta_data->>'full_name',
      user_role,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '[Trigger] Profile created for: %', new.email;
  ELSE
    RAISE NOTICE '[Trigger] Profile already exists for: %', new.email;
  END IF;
  
  -- Handle organizer role
  IF user_role = 'organizer' THEN
    RAISE NOTICE '[Trigger] Processing organizer for: %', new.email;
    
    -- Check if organizer already exists
    SELECT EXISTS(SELECT 1 FROM public.organizers WHERE email = new.email) INTO organizer_exists;
    
    IF NOT organizer_exists THEN
      -- Generate unique organizer code
      new_org_code := 'ORG' || nextval('organizer_code_seq');
      RAISE NOTICE '[Trigger] Generated code: %', new_org_code;
      
      -- Insert organizer - try with minimal required fields first
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
          COALESCE(new.raw_user_meta_data->>'full_name', 'New Organizer'),
          new_org_code,
          'pending'
        );
        
        RAISE NOTICE '[Trigger] Organizer inserted successfully';
        
        -- Update profile with organizer_code
        UPDATE public.profiles 
        SET organizer_code = new_org_code 
        WHERE id = new.id;
        
        RAISE NOTICE '[Trigger] Profile updated with organizer_code: %', new_org_code;
        
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE '[Trigger] Error inserting organizer: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
          -- Re-raise the error so we can see it
          RAISE;
      END;
    ELSE
      RAISE NOTICE '[Trigger] Organizer already exists for: %', new.email;
      
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
  
  -- Handle tenant role (simplified)
  IF user_role = 'tenant' THEN
    RAISE NOTICE '[Trigger] Processing tenant for: %', new.email;
    
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE email = new.email) THEN
      INSERT INTO public.tenants (
        profile_id,
        email,
        full_name,
        phone_number,
        organizer_code,
        status
      ) VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'phone_number',
        new.raw_user_meta_data->>'organizer_code',
        'pending'
      );
      RAISE NOTICE '[Trigger] Tenant created for: %', new.email;
    ELSE
      UPDATE public.tenants 
      SET profile_id = new.id 
      WHERE email = new.email;
      RAISE NOTICE '[Trigger] Tenant updated for: %', new.email;
    END IF;
  END IF;
  
  RAISE NOTICE '[Trigger] Completed for: %', new.email;
  RETURN new;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[Trigger] FATAL ERROR: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- Step 6: Enable logging for triggers (temporary for debugging)
ALTER DATABASE postgres SET log_min_messages = 'NOTICE';

-- Step 7: Verify
SELECT 
    'Trigger installed' as status,
    tgname,
    proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Step 8: Test the sequence
SELECT 'Next organizer code will be: ORG' || nextval('organizer_code_seq') as preview;

-- Reset sequence back (so we don't waste numbers)
SELECT setval('organizer_code_seq', currval('organizer_code_seq') - 1);

-- Final fix for organizer signup - ensures organizer_code is generated properly

-- Step 1: Ensure sequence exists
CREATE SEQUENCE IF NOT EXISTS organizer_code_seq START 1000;

-- Step 2: Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 3: Create fixed trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  new_org_code TEXT;
BEGIN
  -- Get role from metadata, default to 'tenant'
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant');
  
  RAISE NOTICE 'Creating user: %, role: %', new.email, user_role;
  
  -- Create profile with the correct role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    user_role
  );
  
  RAISE NOTICE 'Profile created for: %', new.email;
  
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
      RAISE NOTICE 'Tenant record created for: %', new.email;
    ELSE
      UPDATE public.tenants 
      SET profile_id = new.id 
      WHERE email = new.email;
      RAISE NOTICE 'Tenant record updated for: %', new.email;
    END IF;
  END IF;
  
  -- Create organizer record if role is 'organizer'
  IF user_role = 'organizer' THEN
    RAISE NOTICE 'Processing organizer signup for: %', new.email;
    
    IF NOT EXISTS (SELECT 1 FROM public.organizers WHERE email = new.email) THEN
      -- Generate unique organizer code
      new_org_code := 'ORG' || nextval('organizer_code_seq');
      RAISE NOTICE 'Generated organizer code: % for %', new_org_code, new.email;
      
      -- Insert organizer with all required fields
      INSERT INTO public.organizers (
        profile_id,
        email,
        name,
        organizer_code,
        status,
        accounting_status,
        created_at,
        updated_at
      ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', 'New Organizer'),
        new_org_code,
        'pending',
        'inactive',
        NOW(),
        NOW()
      );
      
      RAISE NOTICE 'Organizer record created for: % with code: %', new.email, new_org_code;
      
      -- Update profiles table with the new organizer code
      UPDATE public.profiles 
      SET organizer_code = new_org_code 
      WHERE id = new.id;
      
      RAISE NOTICE 'Profile updated with organizer_code: %', new_org_code;
    ELSE
      -- Link existing organizer record
      UPDATE public.organizers 
      SET profile_id = new.id 
      WHERE email = new.email;
      
      -- Get existing organizer code and update profile
      SELECT organizer_code INTO new_org_code 
      FROM public.organizers 
      WHERE email = new.email;
      
      UPDATE public.profiles 
      SET organizer_code = new_org_code 
      WHERE id = new.id;
      
      RAISE NOTICE 'Existing organizer linked for: %', new.email;
    END IF;
  END IF;
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in handle_new_user trigger: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate the trigger
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- Step 5: Verify trigger is installed
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name,
    tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Step 6: Check if organizers table allows NULL in organizer_code (it shouldn't)
-- This shows current constraints
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'organizers' AND column_name = 'organizer_code';

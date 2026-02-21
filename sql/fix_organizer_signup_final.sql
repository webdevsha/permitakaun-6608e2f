-- ============================================================================
-- FINAL COMPLETE FIX: Organizer Signup Database Error
-- ============================================================================
-- This script fixes the missing sequence issue and restores the correct trigger.

-- 1. Create the sequence if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.organizer_code_seq START 1000;

-- 2. Grant permissions on the sequence
GRANT USAGE, SELECT ON SEQUENCE public.organizer_code_seq TO anon, authenticated, postgres, service_role;

-- 3. Restore the correct trigger function (without updated_at and with proper error handling)
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
      -- Generate unique organizer code using the sequence we just ensured exists
      new_org_code := 'ORG' || nextval('public.organizer_code_seq');
      
      -- Insert organizer with ALL required fields
      INSERT INTO public.organizers (
        profile_id,
        email,
        name,
        organizer_code,
        status,
        created_at
      ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', 'New Organizer'),
        new_org_code,
        'pending',
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

-- 4. Re-create the trigger just to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- 5. Clean up the debug table as it is no longer needed
DROP TABLE IF EXISTS public.debug_logs;

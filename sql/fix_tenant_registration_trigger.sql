-- Update handle_new_user trigger to create tenant records with signup metadata
-- This ensures all data from the signup form is saved to the tenants table

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get role from metadata, default to 'tenant'
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant');
  
  -- 1. Create profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    user_role
  );
  
  -- 2. Create tenant record if role is 'tenant'
  IF user_role = 'tenant' THEN
    -- Check if tenant already exists by email
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE email = new.email) THEN
      -- Create new tenant with all signup data
      INSERT INTO public.tenants (
        profile_id,
        email,
        full_name,
        business_name,
        phone_number,
        ic_number,
        ssm_number,
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
        new.raw_user_meta_data->>'organizer_code',
        'pending' -- New signups start as pending
      );
    ELSE
      -- Link existing tenant record
      UPDATE public.tenants 
      SET profile_id = new.id 
      WHERE email = new.email;
    END IF;
  END IF;
  
  -- 3. Create organizer record if role is 'organizer'
  IF user_role = 'organizer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.organizers WHERE email = new.email) THEN
      INSERT INTO public.organizers (
        profile_id,
        email,
        name,
        status
      ) VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        'pending'
      );
    ELSE
      UPDATE public.organizers 
      SET profile_id = new.id 
      WHERE email = new.email;
    END IF;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

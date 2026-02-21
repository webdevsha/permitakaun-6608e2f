-- Update the handle_new_user function to log errors WITHOUT rolling back the log
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  new_org_code TEXT;
  err_msg TEXT;
  err_state TEXT;
BEGIN
  -- Get role from metadata, default to 'tenant'
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant');
  
  BEGIN
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
      
  EXCEPTION WHEN OTHERS THEN
      -- Capture error details
      err_msg := SQLERRM;
      err_state := SQLSTATE;
      
      -- Log the specific error
      INSERT INTO public.debug_logs (message, error_detail, error_hint, query_state)
      VALUES (err_msg, err_state, 'Error during handle_new_user trigger', 'Caught exception');
      
      -- We will NOT re-raise this time so the insert into debug_logs persists
      -- However, the auth.users record will be created while profiles/organizers will be missing.
      -- This is just to capture the error.
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

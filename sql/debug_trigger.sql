CREATE TABLE IF NOT EXISTS public.signup_errors (
  id serial primary key,
  err_msg text,
  err_detail text,
  err_hint text,
  err_context text,
  created_at timestamp default now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  new_org_code TEXT;
BEGIN
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
          NULL,
          new.raw_user_meta_data->>'phone_number',
          NULL,
          NULL,
          NULL,
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
        -- Generate unique organizer code (e.g. ORG1001)
        new_org_code := 'ORG' || nextval('public.organizer_code_seq');
        
        INSERT INTO public.organizers (
          id, -- Primary key for organizers is explicitly `id` as it references profiles
          name,
          email,
          organizer_code,
          status
        ) VALUES (
          new.id,
          new.raw_user_meta_data->>'full_name',
          new.email,
          new_org_code,
          'pending'
        );
        
        -- Update profiles table with the new organizer code for consistency
        UPDATE public.profiles 
        SET organizer_code = new_org_code 
        WHERE id = new.id;
        
      END IF;
    END IF;
    
    RETURN new;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.signup_errors (err_msg, err_detail, err_hint) 
    VALUES (SQLERRM, SQLSTATE, 'Trigger Failed on signup for: ' || new.email);
    RAISE EXCEPTION 'Trigger Failed: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant read access to anon so we can fetch the logs
GRANT SELECT ON public.signup_errors TO anon;

-- Update handle_new_user to map all metadata fields including organizer_code
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  defined_role text;
BEGIN
  -- Get role from metadata, default to 'tenant'
  defined_role := new.raw_user_meta_data->>'role';
  IF defined_role IS NULL THEN
    defined_role := 'tenant';
  END IF;

  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', defined_role);
  
  -- Handle specific role setup
  IF defined_role = 'tenant' THEN
    -- Try to find organizer_id if code is present
    -- NOTE: Organizer code in metadata might be text.
    -- If organizer_code is provided, we can either store it in tenants.organizer_code 
    -- OR try to resolve to organizer_id. 
    -- Let's store organizer_code directly if the column exists (it does or check schema),
    -- and maybe resolve organizer_id if possible. 
    -- For now, let's map text fields.
    INSERT INTO public.tenants (
        profile_id, 
        full_name, 
        email, 
        status,
        business_name,
        phone_number,
        ssm_number,
        ic_number,
        organizer_code
    )
    VALUES (
        new.id, 
        new.raw_user_meta_data->>'full_name', 
        new.email, 
        'active',
        new.raw_user_meta_data->>'business_name',
        new.raw_user_meta_data->>'phone_number',
        new.raw_user_meta_data->>'ssm_number',
        new.raw_user_meta_data->>'ic_number',
        new.raw_user_meta_data->>'organizer_code'
    );
    
  ELSIF defined_role = 'organizer' THEN
    INSERT INTO public.organizers (id, name, email, status, phone)
    VALUES (
        new.id, 
        new.raw_user_meta_data->>'full_name', 
        new.email, 
        'active',
        new.raw_user_meta_data->>'phone_number'
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

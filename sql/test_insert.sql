DO $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_email TEXT := 'dummy_test_email_' || floor(random() * 1000) || '@test.com';
  new_org_code TEXT;
BEGIN
  -- simulate trigger body
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_id, v_email, 'Dummy Test', 'organizer');
  
  new_org_code := 'ORG' || nextval('organizer_code_seq');
  
  INSERT INTO public.organizers (
    id,
    name,
    email,
    organizer_code,
    status
  ) VALUES (
    v_id,
    'Dummy Test',
    v_email,
    new_org_code,
    'pending'
  );
  
  UPDATE public.profiles 
  SET organizer_code = new_org_code 
  WHERE id = v_id;
END;
$$;

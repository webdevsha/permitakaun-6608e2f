-- Create a test function to simulate the trigger logic
CREATE OR REPLACE FUNCTION public.test_organizer_insert(
  p_email TEXT,
  p_name TEXT,
  p_role TEXT
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_org_code TEXT;
  v_result JSON;
BEGIN
  -- 1. Insert Profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_name, p_role);

  -- 2. Insert Organizer
  IF p_role = 'organizer' THEN
    v_org_code := 'ORG' || nextval('organizer_code_seq');
    
    BEGIN
        INSERT INTO public.organizers (
          profile_id,
          email,
          name,
          organizer_code,
          status,
          created_at
        ) VALUES (
          v_user_id,
          p_email,
          p_name,
          v_org_code,
          'pending',
          NOW()
        );
        v_result := json_build_object('success', true, 'org_code', v_org_code);
    EXCEPTION WHEN OTHERS THEN
        v_result := json_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
    END;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

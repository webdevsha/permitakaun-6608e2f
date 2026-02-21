-- Create a function to test organizer insert bypassing RLS
CREATE OR REPLACE FUNCTION public.test_direct_org_insert(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_org_code TEXT
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
    INSERT INTO public.organizers (
      profile_id,
      email,
      name,
      organizer_code,
      status,
      created_at
    ) VALUES (
      p_user_id,
      p_email,
      p_name,
      p_org_code,
      'pending',
      NOW()
    );
    v_result := json_build_object('success', true);
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    v_result := json_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

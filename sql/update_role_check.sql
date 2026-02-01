-- Drop the existing check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the updated constraint including 'superadmin'
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('tenant', 'organizer', 'staff', 'admin', 'superadmin'));

-- 1. Update Profiles Role Check
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('tenant', 'organizer', 'staff', 'admin', 'superadmin'));

-- 2. Create Organizers Table
CREATE TABLE IF NOT EXISTS public.organizers (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    organizer_code TEXT UNIQUE, -- Code for Tenants to link to them
    status TEXT DEFAULT 'active' CHECK (status in ('active', 'inactive')),
    accounting_status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Organizers
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read organizers" ON public.organizers;
CREATE POLICY "Public read organizers" ON public.organizers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizers can update self" ON public.organizers;
CREATE POLICY "Organizers can update self" ON public.organizers FOR UPDATE USING (auth.uid() = id);

-- 3. Update Locations Table (Link to Organizer)
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.organizers(id);

-- Optional: Policy for Locations (Organizers manage their own locations)
-- CREATE POLICY "Organizers manage own locations" ON public.locations FOR ALL USING (organizer_id = auth.uid());

-- 4. Update Tenants to link to Organizer (via code or direct ID?)
-- Requirements say: "Tenants can then see Lokasi according to Penganjur"
-- This implies Tenants might belong to an Organizer, OR they just browse.
-- "Penganjur can see Tenants under them" -> Implies a relationship.
-- Let's add `organizer_id` to tenants too, or use `organizer_code` flow.
-- For now, let's add `organizer_id` nullable.
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.organizers(id);

-- 5. Update handle_new_user Trigger Function to support Roles
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
    INSERT INTO public.tenants (profile_id, full_name, email, status)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'active');
    
  ELSIF defined_role = 'organizer' THEN
    INSERT INTO public.organizers (id, name, email, status)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'active');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

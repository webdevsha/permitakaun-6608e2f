-- ============================================================================
-- ROOT CAUSE FIX: Organizer Signup Issues
-- ============================================================================
-- This SQL fixes ALL issues with organizer signup:
-- 1. Status constraint didn't allow 'pending'
-- 2. Some triggers used wrong column name (profile_id vs id)
-- 3. Adds profile_id column for future compatibility
--
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Fix organizers table structure
-- ============================================================================

-- Add profile_id column if it doesn't exist (for future compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizers' AND column_name = 'profile_id'
    ) THEN
        ALTER TABLE public.organizers ADD COLUMN profile_id UUID;
        
        -- Populate profile_id with existing id values
        UPDATE public.organizers SET profile_id = id WHERE profile_id IS NULL;
        
        RAISE NOTICE 'Added profile_id column to organizers table';
    ELSE
        RAISE NOTICE 'profile_id column already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Fix status constraint to allow 'pending'
-- ============================================================================

-- Drop existing status constraints
DO $$
DECLARE
    con_name TEXT;
BEGIN
    FOR con_name IN 
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.organizers'::regclass
        AND c.contype = 'c'
        AND a.attname = 'status'
    LOOP
        EXECUTE 'ALTER TABLE public.organizers DROP CONSTRAINT IF EXISTS ' || quote_ident(con_name);
        RAISE NOTICE 'Dropped constraint: %', con_name;
    END LOOP;
END $$;

-- Add new status constraint that allows 'pending', 'active', 'inactive'
ALTER TABLE public.organizers 
ADD CONSTRAINT organizers_status_check 
CHECK (status IN ('pending', 'active', 'inactive'));

-- ============================================================================
-- STEP 3: Ensure sequence exists
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS organizer_code_seq START 1000;

-- ============================================================================
-- STEP 4: Create error logging table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.signup_errors (
    id SERIAL PRIMARY KEY,
    email TEXT,
    err_msg TEXT,
    err_detail TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: Create the FIXED trigger function
-- ============================================================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the fixed function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  new_org_code TEXT;
BEGIN
  -- Get role from metadata, default to 'tenant'
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant');
  
  -- Create profile with the correct role
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    user_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
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
      
      -- Insert with BOTH id (primary key) AND profile_id (for queries)
      INSERT INTO public.organizers (
        id,
        profile_id,
        email,
        name,
        organizer_code,
        status,
        created_at,
        updated_at
      ) VALUES (
        new.id,
        new.id,  -- profile_id same as id (references profiles.id)
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', 'New Organizer'),
        new_org_code,
        'pending',
        NOW(),
        NOW()
      );
      
      -- Update profile with organizer_code
      UPDATE public.profiles 
      SET organizer_code = new_org_code 
      WHERE id = new.id;
    ELSE
      -- Link existing organizer
      UPDATE public.organizers 
      SET profile_id = new.id,
          id = new.id  -- Also update id to match new auth user
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
  
EXCEPTION WHEN OTHERS THEN
  -- Log error for debugging
  INSERT INTO public.signup_errors (email, err_msg, err_detail)
  VALUES (new.email, SQLERRM, SQLSTATE);
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Create the trigger
-- ============================================================================
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- STEP 7: Fix existing admin@kumim.my if needed
-- ============================================================================
DO $$
DECLARE
    admin_profile_id UUID;
    admin_organizer_id UUID;
    admin_org_code TEXT := 'ORG001';
BEGIN
    -- Get admin profile id
    SELECT id INTO admin_profile_id
    FROM public.profiles
    WHERE email = 'admin@kumim.my';
    
    IF admin_profile_id IS NULL THEN
        RAISE NOTICE 'admin@kumim.my profile not found - may need to sign up first';
    ELSE
        -- Check if organizer record exists
        SELECT id INTO admin_organizer_id
        FROM public.organizers
        WHERE email = 'admin@kumim.my';
        
        IF admin_organizer_id IS NULL THEN
            -- Create organizer record for admin
            INSERT INTO public.organizers (
                id,
                profile_id,
                email,
                name,
                organizer_code,
                status,
                accounting_status,
                created_at,
                updated_at
            ) VALUES (
                admin_profile_id,
                admin_profile_id,
                'admin@kumim.my',
                'Admin (KumiM)',
                admin_org_code,
                'active',
                'active',
                NOW(),
                NOW()
            )
            ON CONFLICT (organizer_code) DO UPDATE
            SET id = admin_profile_id,
                profile_id = admin_profile_id,
                status = 'active';
            
            -- Update profile with organizer_code
            UPDATE public.profiles
            SET organizer_code = admin_org_code
            WHERE id = admin_profile_id;
            
            RAISE NOTICE 'Created organizer record for admin@kumim.my with code %', admin_org_code;
        ELSE
            -- Ensure organizer is properly linked
            UPDATE public.organizers
            SET profile_id = admin_profile_id,
                id = admin_profile_id,
                status = 'active'
            WHERE email = 'admin@kumim.my';
            
            UPDATE public.profiles
            SET organizer_code = COALESCE(organizer_code, admin_org_code)
            WHERE id = admin_profile_id;
            
            RAISE NOTICE 'Updated organizer record for admin@kumim.my';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- STEP 8: Verify the fix
-- ============================================================================
SELECT 
    'Fix Complete!' as status,
    (SELECT COUNT(*) FROM public.organizers WHERE email = 'admin@kumim.my') as admin_organizer_count,
    (SELECT organizer_code FROM public.organizers WHERE email = 'admin@kumim.my') as admin_organizer_code,
    (SELECT column_name FROM information_schema.columns WHERE table_name = 'organizers' AND column_name = 'profile_id') as profile_id_column_exists,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'organizers'::regclass AND contype = 'c' LIMIT 1) as status_constraint;

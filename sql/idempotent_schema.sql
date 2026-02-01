-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Table: accounting_config (Idempotent)
CREATE TABLE IF NOT EXISTS public.accounting_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    percentages JSONB NOT NULL DEFAULT '{"tax": 10, "zakat": 2.5, "savings": 4, "dividend": 10, "emergency": 3.5, "operating": 60, "investment": 10}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT accounting_config_profile_id_key UNIQUE (profile_id)
);

-- Create Table: system_settings (Idempotent)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed System Settings if not exists
INSERT INTO public.system_settings (key, value)
VALUES ('accounting_module', '{"is_active": true, "trial_duration_days": 14}')
ON CONFLICT (key) DO NOTHING;

-- Ensure RLS is enabled (Optional but good practice)
ALTER TABLE public.accounting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Creating Policies (Idempotent by dropping first?)
-- Or just standard creation which might fail if exists. 
-- Best to wrap in DO block or just ignore "policy already exists" errors in manual run.
-- For script simplicity:

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'accounting_config' AND policyname = 'Users can view their own config'
    ) THEN
        CREATE POLICY "Users can view their own config" ON public.accounting_config
            FOR SELECT USING (auth.uid() = profile_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'accounting_config' AND policyname = 'Users can update their own config'
    ) THEN
        CREATE POLICY "Users can update their own config" ON public.accounting_config
            FOR UPDATE USING (auth.uid() = profile_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'accounting_config' AND policyname = 'Users can insert their own config'
    ) THEN
        CREATE POLICY "Users can insert their own config" ON public.accounting_config
            FOR INSERT WITH CHECK (auth.uid() = profile_id);
    END IF;
END
$$;

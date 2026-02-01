-- Create system_settings table
DROP TABLE IF EXISTS public.system_settings;
CREATE TABLE public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users (Staff/Admin/Superadmin) can view settings
-- We'll allow all authenticated for now to simplify reading payment mode
CREATE POLICY "Authenticated can view settings" ON public.system_settings FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only Admin/Superadmin can update settings
-- Assuming 'admin' role in profiles
CREATE POLICY "Admins can update settings" ON public.system_settings FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'staff') 
    )
);

-- Insert default payment mode if not exists
INSERT INTO public.system_settings (key, value)
VALUES ('payment_mode', 'sandbox')
ON CONFLICT (key) DO NOTHING;

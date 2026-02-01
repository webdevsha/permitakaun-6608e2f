-- Insert default trial period (14 days) if not exists
INSERT INTO public.system_settings (key, value)
VALUES ('trial_period_days', '14')
ON CONFLICT (key) DO NOTHING;

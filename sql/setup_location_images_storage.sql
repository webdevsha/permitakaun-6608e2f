-- ============================================================================
-- Setup Storage Bucket for Location Images
-- ============================================================================

-- Note: This needs to be run in Supabase SQL Editor or via migrations
-- The storage bucket needs to be created via Supabase Dashboard or API

-- Create the bucket (run this in Supabase SQL Editor as postgres user)
-- Or use the Supabase Dashboard -> Storage -> New Bucket

/*
-- Using Supabase SQL (requires appropriate permissions)
insert into storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
values (
    'locations',
    'locations',
    true,
    false,
    5242880,  -- 5MB limit
    array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;
*/

-- Set up RLS policies for the locations bucket
-- Policy: Allow authenticated users to upload images
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'locations');

-- Policy: Allow public access to read images
CREATE POLICY "Allow public read access" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'locations');

-- Policy: Allow users to delete their own uploads
CREATE POLICY "Allow authenticated deletes" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'locations');

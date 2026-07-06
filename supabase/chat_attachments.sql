-- =========================================================
-- CHAT ATTACHMENTS: Images and Videos Support
-- Run this in Supabase Dashboard > SQL Editor
-- =========================================================

-- Add media columns to direct_messages
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- Add media columns to house_messages
ALTER TABLE house_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE house_messages ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- Add media columns to admin_messages
ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- Create attachments bucket in storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
    'video/mp4', 'video/quicktime', 'video/webm', 'video/ogg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage object policies for attachments bucket
DROP POLICY IF EXISTS "attachments_select_public" ON storage.objects;
CREATE POLICY "attachments_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_insert_authenticated" ON storage.objects;
CREATE POLICY "attachments_insert_authenticated" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'attachments' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attachments_delete_own" ON storage.objects;
CREATE POLICY "attachments_delete_own" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'attachments' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

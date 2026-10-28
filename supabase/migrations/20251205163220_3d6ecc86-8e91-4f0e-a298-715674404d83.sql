-- Create storage bucket for WhatsApp media uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  16777216, -- 16MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users to upload to whatsapp-media bucket
CREATE POLICY "Allow authenticated users to upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow public read access to whatsapp-media bucket (needed for MSG91 to access)
CREATE POLICY "Allow public read access to whatsapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Allow authenticated users to update whatsapp media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Allow authenticated users to delete whatsapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');
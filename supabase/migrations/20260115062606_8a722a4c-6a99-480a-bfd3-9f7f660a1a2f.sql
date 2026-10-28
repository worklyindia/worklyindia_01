-- Create temporary downloads bucket (private, auto-cleanup)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-downloads',
  'temp-downloads',
  false,
  52428800,
  ARRAY['application/pdf', 'text/csv', 'application/json', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload to their folder
CREATE POLICY "Users can upload temp files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'temp-downloads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can read their own files
CREATE POLICY "Users can read own temp files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'temp-downloads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete their own files
CREATE POLICY "Users can delete own temp files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'temp-downloads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Service role has full access (for Edge Functions)
CREATE POLICY "Service role full access temp downloads"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'temp-downloads')
WITH CHECK (bucket_id = 'temp-downloads');
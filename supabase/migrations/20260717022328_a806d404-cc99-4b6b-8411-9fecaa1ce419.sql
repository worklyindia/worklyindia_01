
-- RLS policies for resume-pdfs storage bucket: users manage their own folder
CREATE POLICY "Users can upload their own resume PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resume-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own resume PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resume-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own resume PDFs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resume-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own resume PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resume-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

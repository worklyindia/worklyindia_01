-- Add WhatsApp number field to profiles table
ALTER TABLE public.profiles ADD COLUMN whatsapp_number text;

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);

-- Create RLS policies for profile photos bucket
CREATE POLICY "Users can view all profile photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photos" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'profile-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile photos" ON storage.objects FOR UPDATE USING (
  bucket_id = 'profile-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile photos" ON storage.objects FOR DELETE USING (
  bucket_id = 'profile-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
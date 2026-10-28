-- Create storage bucket for cached audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cached-voice-audio',
  'cached-voice-audio',
  true,
  10485760, -- 10MB limit
  ARRAY['audio/mpeg', 'audio/mp3']
);

-- Create RLS policies for cached audio bucket
CREATE POLICY "Public can read cached audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'cached-voice-audio');

CREATE POLICY "Service role can insert cached audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cached-voice-audio');

CREATE POLICY "Service role can delete cached audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'cached-voice-audio');

-- Create cached_audio table
CREATE TABLE public.cached_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash TEXT UNIQUE NOT NULL,
  original_text TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  access_count INTEGER DEFAULT 1
);

-- Create index for faster lookups
CREATE INDEX idx_cached_audio_text_hash ON public.cached_audio(text_hash);
CREATE INDEX idx_cached_audio_last_accessed ON public.cached_audio(last_accessed_at);

-- Enable RLS
ALTER TABLE public.cached_audio ENABLE ROW LEVEL SECURITY;

-- RLS policies for cached_audio
CREATE POLICY "Public can read cached audio records"
ON public.cached_audio FOR SELECT
USING (true);

CREATE POLICY "Service role can manage cached audio"
ON public.cached_audio FOR ALL
USING (true)
WITH CHECK (true);

-- Function to cleanup old cached audio
CREATE OR REPLACE FUNCTION public.cleanup_old_cached_audio()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  audio_record RECORD;
  file_path TEXT;
BEGIN
  -- Find records older than 7 days
  FOR audio_record IN 
    SELECT id, audio_url 
    FROM public.cached_audio 
    WHERE last_accessed_at < NOW() - INTERVAL '7 days'
  LOOP
    -- Extract file path from URL
    file_path := SUBSTRING(audio_record.audio_url FROM 'cached-voice-audio/(.*)$');
    
    -- Delete from storage
    IF file_path IS NOT NULL THEN
      DELETE FROM storage.objects 
      WHERE bucket_id = 'cached-voice-audio' 
      AND name = file_path;
    END IF;
    
    -- Delete database record
    DELETE FROM public.cached_audio WHERE id = audio_record.id;
  END LOOP;
END;
$$;
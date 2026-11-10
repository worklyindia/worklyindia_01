-- Fix search_path for cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_cached_audio()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
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
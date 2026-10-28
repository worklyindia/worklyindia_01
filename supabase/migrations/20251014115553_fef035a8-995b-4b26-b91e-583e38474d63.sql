-- Add YouTube Live streaming columns to interviews table
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS youtube_stream_key text,
ADD COLUMN IF NOT EXISTS youtube_stream_url text,
ADD COLUMN IF NOT EXISTS is_streaming_to_youtube boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.interviews.youtube_stream_key IS 'Encrypted YouTube stream key for RTMP streaming';
COMMENT ON COLUMN public.interviews.youtube_stream_url IS 'Public YouTube watch URL for the live stream';
COMMENT ON COLUMN public.interviews.is_streaming_to_youtube IS 'Current YouTube streaming status';
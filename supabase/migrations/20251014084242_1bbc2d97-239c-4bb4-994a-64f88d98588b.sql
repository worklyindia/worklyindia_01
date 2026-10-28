-- Add duration-based pricing columns to interview_pricing_settings
ALTER TABLE interview_pricing_settings 
ADD COLUMN IF NOT EXISTS points_per_minute INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS minimum_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS enable_duration_pricing BOOLEAN DEFAULT true;

-- Create YouTube streaming settings table for Daily.co live streaming
CREATE TABLE IF NOT EXISTS youtube_streaming_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  youtube_channel_id TEXT,
  rtmp_url TEXT,
  stream_key TEXT,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on youtube_streaming_settings
ALTER TABLE youtube_streaming_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for youtube_streaming_settings
CREATE POLICY "Users can manage their own streaming settings"
ON youtube_streaming_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger for youtube_streaming_settings
CREATE TRIGGER update_youtube_streaming_settings_updated_at
BEFORE UPDATE ON youtube_streaming_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
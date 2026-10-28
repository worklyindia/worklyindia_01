-- Create site_settings table for managing social media links and other site settings
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read settings
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can update settings (you can make this more restrictive later)
CREATE POLICY "Authenticated users can update site settings"
  ON public.site_settings
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can insert settings
CREATE POLICY "Authenticated users can insert site settings"
  ON public.site_settings
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Insert default social media links
INSERT INTO public.site_settings (key, value) VALUES
  ('social_links', '{
    "instagram": "https://www.instagram.com/official.Workly India.india",
    "facebook": "https://www.facebook.com/share/1H4Fxqwttx/",
    "youtube": "https://youtube.com/@wfh_india",
    "twitter": "https://x.com/WFHindia",
    "telegram": "https://t.me/WFHINDIA_OFFICIAL",
    "instagram_handle": "@official.Workly India.india",
    "facebook_handle": "Workly India",
    "youtube_handle": "@wfh_india",
    "twitter_handle": "@WFHindia",
    "telegram_handle": "Official Channel"
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER trigger_update_site_settings_timestamp
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_updated_at();
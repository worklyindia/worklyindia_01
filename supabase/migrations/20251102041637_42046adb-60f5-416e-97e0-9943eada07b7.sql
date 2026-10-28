-- Create app_settings table for managing app download links
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Insert default values for app download links
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  ('android_app_url', '', 'Google Play Store link for Android app'),
  ('ios_app_url', '', 'Apple App Store link for iOS app'),
  ('show_download_buttons', 'true', 'Show/hide app download buttons on auth pages')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings (for showing buttons)
CREATE POLICY "Allow public read access to app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY "Allow admins to update app_settings"
  ON public.app_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('admin', 'owner')
    )
  );

-- Create app_download_tracking table for analytics
CREATE TABLE IF NOT EXISTS public.app_download_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  user_type text NOT NULL CHECK (user_type IN ('job_seeker', 'employer')),
  clicked_from text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  clicked_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.app_download_tracking ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert tracking data
CREATE POLICY "Allow insert for tracking"
  ON public.app_download_tracking FOR INSERT
  WITH CHECK (true);

-- Only admins can view tracking data
CREATE POLICY "Allow admins to view tracking"
  ON public.app_download_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('admin', 'owner')
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_app_download_tracking_platform ON public.app_download_tracking(platform);
CREATE INDEX IF NOT EXISTS idx_app_download_tracking_user_type ON public.app_download_tracking(user_type);
CREATE INDEX IF NOT EXISTS idx_app_download_tracking_clicked_at ON public.app_download_tracking(clicked_at DESC);
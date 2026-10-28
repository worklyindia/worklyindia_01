-- Create platform_settings table for brand assets
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  brand_name TEXT,
  brand_tagline TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  og_image_url TEXT,
  og_title TEXT,
  og_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for reading (public access)
CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings
FOR SELECT
USING (true);

-- Create policy for admin updates (only authenticated users can update)
CREATE POLICY "Authenticated users can update platform settings"
ON public.platform_settings
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Create policy for admin inserts
CREATE POLICY "Authenticated users can insert platform settings"
ON public.platform_settings
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Insert default record if none exists
INSERT INTO public.platform_settings (brand_name, brand_tagline, primary_color, secondary_color)
VALUES ('Workly India', 'Workly India Jobs in India', '#8B5CF6', '#3B82F6')
ON CONFLICT DO NOTHING;

-- Create function to get brand assets
CREATE OR REPLACE FUNCTION public.get_brand_assets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT to_jsonb(ps.*) INTO result
  FROM public.platform_settings ps
  LIMIT 1;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Create function to update brand assets
CREATE OR REPLACE FUNCTION public.update_brand_assets(p_assets jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Update the first record (there should only be one)
  UPDATE public.platform_settings
  SET
    logo_url = COALESCE(p_assets->>'logo_url', logo_url),
    logo_dark_url = COALESCE(p_assets->>'logo_dark_url', logo_dark_url),
    favicon_url = COALESCE(p_assets->>'favicon_url', favicon_url),
    brand_name = COALESCE(p_assets->>'brand_name', brand_name),
    brand_tagline = COALESCE(p_assets->>'brand_tagline', brand_tagline),
    primary_color = COALESCE(p_assets->>'primary_color', primary_color),
    secondary_color = COALESCE(p_assets->>'secondary_color', secondary_color),
    og_image_url = COALESCE(p_assets->>'og_image_url', og_image_url),
    og_title = COALESCE(p_assets->>'og_title', og_title),
    og_description = COALESCE(p_assets->>'og_description', og_description),
    updated_at = now()
  RETURNING to_jsonb(platform_settings.*) INTO result;
  
  -- If no record was updated, insert a new one
  IF result IS NULL THEN
    INSERT INTO public.platform_settings (
      logo_url, logo_dark_url, favicon_url, brand_name, brand_tagline,
      primary_color, secondary_color, og_image_url, og_title, og_description
    )
    VALUES (
      p_assets->>'logo_url',
      p_assets->>'logo_dark_url',
      p_assets->>'favicon_url',
      p_assets->>'brand_name',
      p_assets->>'brand_tagline',
      p_assets->>'primary_color',
      p_assets->>'secondary_color',
      p_assets->>'og_image_url',
      p_assets->>'og_title',
      p_assets->>'og_description'
    )
    RETURNING to_jsonb(platform_settings.*) INTO result;
  END IF;
  
  RETURN result;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
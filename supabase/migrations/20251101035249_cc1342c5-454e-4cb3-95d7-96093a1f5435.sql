-- Create storage bucket for brand assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create brand_assets table
CREATE TABLE IF NOT EXISTS public.brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  brand_name TEXT DEFAULT 'Workly India',
  brand_tagline TEXT DEFAULT 'Workly India Jobs in India',
  primary_color TEXT DEFAULT '#8B5CF6',
  secondary_color TEXT DEFAULT '#3B82F6',
  og_image_url TEXT,
  og_title TEXT,
  og_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to brand assets"
ON public.brand_assets
FOR SELECT
USING (true);

-- Allow authenticated users to insert/update (owner portal access)
CREATE POLICY "Allow authenticated users to manage brand assets"
ON public.brand_assets
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Create RPC function to get brand assets
CREATE OR REPLACE FUNCTION public.get_brand_assets()
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT row_to_json(ba.*)::jsonb 
     FROM public.brand_assets ba 
     ORDER BY ba.created_at DESC 
     LIMIT 1),
    '{}'::jsonb
  );
$$;

-- Create RPC function to update brand assets
CREATE OR REPLACE FUNCTION public.update_brand_assets(p_assets JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Get existing record ID
  SELECT id INTO v_existing_id FROM public.brand_assets ORDER BY created_at DESC LIMIT 1;
  
  IF v_existing_id IS NULL THEN
    -- Insert new record
    INSERT INTO public.brand_assets (
      logo_url, logo_dark_url, favicon_url, 
      brand_name, brand_tagline, 
      primary_color, secondary_color, 
      og_image_url, og_title, og_description,
      updated_at
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
      p_assets->>'og_description',
      NOW()
    );
  ELSE
    -- Update existing record
    UPDATE public.brand_assets SET
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
      updated_at = NOW()
    WHERE id = v_existing_id;
  END IF;
END;
$$;

-- Storage policies for public-assets bucket
CREATE POLICY "Allow public read access to public assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'public-assets');

CREATE POLICY "Allow authenticated users to upload public assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'public-assets' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update public assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'public-assets' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete public assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'public-assets' 
  AND auth.role() = 'authenticated'
);
-- Recreate update_brand_assets function with proper transaction handling
CREATE OR REPLACE FUNCTION public.update_brand_assets(p_assets jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  v_id uuid;
BEGIN
  -- Get the first record ID
  SELECT id INTO v_id FROM public.platform_settings LIMIT 1;
  
  -- Update existing record or insert if none exists
  IF v_id IS NOT NULL THEN
    UPDATE public.platform_settings
    SET
      logo_url = p_assets->>'logo_url',
      logo_dark_url = p_assets->>'logo_dark_url',
      favicon_url = p_assets->>'favicon_url',
      brand_name = p_assets->>'brand_name',
      brand_tagline = p_assets->>'brand_tagline',
      primary_color = p_assets->>'primary_color',
      secondary_color = p_assets->>'secondary_color',
      og_image_url = p_assets->>'og_image_url',
      og_title = p_assets->>'og_title',
      og_description = p_assets->>'og_description',
      updated_at = now()
    WHERE id = v_id
    RETURNING to_jsonb(platform_settings.*) INTO result;
  ELSE
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
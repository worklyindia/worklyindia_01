-- Fix search_path security warning for update_brand_assets function
DROP FUNCTION IF EXISTS public.update_brand_assets(jsonb);

CREATE OR REPLACE FUNCTION public.update_brand_assets(p_assets jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_count integer;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if record exists
  SELECT COUNT(*) INTO v_count FROM public.brand_assets LIMIT 1;
  
  IF v_count = 0 THEN
    -- Insert new record with provided values
    INSERT INTO public.brand_assets (
      logo_url,
      logo_dark_url,
      favicon_url,
      brand_name,
      brand_tagline,
      primary_color,
      secondary_color,
      og_image_url,
      og_title,
      og_description
    ) VALUES (
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
    RETURNING to_jsonb(brand_assets.*) INTO v_result;
  ELSE
    -- Update existing record - only update fields that are provided in p_assets
    UPDATE public.brand_assets SET
      logo_url = CASE WHEN p_assets ? 'logo_url' THEN p_assets->>'logo_url' ELSE logo_url END,
      logo_dark_url = CASE WHEN p_assets ? 'logo_dark_url' THEN p_assets->>'logo_dark_url' ELSE logo_dark_url END,
      favicon_url = CASE WHEN p_assets ? 'favicon_url' THEN p_assets->>'favicon_url' ELSE favicon_url END,
      brand_name = CASE WHEN p_assets ? 'brand_name' THEN p_assets->>'brand_name' ELSE brand_name END,
      brand_tagline = CASE WHEN p_assets ? 'brand_tagline' THEN p_assets->>'brand_tagline' ELSE brand_tagline END,
      primary_color = CASE WHEN p_assets ? 'primary_color' THEN p_assets->>'primary_color' ELSE primary_color END,
      secondary_color = CASE WHEN p_assets ? 'secondary_color' THEN p_assets->>'secondary_color' ELSE secondary_color END,
      og_image_url = CASE WHEN p_assets ? 'og_image_url' THEN p_assets->>'og_image_url' ELSE og_image_url END,
      og_title = CASE WHEN p_assets ? 'og_title' THEN p_assets->>'og_title' ELSE og_title END,
      og_description = CASE WHEN p_assets ? 'og_description' THEN p_assets->>'og_description' ELSE og_description END,
      updated_at = now()
    RETURNING to_jsonb(brand_assets.*) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;
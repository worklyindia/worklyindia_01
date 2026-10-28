-- Drop the old conflicting function (2-parameter version)
DROP FUNCTION IF EXISTS public.update_brand_assets(jsonb, uuid);

-- Migrate data from brand_assets to platform_settings if it exists
DO $$
DECLARE
  v_latest_assets RECORD;
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'brand_assets') THEN
    IF EXISTS (SELECT 1 FROM brand_assets LIMIT 1) THEN
      -- Get the latest brand assets record
      SELECT * INTO v_latest_assets
      FROM brand_assets
      ORDER BY created_at DESC
      LIMIT 1;
      
      -- Update platform_settings with the data
      UPDATE platform_settings
      SET
        logo_url = COALESCE(v_latest_assets.logo_url, logo_url),
        logo_dark_url = COALESCE(v_latest_assets.logo_dark_url, logo_dark_url),
        favicon_url = COALESCE(v_latest_assets.favicon_url, favicon_url),
        brand_name = COALESCE(v_latest_assets.brand_name, brand_name),
        brand_tagline = COALESCE(v_latest_assets.brand_tagline, brand_tagline),
        primary_color = COALESCE(v_latest_assets.primary_color, primary_color),
        secondary_color = COALESCE(v_latest_assets.secondary_color, secondary_color),
        og_image_url = COALESCE(v_latest_assets.og_image_url, og_image_url),
        og_title = COALESCE(v_latest_assets.og_title, og_title),
        og_description = COALESCE(v_latest_assets.og_description, og_description);
    END IF;
  END IF;
END $$;

-- Drop the old brand_assets table after migration
DROP TABLE IF EXISTS public.brand_assets CASCADE;
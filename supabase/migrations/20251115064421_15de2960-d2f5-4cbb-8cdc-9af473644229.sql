-- Add link_url column to hero_banners table
ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS link_url TEXT;

COMMENT ON COLUMN hero_banners.link_url IS 'Optional URL to redirect when banner is clicked';

-- Drop and recreate the RPC function to include link_url
DROP FUNCTION IF EXISTS get_active_hero_banners();

CREATE FUNCTION get_active_hero_banners()
RETURNS TABLE (
  id UUID,
  title TEXT,
  subtitle TEXT,
  gradient TEXT,
  image_url TEXT,
  link_url TEXT
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, title, subtitle, gradient, image_url, link_url
  FROM hero_banners
  WHERE is_active = true
  ORDER BY sort_order ASC, created_at DESC;
$$;
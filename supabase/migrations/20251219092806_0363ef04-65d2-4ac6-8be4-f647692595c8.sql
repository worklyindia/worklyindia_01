-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_active_hero_banners();

-- Recreate with youtube_url column
CREATE FUNCTION public.get_active_hero_banners()
RETURNS TABLE(id uuid, title text, subtitle text, gradient text, image_url text, youtube_url text, link_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, subtitle, gradient, image_url, youtube_url, link_url
  FROM hero_banners
  WHERE is_active = true
  ORDER BY sort_order ASC, created_at DESC;
$$;
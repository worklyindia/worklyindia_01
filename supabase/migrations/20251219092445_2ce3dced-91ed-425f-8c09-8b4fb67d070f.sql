-- Add youtube_url column to hero_banners table for video banner support
ALTER TABLE public.hero_banners ADD COLUMN youtube_url TEXT DEFAULT NULL;

-- Add a comment to describe the column
COMMENT ON COLUMN public.hero_banners.youtube_url IS 'YouTube video URL for video-only banners';
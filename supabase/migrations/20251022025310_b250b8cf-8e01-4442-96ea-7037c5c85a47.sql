-- Clean any existing duplicate reviews (keep the most recent one)
DELETE FROM app_reviews a
USING app_reviews b
WHERE a.user_id = b.user_id 
AND a.created_at < b.created_at;

-- Add unique constraint to prevent multiple reviews per user
ALTER TABLE public.app_reviews 
ADD CONSTRAINT unique_user_app_review UNIQUE (user_id);

-- Enable real-time updates for app_reviews table
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_reviews;
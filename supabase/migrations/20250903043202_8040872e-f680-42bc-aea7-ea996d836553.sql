-- Add social media links to profiles table
ALTER TABLE public.profiles 
ADD COLUMN instagram_link TEXT,
ADD COLUMN facebook_link TEXT,
ADD COLUMN youtube_link TEXT,
ADD COLUMN linkedin_link TEXT;
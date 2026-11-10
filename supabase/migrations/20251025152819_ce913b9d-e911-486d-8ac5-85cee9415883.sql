-- Add video_platform column to interviews table
ALTER TABLE public.interviews 
ADD COLUMN video_platform TEXT;
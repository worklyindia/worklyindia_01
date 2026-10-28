-- Add new fields to jobs table for enhanced job posting
ALTER TABLE public.jobs 
ADD COLUMN languages TEXT[] DEFAULT NULL,
ADD COLUMN video_title_1 TEXT DEFAULT NULL,
ADD COLUMN video_url_1 TEXT DEFAULT NULL,
ADD COLUMN video_title_2 TEXT DEFAULT NULL,
ADD COLUMN video_url_2 TEXT DEFAULT NULL,
ADD COLUMN salary_min INTEGER DEFAULT NULL,
ADD COLUMN salary_max INTEGER DEFAULT NULL,
ADD COLUMN salary_period TEXT DEFAULT NULL;
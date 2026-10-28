-- Add scheduled_end_at column to interviews table
ALTER TABLE public.interviews 
ADD COLUMN scheduled_end_at timestamp with time zone;
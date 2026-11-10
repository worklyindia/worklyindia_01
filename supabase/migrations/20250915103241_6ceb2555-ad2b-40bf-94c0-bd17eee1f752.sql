-- Fix the net.http_post error by checking and removing problematic functions
-- First, let's see what functions might be causing this

-- Drop any problematic triggers or functions that might be calling net.http_post
-- This is likely from a cron job or trigger that was set up incorrectly

-- Check if there are any triggers on jobs table that might be causing HTTP calls
SELECT tgname, tgfoid::regproc 
FROM pg_trigger 
WHERE tgrelid = 'public.jobs'::regclass
AND tgname LIKE '%http%' OR tgname LIKE '%notify%' OR tgname LIKE '%webhook%';
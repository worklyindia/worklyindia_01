-- Fix duplicate job posting settings by keeping only the latest active record
UPDATE job_posting_settings 
SET is_active = false, updated_at = now()
WHERE id NOT IN (
  SELECT id FROM job_posting_settings 
  WHERE is_active = true 
  ORDER BY created_at DESC 
  LIMIT 1
) AND is_active = true;
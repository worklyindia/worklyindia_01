-- Add columns for 100ms prebuilt URLs to interviews table
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS hms_host_prebuilt_url TEXT,
ADD COLUMN IF NOT EXISTS hms_participant_prebuilt_urls JSONB;
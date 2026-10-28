-- Add API contact fields to jobs table
-- These fields will store contact details provided when a job is posted via API

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS api_email TEXT,
ADD COLUMN IF NOT EXISTS api_hr_contact_name TEXT,
ADD COLUMN IF NOT EXISTS api_phone TEXT,
ADD COLUMN IF NOT EXISTS api_whatsapp_number TEXT;

-- Add comment to document these fields
COMMENT ON COLUMN public.jobs.api_email IS 'Email contact provided via API when posting job';
COMMENT ON COLUMN public.jobs.api_hr_contact_name IS 'HR contact name provided via API when posting job';
COMMENT ON COLUMN public.jobs.api_phone IS 'Phone number provided via API when posting job';
COMMENT ON COLUMN public.jobs.api_whatsapp_number IS 'WhatsApp number provided via API when posting job';
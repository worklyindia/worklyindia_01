-- Add missing job_posting_visibility column to companies table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'companies' 
                  AND column_name = 'job_posting_visibility') THEN
        ALTER TABLE public.companies 
        ADD COLUMN job_posting_visibility boolean NOT NULL DEFAULT true;
    END IF;
END$$;

-- Add ban_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'companies' 
                  AND column_name = 'ban_type') THEN
        ALTER TABLE public.companies 
        ADD COLUMN ban_type text;
    END IF;
END$$;

-- Update existing companies to have job_posting_visibility = true by default
UPDATE public.companies 
SET job_posting_visibility = true 
WHERE job_posting_visibility IS NULL;
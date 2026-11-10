
-- Add new job posting fields
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS openings integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS application_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS work_mode text, -- 'onsite' | 'remote' | 'hybrid'
  ADD COLUMN IF NOT EXISTS education_required text, -- '10th' | '12th' | 'diploma' | 'graduate' | 'postgraduate' | 'any'
  ADD COLUMN IF NOT EXISTS shift_timing text, -- 'day' | 'night' | 'rotational' | 'flexible'
  ADD COLUMN IF NOT EXISTS immediate_joining boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hiring_urgency text DEFAULT 'normal', -- 'urgent' | 'normal'
  ADD COLUMN IF NOT EXISTS apply_mode text DEFAULT 'internal', -- 'internal' | 'external' | 'both'
  ADD COLUMN IF NOT EXISTS resume_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cover_letter_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_email_confirmation boolean DEFAULT true;

COMMENT ON COLUMN public.jobs.openings IS 'Number of vacancies';
COMMENT ON COLUMN public.jobs.apply_mode IS 'internal | external | both';

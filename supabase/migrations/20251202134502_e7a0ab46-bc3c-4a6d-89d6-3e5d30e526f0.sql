-- Add status and rejection_reason columns to whatsapp_templates
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS msg91_template_id TEXT,
ADD COLUMN IF NOT EXISTS header_type TEXT,
ADD COLUMN IF NOT EXISTS header_content TEXT,
ADD COLUMN IF NOT EXISTS footer TEXT,
ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Add constraint for valid status values
ALTER TABLE public.whatsapp_templates 
DROP CONSTRAINT IF EXISTS whatsapp_templates_status_check;

ALTER TABLE public.whatsapp_templates 
ADD CONSTRAINT whatsapp_templates_status_check 
CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON public.whatsapp_templates(status);
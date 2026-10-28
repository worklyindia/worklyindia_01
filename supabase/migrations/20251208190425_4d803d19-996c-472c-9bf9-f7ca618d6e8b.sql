-- Create whatsapp_human_handoff table for tracking 24-hour AI pause
CREATE TABLE public.whatsapp_human_handoff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  reason TEXT,
  handoff_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX idx_whatsapp_human_handoff_phone ON public.whatsapp_human_handoff(phone_number);
CREATE INDEX idx_whatsapp_human_handoff_active ON public.whatsapp_human_handoff(phone_number, resolved, expires_at);

-- Enable RLS
ALTER TABLE public.whatsapp_human_handoff ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage handoffs"
ON public.whatsapp_human_handoff
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.whatsapp_human_handoff IS 'Tracks phone numbers in human handoff mode where AI is paused for 24 hours';
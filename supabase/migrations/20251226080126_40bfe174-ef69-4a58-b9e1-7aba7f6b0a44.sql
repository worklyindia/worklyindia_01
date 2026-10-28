-- Create onesignal_automation_rules table for push notification triggers
CREATE TABLE IF NOT EXISTS public.onesignal_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL UNIQUE,
  title_template TEXT NOT NULL DEFAULT 'Notification',
  message_template TEXT NOT NULL DEFAULT 'You have a new notification',
  action_url_template TEXT,
  icon_url TEXT,
  image_url TEXT,
  delay_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  target_user_type TEXT DEFAULT 'website_user' CHECK (target_user_type IN ('website_user', 'employer')),
  trigger_conditions JSONB DEFAULT '{}',
  variable_mapping JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onesignal_automation_rules ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admin users can manage onesignal automation rules"
ON public.onesignal_automation_rules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onesignal_automation_rules_event ON public.onesignal_automation_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_onesignal_automation_rules_active ON public.onesignal_automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_onesignal_automation_rules_user_type ON public.onesignal_automation_rules(target_user_type);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_onesignal_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_onesignal_automation_rules_timestamp
BEFORE UPDATE ON public.onesignal_automation_rules
FOR EACH ROW
EXECUTE FUNCTION update_onesignal_automation_rules_updated_at();
-- Create telegram_automation_rules table (similar to whatsapp_automation_rules)
CREATE TABLE public.telegram_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}',
  template_id UUID REFERENCES public.telegram_message_templates(id) ON DELETE SET NULL,
  variable_mapping JSONB DEFAULT '{}',
  delay_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  target_user_type TEXT DEFAULT 'both'
);

-- Add new columns to existing telegram_trigger_logs table
ALTER TABLE public.telegram_trigger_logs 
  ADD COLUMN IF NOT EXISTS trigger_event TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS recipient_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS template_variables JSONB,
  ADD COLUMN IF NOT EXISTS message_content TEXT,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_response JSONB,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS delivery_channel TEXT DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS trigger_source TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS
ALTER TABLE public.telegram_automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for telegram_automation_rules
CREATE POLICY "Admin users can manage telegram automation rules" 
  ON public.telegram_automation_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view active telegram rules"
  ON public.telegram_automation_rules FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX idx_telegram_automation_rules_trigger_event ON public.telegram_automation_rules(trigger_event);
CREATE INDEX idx_telegram_automation_rules_is_active ON public.telegram_automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_telegram_trigger_logs_trigger_event ON public.telegram_trigger_logs(trigger_event);
CREATE INDEX IF NOT EXISTS idx_telegram_trigger_logs_status ON public.telegram_trigger_logs(status);

-- Add updated_at trigger
CREATE TRIGGER update_telegram_automation_rules_updated_at
  BEFORE UPDATE ON public.telegram_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Fix telegram_trigger_logs FK constraint to reference telegram_automation_rules instead of telegram_triggers

-- Drop the old FK constraint if exists
ALTER TABLE public.telegram_trigger_logs 
DROP CONSTRAINT IF EXISTS telegram_trigger_logs_trigger_id_fkey;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_trigger_logs_trigger_id ON public.telegram_trigger_logs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_telegram_trigger_logs_trigger_event ON public.telegram_trigger_logs(trigger_event);
CREATE INDEX IF NOT EXISTS idx_telegram_trigger_logs_recipient_user_id ON public.telegram_trigger_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_trigger_logs_executed_at ON public.telegram_trigger_logs(executed_at DESC);

-- Add rule_name column if not exists for better logging
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'telegram_trigger_logs' 
                 AND column_name = 'rule_name') THEN
    ALTER TABLE public.telegram_trigger_logs ADD COLUMN rule_name text;
  END IF;
END $$;
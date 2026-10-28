-- Enable required extensions for automated scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the referral cycle management function to run every 5 minutes
-- This will handle:
-- 1. Cycle initialization on 1st of month (00:00-00:05 IST)
-- 2. Cycle finalization on last day (23:55-23:59 IST)
-- 3. Winner determination and reward distribution
SELECT cron.schedule(
  'manage-referral-cycles-every-5-minutes',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/manage-referral-cycles',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
        body := jsonb_build_object('timestamp', now(), 'automated', true)
    ) as request_id;
  $$
);

-- Initialize current month cycle if no active cycle exists
DO $$
DECLARE
  v_active_cycle_count INTEGER;
BEGIN
  -- Check if there's an active cycle
  SELECT COUNT(*) INTO v_active_cycle_count
  FROM referral_leaderboard_cycles
  WHERE status = 'active';
  
  -- If no active cycle exists, create one for current month
  IF v_active_cycle_count = 0 THEN
    PERFORM initialize_monthly_cycle();
    RAISE NOTICE 'Initial monthly cycle created successfully';
  ELSE
    RAISE NOTICE 'Active cycle already exists, skipping initialization';
  END IF;
END $$;
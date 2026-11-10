
-- Add cron job to auto-expire AI chat subscriptions daily at 00:05 IST (18:35 UTC previous day)
SELECT cron.schedule(
  'auto-expire-ai-subscriptions',
  '35 18 * * *',
  $$UPDATE ai_chat_subscriptions 
    SET status = 'expired', updated_at = NOW()
    WHERE ends_at < NOW() 
    AND status = 'active'$$
);

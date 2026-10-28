-- Create Telegram Message Queue table for rate limiting and retry logic
CREATE TABLE public.telegram_message_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_content TEXT NOT NULL,
  parse_mode TEXT DEFAULT 'HTML',
  priority INTEGER DEFAULT 5, -- 1=highest (OTP, 2FA), 5=normal, 10=lowest (digest, bulk)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_message TEXT,
  telegram_message_id BIGINT,
  metadata JSONB DEFAULT '{}',
  trigger_rule_id UUID REFERENCES telegram_automation_rules(id),
  trigger_log_id UUID REFERENCES telegram_trigger_logs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient queue processing
CREATE INDEX idx_telegram_queue_status_priority ON telegram_message_queue(status, priority, next_retry_at);
CREATE INDEX idx_telegram_queue_pending ON telegram_message_queue(status, next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_telegram_queue_chat_id ON telegram_message_queue(chat_id);
CREATE INDEX idx_telegram_queue_created_at ON telegram_message_queue(created_at);

-- Create rate limit tracking table
CREATE TABLE public.telegram_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  max_messages INTEGER DEFAULT 25, -- Keep under 30/sec limit with buffer
  is_throttled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_telegram_rate_limits_window ON telegram_rate_limits(window_start, window_end);

-- Create queue processing stats table
CREATE TABLE public.telegram_queue_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hour INTEGER NOT NULL DEFAULT EXTRACT(HOUR FROM now()),
  messages_queued INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  messages_retried INTEGER DEFAULT 0,
  avg_delivery_time_ms INTEGER DEFAULT 0,
  peak_queue_size INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(stat_date, hour)
);

-- Enable RLS
ALTER TABLE telegram_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_queue_stats ENABLE ROW LEVEL SECURITY;

-- Service role policies (edge functions)
CREATE POLICY "Service role full access to queue" ON telegram_message_queue FOR ALL USING (true);
CREATE POLICY "Service role full access to rate limits" ON telegram_rate_limits FOR ALL USING (true);
CREATE POLICY "Service role full access to queue stats" ON telegram_queue_stats FOR ALL USING (true);

-- Function to add message to queue with priority
CREATE OR REPLACE FUNCTION add_telegram_to_queue(
  p_chat_id BIGINT,
  p_message TEXT,
  p_priority INTEGER DEFAULT 5,
  p_parse_mode TEXT DEFAULT 'HTML',
  p_metadata JSONB DEFAULT '{}',
  p_trigger_rule_id UUID DEFAULT NULL,
  p_trigger_log_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  INSERT INTO telegram_message_queue (
    chat_id, message_content, priority, parse_mode, 
    metadata, trigger_rule_id, trigger_log_id, status, next_retry_at
  ) VALUES (
    p_chat_id, p_message, p_priority, p_parse_mode,
    p_metadata, p_trigger_rule_id, p_trigger_log_id, 'pending', now()
  )
  RETURNING id INTO v_queue_id;
  
  -- Update stats
  INSERT INTO telegram_queue_stats (stat_date, hour, messages_queued)
  VALUES (CURRENT_DATE, EXTRACT(HOUR FROM now())::INTEGER, 1)
  ON CONFLICT (stat_date, hour) 
  DO UPDATE SET messages_queued = telegram_queue_stats.messages_queued + 1, updated_at = now();
  
  RETURN v_queue_id;
END;
$$;

-- Function to get next batch of messages to process (rate-limited)
CREATE OR REPLACE FUNCTION get_telegram_queue_batch(p_batch_size INTEGER DEFAULT 25)
RETURNS TABLE(
  id UUID,
  chat_id BIGINT,
  message_content TEXT,
  parse_mode TEXT,
  priority INTEGER,
  retry_count INTEGER,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_window_start TIMESTAMP WITH TIME ZONE;
  v_messages_in_window INTEGER;
BEGIN
  v_current_window_start := date_trunc('second', now());
  
  -- Check rate limit for current second
  SELECT COALESCE(SUM(messages_sent), 0) INTO v_messages_in_window
  FROM telegram_rate_limits
  WHERE window_start >= v_current_window_start - INTERVAL '1 second';
  
  -- If we've sent too many, return empty
  IF v_messages_in_window >= 25 THEN
    RETURN;
  END IF;
  
  -- Calculate how many we can send
  p_batch_size := LEAST(p_batch_size, 25 - v_messages_in_window);
  
  -- Get and lock messages for processing
  RETURN QUERY
  UPDATE telegram_message_queue q
  SET status = 'processing', updated_at = now()
  WHERE q.id IN (
    SELECT q2.id FROM telegram_message_queue q2
    WHERE q2.status = 'pending' 
      AND q2.next_retry_at <= now()
    ORDER BY q2.priority ASC, q2.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.id, q.chat_id, q.message_content, q.parse_mode, q.priority, q.retry_count, q.metadata;
END;
$$;

-- Function to mark message as sent
CREATE OR REPLACE FUNCTION mark_telegram_sent(
  p_queue_id UUID,
  p_telegram_message_id BIGINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE telegram_message_queue
  SET status = 'sent',
      telegram_message_id = p_telegram_message_id,
      sent_at = now(),
      processed_at = now(),
      updated_at = now()
  WHERE id = p_queue_id;
  
  -- Update stats
  INSERT INTO telegram_queue_stats (stat_date, hour, messages_sent)
  VALUES (CURRENT_DATE, EXTRACT(HOUR FROM now())::INTEGER, 1)
  ON CONFLICT (stat_date, hour) 
  DO UPDATE SET messages_sent = telegram_queue_stats.messages_sent + 1, updated_at = now();
  
  -- Record rate limit
  INSERT INTO telegram_rate_limits (window_start, window_end, messages_sent)
  VALUES (date_trunc('second', now()), date_trunc('second', now()) + INTERVAL '1 second', 1)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Function to mark message as failed with retry logic
CREATE OR REPLACE FUNCTION mark_telegram_failed(
  p_queue_id UUID,
  p_error_message TEXT,
  p_is_rate_limited BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retry_count INTEGER;
  v_max_retries INTEGER;
  v_next_retry TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
  FROM telegram_message_queue WHERE id = p_queue_id;
  
  v_retry_count := COALESCE(v_retry_count, 0) + 1;
  
  -- Exponential backoff: 5s, 30s, 2min, 10min, 30min
  IF p_is_rate_limited THEN
    -- For rate limits, wait longer
    v_next_retry := now() + (INTERVAL '30 seconds' * power(2, v_retry_count - 1));
  ELSE
    v_next_retry := now() + (INTERVAL '5 seconds' * power(2, v_retry_count - 1));
  END IF;
  
  IF v_retry_count >= v_max_retries THEN
    -- Max retries reached, mark as permanently failed
    UPDATE telegram_message_queue
    SET status = 'failed',
        retry_count = v_retry_count,
        error_message = p_error_message,
        processed_at = now(),
        updated_at = now()
    WHERE id = p_queue_id;
    
    -- Update failed stats
    INSERT INTO telegram_queue_stats (stat_date, hour, messages_failed)
    VALUES (CURRENT_DATE, EXTRACT(HOUR FROM now())::INTEGER, 1)
    ON CONFLICT (stat_date, hour) 
    DO UPDATE SET messages_failed = telegram_queue_stats.messages_failed + 1, updated_at = now();
  ELSE
    -- Schedule retry
    UPDATE telegram_message_queue
    SET status = 'pending',
        retry_count = v_retry_count,
        error_message = p_error_message,
        next_retry_at = v_next_retry,
        updated_at = now()
    WHERE id = p_queue_id;
    
    -- Update retry stats
    INSERT INTO telegram_queue_stats (stat_date, hour, messages_retried)
    VALUES (CURRENT_DATE, EXTRACT(HOUR FROM now())::INTEGER, 1)
    ON CONFLICT (stat_date, hour) 
    DO UPDATE SET messages_retried = telegram_queue_stats.messages_retried + 1, updated_at = now();
  END IF;
  
  -- Track rate limit hits
  IF p_is_rate_limited THEN
    INSERT INTO telegram_queue_stats (stat_date, hour, rate_limit_hits)
    VALUES (CURRENT_DATE, EXTRACT(HOUR FROM now())::INTEGER, 1)
    ON CONFLICT (stat_date, hour) 
    DO UPDATE SET rate_limit_hits = telegram_queue_stats.rate_limit_hits + 1, updated_at = now();
  END IF;
END;
$$;

-- Cleanup old queue entries (keep 7 days of history)
CREATE OR REPLACE FUNCTION cleanup_telegram_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM telegram_message_queue 
  WHERE status IN ('sent', 'failed', 'cancelled') 
    AND created_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Also cleanup old rate limit records
  DELETE FROM telegram_rate_limits WHERE window_end < now() - INTERVAL '1 hour';
  
  -- Cleanup old stats (keep 90 days)
  DELETE FROM telegram_queue_stats WHERE stat_date < CURRENT_DATE - INTERVAL '90 days';
  
  RETURN v_deleted;
END;
$$;

-- Schedule queue processor to run every 2 seconds
SELECT cron.schedule(
  'telegram-queue-processor',
  '*/2 * * * * *', -- Every 2 seconds (using seconds if supported, otherwise every minute)
  $$
  SELECT net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/telegram-queue-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule queue cleanup daily
SELECT cron.schedule(
  'telegram-queue-cleanup',
  '0 3 * * *', -- 3 AM daily
  $$SELECT cleanup_telegram_queue();$$
);
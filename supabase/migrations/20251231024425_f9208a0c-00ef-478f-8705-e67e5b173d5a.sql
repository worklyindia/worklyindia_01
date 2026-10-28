-- Drop and recreate function with correct column names
DROP FUNCTION IF EXISTS public.get_telegram_queue_batch(integer);

CREATE OR REPLACE FUNCTION public.get_telegram_queue_batch(p_batch_size integer DEFAULT 30)
RETURNS TABLE(
  id uuid,
  chat_id bigint,
  message_content text,
  parse_mode text,
  priority integer,
  status text,
  retry_count integer,
  max_retries integer,
  metadata jsonb,
  trigger_rule_id uuid,
  trigger_log_id uuid,
  created_at timestamptz,
  scheduled_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tq.id,
    tq.chat_id,
    tq.message_content,
    tq.parse_mode,
    tq.priority,
    tq.status,
    tq.retry_count,
    tq.max_retries,
    tq.metadata,
    tq.trigger_rule_id,
    tq.trigger_log_id,
    tq.created_at,
    tq.scheduled_at
  FROM telegram_message_queue tq
  WHERE tq.status = 'pending'
    AND (tq.scheduled_at IS NULL OR tq.scheduled_at <= now())
    AND tq.retry_count < COALESCE(tq.max_retries, 3)
  ORDER BY tq.priority DESC, tq.created_at ASC
  LIMIT p_batch_size;
END;
$$;
-- Drop existing function and recreate with correct return type
DROP FUNCTION IF EXISTS public.get_telegram_queue_batch(integer);

-- Create function to get telegram queue batch for processing
CREATE OR REPLACE FUNCTION public.get_telegram_queue_batch(p_batch_size integer DEFAULT 30)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  telegram_chat_id bigint,
  message_type text,
  message_content text,
  metadata jsonb,
  scheduled_at timestamptz,
  status text,
  retry_count integer,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tq.id,
    tq.user_id,
    tq.telegram_chat_id,
    tq.message_type,
    tq.message_content,
    tq.metadata,
    tq.scheduled_at,
    tq.status,
    tq.retry_count,
    tq.created_at
  FROM telegram_message_queue tq
  WHERE tq.status = 'pending'
    AND (tq.scheduled_at IS NULL OR tq.scheduled_at <= now())
    AND tq.retry_count < 3
  ORDER BY tq.created_at ASC
  LIMIT p_batch_size;
END;
$$;
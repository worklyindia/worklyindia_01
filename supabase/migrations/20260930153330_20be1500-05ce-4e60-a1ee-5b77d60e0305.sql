CREATE OR REPLACE FUNCTION public.increment_ai_chat_usage(p_user_id uuid, p_usage_type text, p_tokens integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status JSONB;
  v_plan JSONB;
  v_usage JSONB;
  v_current_count INTEGER;
  v_limit INTEGER;
  v_allowed BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'User is required');
  END IF;

  IF p_usage_type NOT IN ('message', 'voice_playback', 'voice_input', 'image_analysis') THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Invalid usage type');
  END IF;

  -- Serialize quota reservations per user so simultaneous channels cannot
  -- all pass the same remaining-slot check.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  v_status := public.get_user_ai_chat_status(p_user_id);
  v_plan := v_status->'plan';
  v_usage := v_status->'usage';

  CASE p_usage_type
    WHEN 'message' THEN
      v_current_count := COALESCE((v_usage->>'messages_count')::INTEGER, 0);
      v_limit := COALESCE((v_plan->>'messages_per_month')::INTEGER, 0);
    WHEN 'voice_playback' THEN
      v_current_count := COALESCE((v_usage->>'voice_playback_count')::INTEGER, 0);
      v_limit := COALESCE((v_plan->>'voice_playback_per_month')::INTEGER, 0);
    WHEN 'voice_input' THEN
      v_current_count := COALESCE((v_usage->>'voice_input_count')::INTEGER, 0);
      v_limit := COALESCE((v_plan->>'voice_input_per_month')::INTEGER, 0);
    WHEN 'image_analysis' THEN
      v_current_count := COALESCE((v_usage->>'image_analysis_count')::INTEGER, 0);
      v_limit := COALESCE((v_plan->>'image_analysis_per_month')::INTEGER, 0);
  END CASE;

  v_allowed := v_current_count < v_limit;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Limit reached',
      'current', v_current_count,
      'limit', v_limit,
      'remaining', 0,
      'plan', v_plan->>'name'
    );
  END IF;

  INSERT INTO public.ai_chat_usage (user_id, date, messages_count, voice_playback_count, voice_input_count, image_analysis_count, tokens_used)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_usage_type = 'message' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'voice_playback' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'voice_input' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'image_analysis' THEN 1 ELSE 0 END,
    p_tokens
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    messages_count = public.ai_chat_usage.messages_count + CASE WHEN p_usage_type = 'message' THEN 1 ELSE 0 END,
    voice_playback_count = public.ai_chat_usage.voice_playback_count + CASE WHEN p_usage_type = 'voice_playback' THEN 1 ELSE 0 END,
    voice_input_count = public.ai_chat_usage.voice_input_count + CASE WHEN p_usage_type = 'voice_input' THEN 1 ELSE 0 END,
    image_analysis_count = public.ai_chat_usage.image_analysis_count + CASE WHEN p_usage_type = 'image_analysis' THEN 1 ELSE 0 END,
    tokens_used = public.ai_chat_usage.tokens_used + p_tokens,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(v_limit - v_current_count - 1, 0),
    'limit', v_limit,
    'current', v_current_count + 1,
    'plan', v_plan->>'name'
  );
END;
$function$;
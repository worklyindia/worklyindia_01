-- Drop and recreate get_user_ai_chat_status to fix monthly usage aggregation
DROP FUNCTION IF EXISTS get_user_ai_chat_status(UUID);

CREATE FUNCTION get_user_ai_chat_status(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_plan_id UUID;
  v_subscription RECORD;
  v_usage RECORD;
  v_plan RECORD;
BEGIN
  -- Get active subscription (if exists)
  SELECT * INTO v_subscription
  FROM ai_chat_subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND starts_at <= NOW()
    AND ends_at >= NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get plan_id (from subscription or default to free plan)
  IF v_subscription IS NOT NULL THEN
    v_plan_id := v_subscription.plan_id;
  ELSE
    -- Get free plan
    SELECT id INTO v_plan_id
    FROM ai_chat_plans
    WHERE price_inr = 0
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Get plan details
  SELECT * INTO v_plan
  FROM ai_chat_plans
  WHERE id = v_plan_id;

  -- Get MONTHLY usage aggregated (this is the key fix)
  SELECT 
    COALESCE(SUM(messages_count), 0) as messages_count,
    COALESCE(SUM(voice_playback_count), 0) as voice_playback_count,
    COALESCE(SUM(voice_input_count), 0) as voice_input_count,
    COALESCE(SUM(image_analysis_count), 0) as image_analysis_count,
    COALESCE(SUM(tokens_used), 0) as tokens_used
  INTO v_usage
  FROM ai_chat_usage
  WHERE user_id = p_user_id
    AND date >= date_trunc('month', CURRENT_DATE)
    AND date <= CURRENT_DATE;

  -- Build response JSON
  v_result := json_build_object(
    'plan', row_to_json(v_plan),
    'subscription', CASE 
      WHEN v_subscription IS NOT NULL THEN row_to_json(v_subscription)
      ELSE NULL 
    END,
    'usage', json_build_object(
      'messages_count', COALESCE(v_usage.messages_count, 0),
      'voice_playback_count', COALESCE(v_usage.voice_playback_count, 0),
      'voice_input_count', COALESCE(v_usage.voice_input_count, 0),
      'image_analysis_count', COALESCE(v_usage.image_analysis_count, 0),
      'tokens_used', COALESCE(v_usage.tokens_used, 0)
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
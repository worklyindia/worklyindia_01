-- Create a function to only CHECK usage limits without incrementing
CREATE OR REPLACE FUNCTION check_ai_chat_usage_only(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id UUID;
  v_plan_limits JSON;
  v_current_usage JSON;
  v_limit INTEGER;
  v_used INTEGER;
  v_plan_name TEXT;
BEGIN
  -- Get user's active subscription and plan details
  SELECT 
    p.id,
    p.name,
    json_build_object(
      'messages_per_month', p.messages_per_month,
      'voice_playback_per_month', p.voice_playback_per_month,
      'voice_input_per_month', p.voice_input_per_month,
      'image_analysis_per_month', p.image_analysis_per_month
    )
  INTO v_plan_id, v_plan_name, v_plan_limits
  FROM ai_chat_subscriptions s
  JOIN ai_chat_plans p ON s.plan_id = p.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND NOW() BETWEEN s.starts_at AND s.ends_at
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no active subscription, return error
  IF v_plan_id IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'No active subscription found'
    );
  END IF;

  -- Get current month's usage
  SELECT 
    COALESCE(messages_count, 0) as messages_count,
    COALESCE(voice_playback_count, 0) as voice_playback_count,
    COALESCE(voice_input_count, 0) as voice_input_count,
    COALESCE(image_analysis_count, 0) as image_analysis_count
  INTO v_current_usage
  FROM ai_chat_usage
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE;

  -- Determine limit and usage based on type
  CASE p_usage_type
    WHEN 'message' THEN
      v_limit := (v_plan_limits->>'messages_per_month')::INTEGER;
      v_used := (v_current_usage->>'messages_count')::INTEGER;
    WHEN 'voice_playback' THEN
      v_limit := (v_plan_limits->>'voice_playback_per_month')::INTEGER;
      v_used := (v_current_usage->>'voice_playback_count')::INTEGER;
    WHEN 'voice_input' THEN
      v_limit := (v_plan_limits->>'voice_input_per_month')::INTEGER;
      v_used := (v_current_usage->>'voice_input_count')::INTEGER;
    WHEN 'image_analysis' THEN
      v_limit := (v_plan_limits->>'image_analysis_per_month')::INTEGER;
      v_used := (v_current_usage->>'image_analysis_count')::INTEGER;
    ELSE
      RETURN json_build_object(
        'allowed', false,
        'error', 'Invalid usage type'
      );
  END CASE;

  -- Check if limit is reached
  IF v_limit < 999999 AND v_used >= v_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Usage limit reached for ' || p_usage_type,
      'plan', v_plan_name,
      'remaining', 0
    );
  END IF;

  -- Return success with remaining count
  RETURN json_build_object(
    'allowed', true,
    'plan', v_plan_name,
    'remaining', CASE WHEN v_limit >= 999999 THEN 999999 ELSE v_limit - v_used END
  );
END;
$$;
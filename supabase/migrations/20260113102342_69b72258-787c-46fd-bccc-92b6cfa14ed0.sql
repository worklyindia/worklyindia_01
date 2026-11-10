-- Fix the get_user_ai_chat_status function with correct JSONB type handling
CREATE OR REPLACE FUNCTION public.get_user_ai_chat_status(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_subscription RECORD;
  v_usage RECORD;
  v_result JSON;
  v_free_plan_id UUID;
  v_current_month_start DATE;
  v_current_month_end DATE;
BEGIN
  -- Calculate current month boundaries
  v_current_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_current_month_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE;

  -- Get user's active subscription with plan details
  SELECT 
    s.id as subscription_id,
    s.status,
    s.starts_at,
    s.ends_at,
    p.id as plan_id,
    p.name,
    p.price_inr,
    p.messages_per_month,
    p.voice_playback_per_month,
    p.voice_input_per_month,
    p.image_analysis_per_month,
    p.ai_model_tier,
    p.priority_support,
    p.features
  INTO v_subscription
  FROM ai_chat_subscriptions s
  JOIN ai_chat_plans p ON s.plan_id = p.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND CURRENT_TIMESTAMP BETWEEN s.starts_at AND s.ends_at
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no active subscription, get the free plan
  IF v_subscription IS NULL THEN
    SELECT id INTO v_free_plan_id
    FROM ai_chat_plans
    WHERE price_inr = 0 AND is_active = true
    ORDER BY display_order
    LIMIT 1;

    IF v_free_plan_id IS NOT NULL THEN
      SELECT 
        p.id as plan_id,
        p.name,
        p.price_inr,
        p.messages_per_month,
        p.voice_playback_per_month,
        p.voice_input_per_month,
        p.image_analysis_per_month,
        p.ai_model_tier,
        p.priority_support,
        p.features
      INTO v_plan
      FROM ai_chat_plans p
      WHERE p.id = v_free_plan_id;
    END IF;
  END IF;

  -- Get current month's usage
  SELECT 
    COALESCE(SUM(messages_count), 0) as messages_count,
    COALESCE(SUM(voice_playback_count), 0) as voice_playback_count,
    COALESCE(SUM(voice_input_count), 0) as voice_input_count,
    COALESCE(SUM(image_analysis_count), 0) as image_analysis_count,
    COALESCE(SUM(tokens_used), 0) as tokens_used
  INTO v_usage
  FROM ai_chat_usage
  WHERE user_id = p_user_id
    AND date >= v_current_month_start
    AND date < v_current_month_end;

  -- Build result JSON
  IF v_subscription IS NOT NULL THEN
    v_result := json_build_object(
      'plan', json_build_object(
        'id', v_subscription.plan_id,
        'name', v_subscription.name,
        'price_inr', v_subscription.price_inr,
        'messages_per_month', v_subscription.messages_per_month,
        'voice_playback_per_month', v_subscription.voice_playback_per_month,
        'voice_input_per_month', v_subscription.voice_input_per_month,
        'image_analysis_per_month', v_subscription.image_analysis_per_month,
        'ai_model_tier', v_subscription.ai_model_tier,
        'priority_support', v_subscription.priority_support,
        'features', COALESCE(v_subscription.features, '[]'::jsonb)
      ),
      'subscription', json_build_object(
        'status', v_subscription.status,
        'starts_at', v_subscription.starts_at,
        'ends_at', v_subscription.ends_at
      ),
      'usage', json_build_object(
        'messages_count', COALESCE(v_usage.messages_count, 0),
        'voice_playback_count', COALESCE(v_usage.voice_playback_count, 0),
        'voice_input_count', COALESCE(v_usage.voice_input_count, 0),
        'image_analysis_count', COALESCE(v_usage.image_analysis_count, 0),
        'tokens_used', COALESCE(v_usage.tokens_used, 0)
      )
    );
  ELSIF v_plan IS NOT NULL THEN
    v_result := json_build_object(
      'plan', json_build_object(
        'id', v_plan.plan_id,
        'name', v_plan.name,
        'price_inr', v_plan.price_inr,
        'messages_per_month', v_plan.messages_per_month,
        'voice_playback_per_month', v_plan.voice_playback_per_month,
        'voice_input_per_month', v_plan.voice_input_per_month,
        'image_analysis_per_month', v_plan.image_analysis_per_month,
        'ai_model_tier', v_plan.ai_model_tier,
        'priority_support', v_plan.priority_support,
        'features', COALESCE(v_plan.features, '[]'::jsonb)
      ),
      'subscription', NULL,
      'usage', json_build_object(
        'messages_count', COALESCE(v_usage.messages_count, 0),
        'voice_playback_count', COALESCE(v_usage.voice_playback_count, 0),
        'voice_input_count', COALESCE(v_usage.voice_input_count, 0),
        'image_analysis_count', COALESCE(v_usage.image_analysis_count, 0),
        'tokens_used', COALESCE(v_usage.tokens_used, 0)
      )
    );
  ELSE
    -- No plan found at all - return default free tier values
    v_result := json_build_object(
      'plan', json_build_object(
        'id', NULL,
        'name', 'Free',
        'price_inr', 0,
        'messages_per_month', 25,
        'voice_playback_per_month', 5,
        'voice_input_per_month', 5,
        'image_analysis_per_month', 3,
        'ai_model_tier', 'basic',
        'priority_support', false,
        'features', '[]'::jsonb
      ),
      'subscription', NULL,
      'usage', json_build_object(
        'messages_count', COALESCE(v_usage.messages_count, 0),
        'voice_playback_count', COALESCE(v_usage.voice_playback_count, 0),
        'voice_input_count', COALESCE(v_usage.voice_input_count, 0),
        'image_analysis_count', COALESCE(v_usage.image_analysis_count, 0),
        'tokens_used', COALESCE(v_usage.tokens_used, 0)
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.get_user_ai_chat_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ai_chat_status(UUID) TO anon;